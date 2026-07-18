-- ULC Linz App – Trainer-Gruppenzuordnung und UI-Nachbesserungen
-- Ergänzt Gruppenzuordnungen für Trainer, ohne bestehende Trainings- oder Anwesenheitsdaten zu verändern.

update public.app_modules
set title = 'Athleten, Trainer & Gruppen',
    description = 'Athleten, Trainer und Trainingsgruppen verwalten'
where key = 'athletes';

create table public.trainer_group_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id uuid not null,
  group_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (trainer_id, group_id),
  constraint trainer_group_assignments_trainer_fk
    foreign key (trainer_id, organization_id)
    references public.trainers(id, organization_id)
    on delete cascade,
  constraint trainer_group_assignments_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete cascade
);

create index trainer_group_assignments_org_group_idx
  on public.trainer_group_assignments (organization_id, group_id, trainer_id);

alter table public.trainer_group_assignments enable row level security;
revoke all on table public.trainer_group_assignments from anon, authenticated;

create or replace function public.replace_trainer_group_assignments(
  p_organization_id uuid,
  p_trainer_id uuid,
  p_group_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_group_ids uuid[];
  previous_group_ids uuid[];
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für die Bearbeitung der Trainer-Gruppenzuordnung fehlen die erforderlichen Rechte.';
  end if;

  if not exists (
    select 1
    from public.trainers trainer
    where trainer.id = p_trainer_id
      and trainer.organization_id = p_organization_id
  ) then
    raise exception 'Der Trainer wurde nicht gefunden.';
  end if;

  select coalesce(array_agg(distinct group_id order by group_id), array[]::uuid[])
  into normalized_group_ids
  from unnest(coalesce(p_group_ids, array[]::uuid[])) group_id;

  if exists (
    select 1
    from unnest(normalized_group_ids) requested_group_id
    left join public.training_groups training_group
      on training_group.id = requested_group_id
     and training_group.organization_id = p_organization_id
    where training_group.id is null
  ) then
    raise exception 'Mindestens eine Trainingsgruppe gehört nicht zu diesem Verein.';
  end if;

  select coalesce(array_agg(assignment.group_id order by assignment.group_id), array[]::uuid[])
  into previous_group_ids
  from public.trainer_group_assignments assignment
  where assignment.organization_id = p_organization_id
    and assignment.trainer_id = p_trainer_id;

  delete from public.trainer_group_assignments assignment
  where assignment.organization_id = p_organization_id
    and assignment.trainer_id = p_trainer_id
    and not (assignment.group_id = any(normalized_group_ids));

  insert into public.trainer_group_assignments (
    organization_id,
    trainer_id,
    group_id,
    created_by
  )
  select p_organization_id, p_trainer_id, group_id, current_user_id
  from unnest(normalized_group_ids) group_id
  on conflict (trainer_id, group_id) do nothing;

  if previous_group_ids is distinct from normalized_group_ids then
    insert into public.audit_log (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    ) values (
      p_organization_id,
      current_user_id,
      'trainer.groups_updated',
      'trainer',
      p_trainer_id::text,
      jsonb_build_object('group_ids', to_jsonb(previous_group_ids)),
      jsonb_build_object('group_ids', to_jsonb(normalized_group_ids))
    );
  end if;
end;
$$;

create or replace function public.trainer_overview_v2(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.can_read_athlete_data(p_organization_id)
    or public.can_read_kindertraining(p_organization_id)
  ) then
    raise exception 'Für die Trainerstammdaten fehlen die erforderlichen Rechte.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', trainer.id,
          'first_name', trainer.first_name,
          'last_name', trainer.last_name,
          'phone', trainer.phone,
          'email', trainer.email,
          'notes', trainer.notes,
          'is_active', trainer.is_active,
          'linked_user_id', trainer.linked_user_id,
          'group_ids', coalesce(
            (
              select jsonb_agg(assignment.group_id order by training_group.sort_order, lower(training_group.name))
              from public.trainer_group_assignments assignment
              join public.training_groups training_group
                on training_group.id = assignment.group_id
               and training_group.organization_id = assignment.organization_id
              where assignment.organization_id = trainer.organization_id
                and assignment.trainer_id = trainer.id
            ),
            '[]'::jsonb
          ),
          'created_at', trainer.created_at,
          'updated_at', trainer.updated_at
        )
        order by trainer.is_active desc, lower(trainer.last_name), lower(trainer.first_name)
      )
      from public.trainers trainer
      where trainer.organization_id = p_organization_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.create_trainer_v2(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_group_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_trainer_id uuid;
begin
  new_trainer_id := public.create_trainer(
    p_organization_id,
    p_first_name,
    p_last_name,
    p_phone,
    p_email,
    p_notes
  );

  perform public.replace_trainer_group_assignments(
    p_organization_id,
    new_trainer_id,
    p_group_ids
  );

  return new_trainer_id;
end;
$$;

create or replace function public.update_trainer_v2(
  p_organization_id uuid,
  p_trainer_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.update_trainer(
    p_organization_id,
    p_trainer_id,
    p_first_name,
    p_last_name,
    p_phone,
    p_email,
    p_notes,
    p_is_active
  );

  perform public.replace_trainer_group_assignments(
    p_organization_id,
    p_trainer_id,
    p_group_ids
  );
end;
$$;

create or replace function public.kindertraining_group_trainer_ids(
  p_organization_id uuid,
  p_group_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_kindertraining(p_organization_id) then
    raise exception 'Für das Kindertraining fehlen die erforderlichen Leserechte.';
  end if;

  if not exists (
    select 1
    from public.training_groups training_group
    where training_group.id = p_group_id
      and training_group.organization_id = p_organization_id
      and training_group.module_key = 'kindertraining'
  ) then
    raise exception 'Die Kindertrainingsgruppe wurde nicht gefunden oder ist nicht zugeordnet.';
  end if;

  return coalesce(
    (
      select jsonb_agg(assignment.trainer_id order by lower(trainer.last_name), lower(trainer.first_name))
      from public.trainer_group_assignments assignment
      join public.trainers trainer
        on trainer.id = assignment.trainer_id
       and trainer.organization_id = assignment.organization_id
      where assignment.organization_id = p_organization_id
        and assignment.group_id = p_group_id
        and trainer.is_active
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.replace_trainer_group_assignments(uuid, uuid, uuid[]) from public;
revoke all on function public.trainer_overview_v2(uuid) from public;
revoke all on function public.create_trainer_v2(uuid, text, text, text, text, text, uuid[]) from public;
revoke all on function public.update_trainer_v2(uuid, uuid, text, text, text, text, text, boolean, uuid[]) from public;
revoke all on function public.kindertraining_group_trainer_ids(uuid, uuid) from public;

grant execute on function public.trainer_overview_v2(uuid) to authenticated;
grant execute on function public.create_trainer_v2(uuid, text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.update_trainer_v2(uuid, uuid, text, text, text, text, text, boolean, uuid[]) to authenticated;
grant execute on function public.kindertraining_group_trainer_ids(uuid, uuid) to authenticated;
