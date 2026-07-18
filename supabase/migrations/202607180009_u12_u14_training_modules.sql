-- ULC Linz App – U12 und U14
-- Zwei eigenständige Trainingsmodule mit derselben bewährten Logik wie das Kindertraining.
-- Bestehende Kindertraining-Funktionen und Daten bleiben unverändert.

insert into public.app_modules (
  key, title, description, route, icon, sort_order, is_active
) values
  ('u12', 'U12', 'Anwesenheit, Notizen und Statistik', '/module/u12', 'users', 15, true),
  ('u14', 'U14', 'Anwesenheit, Notizen und Statistik', '/module/u14', 'users', 16, true),
  ('u12_statistics', 'U12', 'Trainings-, Athleten- und Trainerstatistik', '/module/u12/statistik', 'chart-no-axes-combined', 111, true),
  ('u14_statistics', 'U14', 'Trainings-, Athleten- und Trainerstatistik', '/module/u14/statistik', 'chart-no-axes-combined', 112, true)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  route = excluded.route,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;

-- Bestehende Kindertraining-Rechte dienen als sinnvolle Startbelegung.
-- Danach können die Rechte wie gewohnt in der Benutzerverwaltung getrennt geändert werden.
insert into public.member_module_permissions (
  membership_id, module_key, can_view, can_edit
)
select
  permission.membership_id,
  target.module_key,
  permission.can_view,
  permission.can_edit
from public.member_module_permissions permission
cross join (
  values ('u12'::text), ('u14'::text), ('u12_statistics'::text), ('u14_statistics'::text)
) target(module_key)
where permission.module_key = 'kindertraining'
on conflict (membership_id, module_key) do nothing;

create table public.training_module_statistics_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  default_from date not null default date_trunc('year', current_date)::date,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key),
  constraint training_module_statistics_settings_module_valid
    check (module_key in ('u12', 'u14'))
);

create trigger training_module_statistics_settings_set_updated_at
before update on public.training_module_statistics_settings
for each row execute function public.set_updated_at();

alter table public.training_module_statistics_settings enable row level security;
revoke all on table public.training_module_statistics_settings from anon, authenticated;

create or replace function public.is_attendance_training_module(
  p_module_key text
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_module_key in ('u12', 'u14');
$$;

create or replace function public.can_read_training_module(
  p_organization_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_attendance_training_module(p_module_key)
    and public.has_module_access(p_organization_id, p_module_key, false);
$$;

create or replace function public.can_edit_training_module(
  p_organization_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_attendance_training_module(p_module_key)
    and public.has_module_access(p_organization_id, p_module_key, true);
$$;

create or replace function public.can_read_training_module_statistics(
  p_organization_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_attendance_training_module(p_module_key)
    and (
      public.has_module_access(p_organization_id, p_module_key || '_statistics', false)
      or public.has_module_access(p_organization_id, p_module_key, false)
    );
$$;

create or replace function public.can_edit_training_module_statistics(
  p_organization_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_attendance_training_module(p_module_key)
    and (
      public.has_module_access(p_organization_id, p_module_key || '_statistics', true)
      or public.has_module_access(p_organization_id, p_module_key, true)
    );
$$;

create or replace function public.create_training_group_v2(
  p_organization_id uuid,
  p_name text,
  p_short_name text default null,
  p_description text default null,
  p_sort_order integer default 100,
  p_module_key text default null,
  p_regular_weekdays smallint[] default array[]::smallint[],
  p_allow_special_training boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_group_id uuid;
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_short_name text := nullif(trim(coalesce(p_short_name, '')), '');
  normalized_description text := nullif(trim(coalesce(p_description, '')), '');
  normalized_module_key text := nullif(trim(coalesce(p_module_key, '')), '');
  normalized_weekdays smallint[];
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Athletenmodul.';
  end if;

  select coalesce(array_agg(distinct weekday order by weekday), array[]::smallint[])
  into normalized_weekdays
  from unnest(coalesce(p_regular_weekdays, array[]::smallint[])) weekday
  where weekday between 1 and 7;

  if cardinality(normalized_weekdays) <> cardinality(coalesce(p_regular_weekdays, array[]::smallint[])) then
    raise exception 'Die ausgewählten Trainingstage sind ungültig.';
  end if;

  if char_length(normalized_name) not between 2 and 100 then
    raise exception 'Der Gruppenname muss zwischen zwei und 100 Zeichen lang sein.';
  end if;

  if normalized_short_name is not null and char_length(normalized_short_name) > 20 then
    raise exception 'Die Kurzbezeichnung darf höchstens 20 Zeichen lang sein.';
  end if;

  if normalized_description is not null and char_length(normalized_description) > 1000 then
    raise exception 'Die Beschreibung darf höchstens 1000 Zeichen lang sein.';
  end if;

  if p_sort_order not between 0 and 10000 then
    raise exception 'Die Sortierreihenfolge ist ungültig.';
  end if;

  if normalized_module_key is not null
     and normalized_module_key not in ('kindertraining', 'u12', 'u14') then
    raise exception 'Das ausgewählte Trainingsmodul ist ungültig.';
  end if;

  if normalized_module_key is not null and not exists (
    select 1 from public.app_modules app_module
    where app_module.key = normalized_module_key and app_module.is_active
  ) then
    raise exception 'Das ausgewählte App-Modul ist ungültig.';
  end if;

  if normalized_module_key is not null and cardinality(normalized_weekdays) = 0 then
    raise exception 'Für ein zugeordnetes Trainingsmodul muss mindestens ein Trainingstag ausgewählt werden.';
  end if;

  if exists (
    select 1
    from public.training_groups training_group
    where training_group.organization_id = p_organization_id
      and lower(trim(training_group.name)) = lower(normalized_name)
  ) then
    raise exception 'Eine Trainingsgruppe mit diesem Namen existiert bereits.';
  end if;

  if normalized_module_key is not null and exists (
    select 1
    from public.training_groups training_group
    where training_group.organization_id = p_organization_id
      and training_group.module_key = normalized_module_key
  ) then
    raise exception 'Dieses App-Modul ist bereits einer anderen Trainingsgruppe zugeordnet.';
  end if;

  insert into public.training_groups (
    organization_id,
    name,
    short_name,
    description,
    sort_order,
    module_key,
    regular_weekdays,
    allow_special_training,
    created_by
  ) values (
    p_organization_id,
    normalized_name,
    normalized_short_name,
    normalized_description,
    p_sort_order,
    normalized_module_key,
    normalized_weekdays,
    coalesce(p_allow_special_training, true),
    current_user_id
  )
  returning id into new_group_id;

  insert into public.audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    p_organization_id,
    current_user_id,
    'training_group.created',
    'training_group',
    new_group_id::text,
    jsonb_build_object(
      'name', normalized_name,
      'short_name', normalized_short_name,
      'sort_order', p_sort_order,
      'is_active', true,
      'module_key', normalized_module_key,
      'regular_weekdays', to_jsonb(normalized_weekdays),
      'allow_special_training', coalesce(p_allow_special_training, true)
    )
  );

  return new_group_id;
end;
$$;

create or replace function public.update_training_group_v2(
  p_organization_id uuid,
  p_group_id uuid,
  p_name text,
  p_short_name text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_sort_order integer default 100,
  p_module_key text default null,
  p_regular_weekdays smallint[] default array[]::smallint[],
  p_allow_special_training boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_short_name text := nullif(trim(coalesce(p_short_name, '')), '');
  normalized_description text := nullif(trim(coalesce(p_description, '')), '');
  normalized_module_key text := nullif(trim(coalesce(p_module_key, '')), '');
  normalized_weekdays smallint[];
  old_data jsonb;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Athletenmodul.';
  end if;

  select coalesce(array_agg(distinct weekday order by weekday), array[]::smallint[])
  into normalized_weekdays
  from unnest(coalesce(p_regular_weekdays, array[]::smallint[])) weekday
  where weekday between 1 and 7;

  if cardinality(normalized_weekdays) <> cardinality(coalesce(p_regular_weekdays, array[]::smallint[])) then
    raise exception 'Die ausgewählten Trainingstage sind ungültig.';
  end if;

  select jsonb_build_object(
    'name', training_group.name,
    'short_name', training_group.short_name,
    'description', training_group.description,
    'sort_order', training_group.sort_order,
    'is_active', training_group.is_active,
    'module_key', training_group.module_key,
    'regular_weekdays', to_jsonb(training_group.regular_weekdays),
    'allow_special_training', training_group.allow_special_training
  )
  into old_data
  from public.training_groups training_group
  where training_group.id = p_group_id
    and training_group.organization_id = p_organization_id;

  if old_data is null then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden.';
  end if;

  if char_length(normalized_name) not between 2 and 100 then
    raise exception 'Der Gruppenname muss zwischen zwei und 100 Zeichen lang sein.';
  end if;

  if normalized_short_name is not null and char_length(normalized_short_name) > 20 then
    raise exception 'Die Kurzbezeichnung darf höchstens 20 Zeichen lang sein.';
  end if;

  if normalized_description is not null and char_length(normalized_description) > 1000 then
    raise exception 'Die Beschreibung darf höchstens 1000 Zeichen lang sein.';
  end if;

  if p_sort_order not between 0 and 10000 then
    raise exception 'Die Sortierreihenfolge ist ungültig.';
  end if;

  if normalized_module_key is not null
     and normalized_module_key not in ('kindertraining', 'u12', 'u14') then
    raise exception 'Das ausgewählte Trainingsmodul ist ungültig.';
  end if;

  if normalized_module_key is not null and not exists (
    select 1 from public.app_modules app_module
    where app_module.key = normalized_module_key and app_module.is_active
  ) then
    raise exception 'Das ausgewählte App-Modul ist ungültig.';
  end if;

  if normalized_module_key is not null and cardinality(normalized_weekdays) = 0 then
    raise exception 'Für ein zugeordnetes Trainingsmodul muss mindestens ein Trainingstag ausgewählt werden.';
  end if;

  if exists (
    select 1
    from public.training_groups training_group
    where training_group.organization_id = p_organization_id
      and training_group.id <> p_group_id
      and lower(trim(training_group.name)) = lower(normalized_name)
  ) then
    raise exception 'Eine Trainingsgruppe mit diesem Namen existiert bereits.';
  end if;

  if normalized_module_key is not null and exists (
    select 1
    from public.training_groups training_group
    where training_group.organization_id = p_organization_id
      and training_group.id <> p_group_id
      and training_group.module_key = normalized_module_key
  ) then
    raise exception 'Dieses App-Modul ist bereits einer anderen Trainingsgruppe zugeordnet.';
  end if;

  update public.training_groups
  set name = normalized_name,
      short_name = normalized_short_name,
      description = normalized_description,
      is_active = p_is_active,
      sort_order = p_sort_order,
      module_key = normalized_module_key,
      regular_weekdays = normalized_weekdays,
      allow_special_training = coalesce(p_allow_special_training, true)
  where id = p_group_id
    and organization_id = p_organization_id;

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
    'training_group.updated',
    'training_group',
    p_group_id::text,
    old_data,
    jsonb_build_object(
      'name', normalized_name,
      'short_name', normalized_short_name,
      'description', normalized_description,
      'sort_order', p_sort_order,
      'is_active', p_is_active,
      'module_key', normalized_module_key,
      'regular_weekdays', to_jsonb(normalized_weekdays),
      'allow_special_training', coalesce(p_allow_special_training, true)
    )
  );
end;
$$;

create or replace function public.training_module_configuration_overview(
  p_organization_id uuid,
  p_module_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_group public.training_groups%rowtype;
  special_dates jsonb;
begin
  if not public.can_read_training_module(p_organization_id, p_module_key) then
    raise exception 'Für dieses Trainingsmodul fehlen die erforderlichen Leserechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.module_key = p_module_key;

  if target_group.id is null then
    return jsonb_build_object('group', null, 'special_dates', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(training_date order by training_date), '[]'::jsonb)
  into special_dates
  from (
    select training_session.session_date as training_date
    from public.training_sessions training_session
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group.id
      and training_session.deleted_at is null
      and (
        training_session.is_special
        or not (
          extract(isodow from training_session.session_date)::smallint
          = any(target_group.regular_weekdays)
        )
      )
      and training_session.session_date between current_date - 1460 and current_date + 1460
    order by training_session.session_date
  ) saved_special_dates;

  return jsonb_build_object(
    'group', jsonb_build_object(
      'id', target_group.id,
      'name', target_group.name,
      'short_name', target_group.short_name,
      'is_active', target_group.is_active,
      'regular_weekdays', to_jsonb(target_group.regular_weekdays),
      'allow_special_training', target_group.allow_special_training
    ),
    'special_dates', special_dates
  );
end;
$$;

create or replace function public.training_module_session_overview(
  p_organization_id uuid,
  p_module_key text,
  p_group_id uuid,
  p_session_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_session public.training_sessions%rowtype;
  previous_session_id uuid;
  participant_data jsonb;
  trainer_data jsonb;
  selected_trainer_ids jsonb;
  default_trainer_ids jsonb := '[]'::jsonb;
  target_group public.training_groups%rowtype;
  is_regular_day boolean;
  uses_current_assignments boolean := false;
  default_environment public.training_environment;
begin
  if p_session_date is null then
    raise exception 'Der Trainingstag fehlt.';
  end if;

  if not public.can_read_training_module(p_organization_id, p_module_key) then
    raise exception 'Für dieses Trainingsmodul fehlen die erforderlichen Leserechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.id = p_group_id
    and training_group.organization_id = p_organization_id
    and training_group.module_key = p_module_key;

  if target_group.id is null then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden oder ist dem Modul nicht zugeordnet.';
  end if;

  is_regular_day := extract(isodow from p_session_date)::smallint = any(target_group.regular_weekdays);

  select training_session.*
  into target_session
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = p_group_id
    and training_session.session_date = p_session_date
    and training_session.deleted_at is null;

  if target_session.id is null and not is_regular_day and not target_group.allow_special_training then
    raise exception 'Dieser Tag ist kein regulärer Trainingstag und Sondertrainings sind deaktiviert.';
  end if;

  if target_session.id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'athlete_id', athlete.id,
          'first_name', athlete.first_name,
          'last_name', athlete.last_name,
          'birth_year', athlete.birth_year,
          'is_active', athlete.is_active,
          'status', attendance.status,
          'contacts', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', contact.id,
                  'contact_name', contact.contact_name,
                  'relationship', contact.relationship,
                  'phone', contact.phone,
                  'is_emergency', contact.is_emergency,
                  'priority', contact.priority,
                  'notes', contact.notes
                )
                order by contact.is_emergency desc, contact.priority, lower(contact.contact_name)
              )
              from public.athlete_contacts contact
              where contact.organization_id = athlete.organization_id
                and contact.athlete_id = athlete.id
            ),
            '[]'::jsonb
          )
        )
        order by lower(athlete.first_name), lower(athlete.last_name), athlete.id
      ),
      '[]'::jsonb
    )
    into participant_data
    from public.training_attendance attendance
    join public.athletes athlete
      on athlete.id = attendance.athlete_id
     and athlete.organization_id = attendance.organization_id
    where attendance.organization_id = p_organization_id
      and attendance.session_id = target_session.id;
  else
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'athlete_id', athlete.id,
          'first_name', athlete.first_name,
          'last_name', athlete.last_name,
          'birth_year', athlete.birth_year,
          'is_active', athlete.is_active,
          'status', 'open',
          'contacts', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', contact.id,
                  'contact_name', contact.contact_name,
                  'relationship', contact.relationship,
                  'phone', contact.phone,
                  'is_emergency', contact.is_emergency,
                  'priority', contact.priority,
                  'notes', contact.notes
                )
                order by contact.is_emergency desc, contact.priority, lower(contact.contact_name)
              )
              from public.athlete_contacts contact
              where contact.organization_id = athlete.organization_id
                and contact.athlete_id = athlete.id
            ),
            '[]'::jsonb
          )
        )
        order by lower(athlete.first_name), lower(athlete.last_name), athlete.id
      ),
      '[]'::jsonb
    )
    into participant_data
    from public.athlete_group_memberships membership
    join public.athletes athlete
      on athlete.id = membership.athlete_id
     and athlete.organization_id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.group_id = p_group_id
      and membership.started_on <= p_session_date
      and (membership.ended_on is null or membership.ended_on >= p_session_date)
      and athlete.is_active;

    if participant_data = '[]'::jsonb and p_session_date < current_date then
      uses_current_assignments := true;

      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'athlete_id', athlete.id,
            'first_name', athlete.first_name,
            'last_name', athlete.last_name,
            'birth_year', athlete.birth_year,
            'is_active', athlete.is_active,
            'status', 'open',
            'contacts', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', contact.id,
                    'contact_name', contact.contact_name,
                    'relationship', contact.relationship,
                    'phone', contact.phone,
                    'is_emergency', contact.is_emergency,
                    'priority', contact.priority,
                    'notes', contact.notes
                  )
                  order by contact.is_emergency desc, contact.priority, lower(contact.contact_name)
                )
                from public.athlete_contacts contact
                where contact.organization_id = athlete.organization_id
                  and contact.athlete_id = athlete.id
              ),
              '[]'::jsonb
            )
          )
          order by lower(athlete.first_name), lower(athlete.last_name), athlete.id
        ),
        '[]'::jsonb
      )
      into participant_data
      from public.athlete_group_memberships membership
      join public.athletes athlete
        on athlete.id = membership.athlete_id
       and athlete.organization_id = membership.organization_id
      where membership.organization_id = p_organization_id
        and membership.group_id = p_group_id
        and membership.started_on <= current_date
        and (membership.ended_on is null or membership.ended_on >= current_date)
        and athlete.is_active;
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', trainer.id,
        'first_name', trainer.first_name,
        'last_name', trainer.last_name,
        'phone', trainer.phone,
        'email', trainer.email,
        'is_active', trainer.is_active
      )
      order by trainer.is_active desc, lower(trainer.last_name), lower(trainer.first_name)
    ),
    '[]'::jsonb
  )
  into trainer_data
  from public.trainers trainer
  where trainer.organization_id = p_organization_id
    and (
      trainer.is_active
      or (
        target_session.id is not null
        and exists (
          select 1 from public.training_session_trainers session_trainer
          where session_trainer.organization_id = p_organization_id
            and session_trainer.session_id = target_session.id
            and session_trainer.trainer_id = trainer.id
        )
      )
    );

  if target_session.id is not null then
    select coalesce(jsonb_agg(session_trainer.trainer_id order by trainer.last_name, trainer.first_name), '[]'::jsonb)
    into selected_trainer_ids
    from public.training_session_trainers session_trainer
    join public.trainers trainer
      on trainer.id = session_trainer.trainer_id
     and trainer.organization_id = session_trainer.organization_id
    where session_trainer.organization_id = p_organization_id
      and session_trainer.session_id = target_session.id;
  else
    select previous_session.id, previous_session.environment
    into previous_session_id, default_environment
    from public.training_sessions previous_session
    where previous_session.organization_id = p_organization_id
      and previous_session.group_id = p_group_id
      and previous_session.deleted_at is null
      and previous_session.state = 'scheduled'
      and previous_session.session_date < p_session_date
    order by previous_session.session_date desc
    limit 1;

    if previous_session_id is not null then
      select coalesce(jsonb_agg(session_trainer.trainer_id order by trainer.last_name, trainer.first_name), '[]'::jsonb)
      into default_trainer_ids
      from public.training_session_trainers session_trainer
      join public.trainers trainer
        on trainer.id = session_trainer.trainer_id
       and trainer.organization_id = session_trainer.organization_id
       and trainer.is_active
      where session_trainer.organization_id = p_organization_id
        and session_trainer.session_id = previous_session_id;
    end if;

    selected_trainer_ids := default_trainer_ids;
  end if;

  return jsonb_build_object(
    'session',
      case
        when target_session.id is null then null
        else jsonb_build_object(
          'id', target_session.id,
          'state', target_session.state,
          'note', coalesce(target_session.note, ''),
          'is_special', target_session.is_special,
          'environment', target_session.environment,
          'trainer_ids', selected_trainer_ids,
          'created_at', target_session.created_at,
          'updated_at', target_session.updated_at
        )
      end,
    'is_regular_day', is_regular_day,
    'uses_current_assignments', uses_current_assignments,
    'default_environment', default_environment,
    'default_trainer_ids', default_trainer_ids,
    'trainers', trainer_data,
    'participants', participant_data
  );
end;
$$;

create or replace function public.save_training_module_session(
  p_organization_id uuid,
  p_module_key text,
  p_group_id uuid,
  p_session_date date,
  p_state public.training_session_state,
  p_note text,
  p_attendance jsonb,
  p_trainer_ids uuid[],
  p_environment public.training_environment,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  normalized_attendance jsonb := coalesce(p_attendance, '[]'::jsonb);
  normalized_trainer_ids uuid[] := coalesce(
    array(
      select distinct trainer_id
      from unnest(coalesce(p_trainer_ids, array[]::uuid[])) trainer_id
      where trainer_id is not null
    ),
    array[]::uuid[]
  );
  target_session_id uuid;
  previous_updated_at timestamptz;
  session_existed boolean := false;
  target_group public.training_groups%rowtype;
  is_regular_day boolean;
  duplicate_count integer;
  invalid_athlete_count integer;
  invalid_trainer_count integer;
  old_summary jsonb;
  uses_current_assignments boolean := false;
begin
  if current_user_id is null
     or not public.can_edit_training_module(p_organization_id, p_module_key) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Trainingsmodul.';
  end if;

  if p_session_date is null then
    raise exception 'Der Trainingstag fehlt.';
  end if;

  if normalized_note is not null and char_length(normalized_note) > 3000 then
    raise exception 'Die Trainingsnotiz darf höchstens 3000 Zeichen lang sein.';
  end if;

  if jsonb_typeof(normalized_attendance) <> 'array' then
    raise exception 'Die Teilnehmerdaten sind ungültig.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(normalized_attendance) attendance_item
    where jsonb_typeof(attendance_item) <> 'object'
       or coalesce(attendance_item ->> 'athlete_id', '') = ''
       or coalesce(attendance_item ->> 'status', '') not in (
         'open', 'present', 'excused', 'absent'
       )
  ) then
    raise exception 'Mindestens ein Anwesenheitseintrag ist ungültig.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.id = p_group_id
    and training_group.organization_id = p_organization_id
    and training_group.module_key = p_module_key;

  if target_group.id is null then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden oder ist dem Modul nicht zugeordnet.';
  end if;

  is_regular_day := extract(isodow from p_session_date)::smallint = any(target_group.regular_weekdays);

  if not is_regular_day and not target_group.allow_special_training and not exists (
    select 1 from public.training_sessions training_session
    where training_session.organization_id = p_organization_id
      and training_session.group_id = p_group_id
      and training_session.session_date = p_session_date
      and training_session.deleted_at is null
  ) then
    raise exception 'Dieser Tag ist kein regulärer Trainingstag und Sondertrainings sind deaktiviert.';
  end if;

  select count(*) - count(distinct (attendance_item ->> 'athlete_id'))
  into duplicate_count
  from jsonb_array_elements(normalized_attendance) attendance_item;

  if duplicate_count > 0 then
    raise exception 'Ein Athlet ist in der Teilnehmerliste mehrfach enthalten.';
  end if;

  select count(*)
  into invalid_athlete_count
  from jsonb_array_elements(normalized_attendance) attendance_item
  left join public.athletes athlete
    on athlete.id = (attendance_item ->> 'athlete_id')::uuid
   and athlete.organization_id = p_organization_id
  where athlete.id is null;

  if invalid_athlete_count > 0 then
    raise exception 'Mindestens ein Athlet gehört nicht zu diesem Verein.';
  end if;

  select count(*)
  into invalid_trainer_count
  from unnest(normalized_trainer_ids) trainer_id
  left join public.trainers trainer
    on trainer.id = trainer_id
   and trainer.organization_id = p_organization_id
  where trainer.id is null;

  if invalid_trainer_count > 0 then
    raise exception 'Mindestens ein Trainer gehört nicht zu diesem Verein.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' || p_group_id::text || ':' || p_session_date::text,
      0
    )
  );

  select
    training_session.id,
    training_session.updated_at,
    jsonb_build_object(
      'state', training_session.state,
      'note', training_session.note,
      'is_special', training_session.is_special,
      'environment', training_session.environment,
      'updated_at', training_session.updated_at
    )
  into target_session_id, previous_updated_at, old_summary
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = p_group_id
    and training_session.session_date = p_session_date
    and training_session.deleted_at is null
  for update;

  session_existed := target_session_id is not null;

  if session_existed then
    if p_expected_updated_at is null
       or p_expected_updated_at <> previous_updated_at then
      raise exception 'Das Training wurde inzwischen von einer anderen Person geändert. Bitte neu laden.';
    end if;

    update public.training_sessions
    set state = p_state,
        note = normalized_note,
        is_special = not is_regular_day,
        environment = p_environment,
        updated_by = current_user_id
    where id = target_session_id
      and organization_id = p_organization_id;
  else
    if p_expected_updated_at is not null then
      raise exception 'Das Training wurde inzwischen geändert. Bitte neu laden.';
    end if;

    if not target_group.is_active then
      raise exception 'Für eine deaktivierte Trainingsgruppe kann kein neuer Termin angelegt werden.';
    end if;

    select p_session_date < current_date and not exists (
      select 1
      from public.athlete_group_memberships historical_membership
      join public.athletes historical_athlete
        on historical_athlete.id = historical_membership.athlete_id
       and historical_athlete.organization_id = historical_membership.organization_id
       and historical_athlete.is_active
      where historical_membership.organization_id = p_organization_id
        and historical_membership.group_id = p_group_id
        and historical_membership.started_on <= p_session_date
        and (
          historical_membership.ended_on is null
          or historical_membership.ended_on >= p_session_date
        )
    )
    into uses_current_assignments;

    select count(*)
    into invalid_athlete_count
    from jsonb_array_elements(normalized_attendance) attendance_item
    left join public.athlete_group_memberships membership
      on membership.organization_id = p_organization_id
     and membership.group_id = p_group_id
     and membership.athlete_id = (attendance_item ->> 'athlete_id')::uuid
     and (
       (
         not uses_current_assignments
         and membership.started_on <= p_session_date
         and (membership.ended_on is null or membership.ended_on >= p_session_date)
       )
       or
       (
         uses_current_assignments
         and membership.started_on <= current_date
         and (membership.ended_on is null or membership.ended_on >= current_date)
       )
     )
    left join public.athletes athlete
      on athlete.id = membership.athlete_id
     and athlete.organization_id = membership.organization_id
     and athlete.is_active
    where membership.id is null or athlete.id is null;

    if invalid_athlete_count > 0 then
      raise exception 'Die Teilnehmerliste ist nicht mehr aktuell. Bitte das Training neu laden.';
    end if;

    insert into public.training_sessions (
      organization_id,
      group_id,
      session_date,
      state,
      note,
      is_special,
      environment,
      created_by,
      updated_by
    ) values (
      p_organization_id,
      p_group_id,
      p_session_date,
      p_state,
      normalized_note,
      not is_regular_day,
      p_environment,
      current_user_id,
      current_user_id
    )
    returning id into target_session_id;
  end if;

  insert into public.training_attendance (
    organization_id,
    session_id,
    athlete_id,
    status,
    created_by,
    updated_by
  )
  select
    p_organization_id,
    target_session_id,
    (attendance_item ->> 'athlete_id')::uuid,
    (attendance_item ->> 'status')::public.training_attendance_status,
    current_user_id,
    current_user_id
  from jsonb_array_elements(normalized_attendance) attendance_item
  on conflict (session_id, athlete_id)
  do update set
    status = excluded.status,
    updated_by = current_user_id;

  delete from public.training_session_trainers session_trainer
  where session_trainer.organization_id = p_organization_id
    and session_trainer.session_id = target_session_id
    and not (session_trainer.trainer_id = any(normalized_trainer_ids));

  insert into public.training_session_trainers (
    organization_id,
    session_id,
    trainer_id,
    created_by
  )
  select p_organization_id, target_session_id, trainer_id, current_user_id
  from unnest(normalized_trainer_ids) trainer_id
  on conflict (session_id, trainer_id) do nothing;

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
    case when session_existed then p_module_key || '.updated' else p_module_key || '.created' end,
    'training_session',
    target_session_id::text,
    old_summary,
    jsonb_build_object(
      'group_id', p_group_id,
      'session_date', p_session_date,
      'state', p_state,
      'note', normalized_note,
      'is_special', not is_regular_day,
      'environment', p_environment,
      'trainer_count', cardinality(normalized_trainer_ids),
      'participant_count', jsonb_array_length(normalized_attendance),
      'present_count', (
        select count(*) from jsonb_array_elements(normalized_attendance) item
        where item ->> 'status' = 'present'
      ),
      'excused_count', (
        select count(*) from jsonb_array_elements(normalized_attendance) item
        where item ->> 'status' = 'excused'
      ),
      'absent_count', (
        select count(*) from jsonb_array_elements(normalized_attendance) item
        where item ->> 'status' = 'absent'
      )
    )
  );

  return public.training_module_session_overview(
    p_organization_id,
    p_module_key,
    p_group_id,
    p_session_date
  );
end;
$$;

create or replace function public.delete_training_module_special_session(
  p_organization_id uuid,
  p_module_key text,
  p_group_id uuid,
  p_session_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_session public.training_sessions%rowtype;
  has_meaningful_data boolean;
begin
  if current_user_id is null or not public.can_edit_training_module(p_organization_id, p_module_key) then
    raise exception 'Für das Löschen des Sondertrainings fehlen die Bearbeitungsrechte.';
  end if;

  if not exists (
    select 1
    from public.training_groups training_group
    where training_group.id = p_group_id
      and training_group.organization_id = p_organization_id
      and training_group.module_key = p_module_key
  ) then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden oder ist dem Modul nicht zugeordnet.';
  end if;

  select training_session.*
  into target_session
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = p_group_id
    and training_session.session_date = p_session_date
    and training_session.deleted_at is null
  for update;

  if target_session.id is null then
    return jsonb_build_object('mode', 'not_found');
  end if;

  if not target_session.is_special then
    raise exception 'Reguläre Trainingstage können nicht gelöscht werden.';
  end if;

  select
    target_session.state = 'cancelled'
    or nullif(trim(coalesce(target_session.note, '')), '') is not null
    or target_session.environment is not null
    or exists (
      select 1 from public.training_attendance attendance
      where attendance.organization_id = p_organization_id
        and attendance.session_id = target_session.id
        and attendance.status <> 'open'
    )
    or exists (
      select 1 from public.training_session_trainers session_trainer
      where session_trainer.organization_id = p_organization_id
        and session_trainer.session_id = target_session.id
    )
  into has_meaningful_data;

  if has_meaningful_data then
    update public.training_sessions
    set deleted_at = now(),
        deleted_by = current_user_id,
        updated_by = current_user_id
    where id = target_session.id
      and organization_id = p_organization_id;

    insert into public.audit_log (
      organization_id, actor_user_id, action, entity_type, entity_id, before_data
    ) values (
      p_organization_id,
      current_user_id,
      p_module_key || '.special_archived',
      'training_session',
      target_session.id::text,
      jsonb_build_object(
        'session_date', target_session.session_date,
        'state', target_session.state,
        'note', target_session.note,
        'environment', target_session.environment
      )
    );

    return jsonb_build_object('mode', 'archived');
  end if;

  delete from public.training_sessions
  where id = target_session.id
    and organization_id = p_organization_id;

  insert into public.audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id, before_data
  ) values (
    p_organization_id,
    current_user_id,
    p_module_key || '.special_deleted',
    'training_session',
    target_session.id::text,
    jsonb_build_object('session_date', target_session.session_date)
  );

  return jsonb_build_object('mode', 'deleted');
end;
$$;

create or replace function public.create_training_module_athlete(
  p_organization_id uuid,
  p_module_key text,
  p_first_name text,
  p_last_name text,
  p_birth_year integer,
  p_session_date date default null,
  p_attach_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_first_name text := trim(coalesce(p_first_name, ''));
  normalized_last_name text := trim(coalesce(p_last_name, ''));
  current_year integer := extract(year from current_date)::integer;
  target_group_id uuid;
  target_athlete public.athletes%rowtype;
  current_membership_id uuid;
  target_session_id uuid;
  result_status text;
begin
  if current_user_id is null or not public.can_edit_training_module(p_organization_id, p_module_key) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Trainingsmodul.';
  end if;

  if char_length(normalized_first_name) not between 1 and 80 then
    raise exception 'Der Vorname ist erforderlich und darf höchstens 80 Zeichen lang sein.';
  end if;

  if char_length(normalized_last_name) not between 1 and 80 then
    raise exception 'Der Nachname ist erforderlich und darf höchstens 80 Zeichen lang sein.';
  end if;

  if p_birth_year is null or p_birth_year not between 1900 and current_year then
    raise exception 'Ein gültiger Jahrgang ist erforderlich.';
  end if;

  select training_group.id
  into target_group_id
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.module_key = p_module_key
    and training_group.is_active;

  if target_group_id is null then
    raise exception 'Für dieses Trainingsmodul ist keine aktive Trainingsgruppe eingerichtet.';
  end if;

  select athlete.*
  into target_athlete
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and lower(trim(athlete.first_name)) = lower(normalized_first_name)
    and lower(trim(athlete.last_name)) = lower(normalized_last_name)
    and athlete.birth_year = p_birth_year
  order by athlete.created_at
  limit 1;

  if target_athlete.id is not null and not p_attach_existing then
    return jsonb_build_object(
      'status', 'duplicate',
      'athlete', jsonb_build_object(
        'id', target_athlete.id,
        'first_name', target_athlete.first_name,
        'last_name', target_athlete.last_name,
        'birth_year', target_athlete.birth_year,
        'is_active', target_athlete.is_active
      )
    );
  end if;

  if target_athlete.id is null then
    insert into public.athletes (
      organization_id,
      first_name,
      last_name,
      birth_year,
      is_active,
      created_by
    ) values (
      p_organization_id,
      normalized_first_name,
      normalized_last_name,
      p_birth_year,
      true,
      current_user_id
    )
    returning * into target_athlete;

    result_status := 'created';
  else
    update public.athletes
    set is_active = true
    where id = target_athlete.id
      and organization_id = p_organization_id;

    result_status := 'attached';
  end if;

  select membership.id
  into current_membership_id
  from public.athlete_group_memberships membership
  where membership.organization_id = p_organization_id
    and membership.athlete_id = target_athlete.id
    and membership.group_id = target_group_id
    and membership.ended_on is null;

  if current_membership_id is null then
    insert into public.athlete_group_memberships (
      organization_id,
      athlete_id,
      group_id,
      started_on,
      created_by
    ) values (
      p_organization_id,
      target_athlete.id,
      target_group_id,
      current_date,
      current_user_id
    );
  elsif result_status = 'attached' then
    result_status := 'already_assigned';
  end if;

  if p_session_date is not null then
    select training_session.id
    into target_session_id
    from public.training_sessions training_session
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group_id
      and training_session.session_date = p_session_date
      and training_session.deleted_at is null;

    if target_session_id is not null then
      insert into public.training_attendance (
        organization_id,
        session_id,
        athlete_id,
        status,
        created_by,
        updated_by
      ) values (
        p_organization_id,
        target_session_id,
        target_athlete.id,
        'open',
        current_user_id,
        current_user_id
      )
      on conflict (session_id, athlete_id) do nothing;
    end if;
  end if;

  insert into public.audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    p_organization_id,
    current_user_id,
    case when result_status = 'created'
      then p_module_key || '.athlete_created'
      else p_module_key || '.athlete_attached'
    end,
    'athlete',
    target_athlete.id::text,
    jsonb_build_object(
      'first_name', target_athlete.first_name,
      'last_name', target_athlete.last_name,
      'birth_year', target_athlete.birth_year,
      'group_id', target_group_id,
      'result', result_status
    )
  );

  return jsonb_build_object(
    'status', result_status,
    'athlete', jsonb_build_object(
      'id', target_athlete.id,
      'first_name', target_athlete.first_name,
      'last_name', target_athlete.last_name,
      'birth_year', target_athlete.birth_year,
      'is_active', true
    )
  );
end;
$$;

create or replace function public.training_module_group_trainer_ids(
  p_organization_id uuid,
  p_module_key text,
  p_group_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_training_module(p_organization_id, p_module_key) then
    raise exception 'Für dieses Trainingsmodul fehlen die erforderlichen Leserechte.';
  end if;

  if not exists (
    select 1
    from public.training_groups training_group
    where training_group.id = p_group_id
      and training_group.organization_id = p_organization_id
      and training_group.module_key = p_module_key
  ) then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden oder ist dem Modul nicht zugeordnet.';
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

create or replace function public.training_module_statistics_overview(
  p_organization_id uuid,
  p_module_key text,
  p_from_date date default null,
  p_to_date date default null,
  p_session_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  default_from_date date;
  effective_from_date date;
  effective_to_date date := coalesce(p_to_date, current_date);
  effective_limit integer := greatest(1, least(coalesce(p_session_limit, 10), 500));
  target_group_id uuid;
  sessions_data jsonb;
  athletes_data jsonb;
  trainers_data jsonb;
  monthly_data jsonb;
  summary_data jsonb;
begin
  if not public.can_read_training_module_statistics(p_organization_id, p_module_key) then
    raise exception 'Für die Trainingsstatistik fehlen die erforderlichen Rechte.';
  end if;

  select coalesce(
    settings.default_from,
    date_trunc('year', current_date)::date
  )
  into default_from_date
  from (select 1) seed
  left join public.training_module_statistics_settings settings
    on settings.organization_id = p_organization_id
   and settings.module_key = p_module_key;

  effective_from_date := coalesce(p_from_date, default_from_date);

  if effective_from_date > effective_to_date then
    raise exception 'Das Von-Datum darf nicht nach dem Bis-Datum liegen.';
  end if;

  select training_group.id
  into target_group_id
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.module_key = p_module_key;

  if target_group_id is null then
    return jsonb_build_object(
      'default_from_date', default_from_date,
      'from_date', effective_from_date,
      'to_date', effective_to_date,
      'summary', jsonb_build_object(),
      'sessions', '[]'::jsonb,
      'athletes', '[]'::jsonb,
      'trainers', '[]'::jsonb,
      'monthly', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(row_data order by session_date desc), '[]'::jsonb)
  into sessions_data
  from (
    select
      training_session.session_date,
      jsonb_build_object(
        'id', training_session.id,
        'session_date', training_session.session_date,
        'state', training_session.state,
        'is_special', training_session.is_special,
        'environment', training_session.environment,
        'note', coalesce(training_session.note, ''),
        'present_count', count(attendance.id) filter (where attendance.status = 'present'),
        'participant_count', count(attendance.id),
        'present_athletes', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', athlete.id,
              'name', concat_ws(' ', athlete.first_name, athlete.last_name)
            )
            order by lower(athlete.first_name), lower(athlete.last_name)
          ) filter (where attendance.status = 'present'),
          '[]'::jsonb
        ),
        'trainers', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', trainer.id,
                'name', concat_ws(' ', trainer.first_name, trainer.last_name)
              )
              order by lower(trainer.last_name), lower(trainer.first_name)
            )
            from public.training_session_trainers session_trainer
            join public.trainers trainer
              on trainer.id = session_trainer.trainer_id
             and trainer.organization_id = session_trainer.organization_id
            where session_trainer.organization_id = p_organization_id
              and session_trainer.session_id = training_session.id
          ),
          '[]'::jsonb
        )
      ) as row_data
    from public.training_sessions training_session
    left join public.training_attendance attendance
      on attendance.organization_id = training_session.organization_id
     and attendance.session_id = training_session.id
    left join public.athletes athlete
      on athlete.id = attendance.athlete_id
     and athlete.organization_id = attendance.organization_id
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group_id
      and training_session.deleted_at is null
      and training_session.session_date between effective_from_date and effective_to_date
    group by training_session.id
    order by training_session.session_date desc
    limit effective_limit
  ) session_rows;

  select coalesce(jsonb_agg(row_data order by present_count desc, last_name, first_name), '[]'::jsonb)
  into athletes_data
  from (
    select
      athlete.first_name,
      athlete.last_name,
      jsonb_build_object(
        'id', athlete.id,
        'first_name', athlete.first_name,
        'last_name', athlete.last_name,
        'birth_year', athlete.birth_year,
        'is_active', athlete.is_active,
        'possible_count', count(attendance.id) filter (where training_session.state = 'scheduled'),
        'present_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'present'
        ),
        'excused_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'excused'
        ),
        'absent_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'absent'
        ),
        'open_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'open'
        ),
        'attendance_rate', case
          when count(attendance.id) filter (where training_session.state = 'scheduled') = 0 then 0
          else round(
            100.0 * count(attendance.id) filter (
              where training_session.state = 'scheduled' and attendance.status = 'present'
            ) / count(attendance.id) filter (where training_session.state = 'scheduled'),
            1
          )
        end
      ) as row_data,
      count(attendance.id) filter (
        where training_session.state = 'scheduled' and attendance.status = 'present'
      ) as present_count
    from public.athletes athlete
    left join public.training_attendance attendance
      on attendance.organization_id = athlete.organization_id
     and attendance.athlete_id = athlete.id
    left join public.training_sessions training_session
      on training_session.id = attendance.session_id
     and training_session.organization_id = attendance.organization_id
     and training_session.group_id = target_group_id
     and training_session.deleted_at is null
     and training_session.session_date between effective_from_date and effective_to_date
    where athlete.organization_id = p_organization_id
      and (
        exists (
          select 1
          from public.athlete_group_memberships membership
          where membership.organization_id = p_organization_id
            and membership.group_id = target_group_id
            and membership.athlete_id = athlete.id
        )
        or training_session.id is not null
      )
    group by athlete.id
  ) athlete_rows;

  select coalesce(jsonb_agg(row_data order by session_count desc, last_name, first_name), '[]'::jsonb)
  into trainers_data
  from (
    select
      trainer.first_name,
      trainer.last_name,
      count(distinct training_session.id) as session_count,
      jsonb_build_object(
        'id', trainer.id,
        'first_name', trainer.first_name,
        'last_name', trainer.last_name,
        'is_active', trainer.is_active,
        'session_count', count(distinct training_session.id)
      ) as row_data
    from public.trainers trainer
    left join public.training_session_trainers session_trainer
      on session_trainer.organization_id = trainer.organization_id
     and session_trainer.trainer_id = trainer.id
    left join public.training_sessions training_session
      on training_session.id = session_trainer.session_id
     and training_session.organization_id = session_trainer.organization_id
     and training_session.group_id = target_group_id
     and training_session.deleted_at is null
     and training_session.state = 'scheduled'
     and training_session.session_date between effective_from_date and effective_to_date
    where trainer.organization_id = p_organization_id
    group by trainer.id
    having trainer.is_active or count(training_session.id) > 0
  ) trainer_rows;

  select coalesce(jsonb_agg(row_data order by month_start), '[]'::jsonb)
  into monthly_data
  from (
    select
      date_trunc('month', training_session.session_date)::date as month_start,
      jsonb_build_object(
        'month', to_char(date_trunc('month', training_session.session_date), 'YYYY-MM'),
        'session_count', count(distinct training_session.id),
        'average_present', round(
          avg(
            (
              select count(*)
              from public.training_attendance attendance
              where attendance.organization_id = p_organization_id
                and attendance.session_id = training_session.id
                and attendance.status = 'present'
            )
          ),
          1
        )
      ) as row_data
    from public.training_sessions training_session
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group_id
      and training_session.deleted_at is null
      and training_session.state = 'scheduled'
      and training_session.session_date between effective_from_date and effective_to_date
    group by date_trunc('month', training_session.session_date)
  ) monthly_rows;

  select jsonb_build_object(
    'session_count', count(*),
    'cancelled_count', count(*) filter (where training_session.state = 'cancelled'),
    'average_present', coalesce(round(avg(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 1), 0),
    'max_present', coalesce(max(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 0),
    'unique_present', (
      select count(distinct attendance.athlete_id)
      from public.training_attendance attendance
      join public.training_sessions session_for_attendance
        on session_for_attendance.id = attendance.session_id
       and session_for_attendance.organization_id = attendance.organization_id
      where attendance.organization_id = p_organization_id
        and session_for_attendance.group_id = target_group_id
        and session_for_attendance.deleted_at is null
        and session_for_attendance.state = 'scheduled'
        and session_for_attendance.session_date between effective_from_date and effective_to_date
        and attendance.status = 'present'
    )
  )
  into summary_data
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = target_group_id
    and training_session.deleted_at is null
    and training_session.session_date between effective_from_date and effective_to_date;

  return jsonb_build_object(
    'default_from_date', default_from_date,
    'from_date', effective_from_date,
    'to_date', effective_to_date,
    'summary', summary_data,
    'sessions', sessions_data,
    'athletes', athletes_data,
    'trainers', trainers_data,
    'monthly', monthly_data
  );
end;
$$;

create or replace function public.save_training_module_statistics_default(
  p_organization_id uuid,
  p_module_key text,
  p_from_date date
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null
     or not public.can_edit_training_module_statistics(p_organization_id, p_module_key) then
    raise exception 'Für das Speichern des Statistik-Standards fehlen die Bearbeitungsrechte.';
  end if;

  if p_from_date is null or p_from_date > current_date then
    raise exception 'Das Standard-Von-Datum ist ungültig.';
  end if;

  insert into public.training_module_statistics_settings (
    organization_id,
    module_key,
    default_from,
    updated_by
  ) values (
    p_organization_id,
    p_module_key,
    p_from_date,
    current_user_id
  )
  on conflict (organization_id, module_key) do update set
    default_from = excluded.default_from,
    updated_by = current_user_id;

  return p_from_date;
end;
$$;

revoke all on function public.is_attendance_training_module(text) from public;
revoke all on function public.can_read_training_module(uuid, text) from public;
revoke all on function public.can_edit_training_module(uuid, text) from public;
revoke all on function public.can_read_training_module_statistics(uuid, text) from public;
revoke all on function public.can_edit_training_module_statistics(uuid, text) from public;
revoke all on function public.training_module_configuration_overview(uuid, text) from public;
revoke all on function public.training_module_session_overview(uuid, text, uuid, date) from public;
revoke all on function public.save_training_module_session(uuid, text, uuid, date, public.training_session_state, text, jsonb, uuid[], public.training_environment, timestamptz) from public;
revoke all on function public.delete_training_module_special_session(uuid, text, uuid, date) from public;
revoke all on function public.create_training_module_athlete(uuid, text, text, text, integer, date, boolean) from public;
revoke all on function public.training_module_group_trainer_ids(uuid, text, uuid) from public;
revoke all on function public.training_module_statistics_overview(uuid, text, date, date, integer) from public;
revoke all on function public.save_training_module_statistics_default(uuid, text, date) from public;

grant execute on function public.is_attendance_training_module(text) to authenticated;
grant execute on function public.can_read_training_module(uuid, text) to authenticated;
grant execute on function public.can_edit_training_module(uuid, text) to authenticated;
grant execute on function public.can_read_training_module_statistics(uuid, text) to authenticated;
grant execute on function public.can_edit_training_module_statistics(uuid, text) to authenticated;
grant execute on function public.training_module_configuration_overview(uuid, text) to authenticated;
grant execute on function public.training_module_session_overview(uuid, text, uuid, date) to authenticated;
grant execute on function public.save_training_module_session(uuid, text, uuid, date, public.training_session_state, text, jsonb, uuid[], public.training_environment, timestamptz) to authenticated;
grant execute on function public.delete_training_module_special_session(uuid, text, uuid, date) to authenticated;
grant execute on function public.create_training_module_athlete(uuid, text, text, text, integer, date, boolean) to authenticated;
grant execute on function public.training_module_group_trainer_ids(uuid, text, uuid) to authenticated;
grant execute on function public.training_module_statistics_overview(uuid, text, date, date, integer) to authenticated;
grant execute on function public.save_training_module_statistics_default(uuid, text, date) to authenticated;
