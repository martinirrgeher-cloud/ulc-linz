-- E5c3: Mehrfachverknuepfung von Elternkonten mit Athleten.
-- V3-Speicherungen halten direkte athletes.linked_user_id-Verknuepfungen ausschliesslich bei Athletenkonten.

begin;

create unique index if not exists organization_members_id_organization_unique
  on public.organization_members (id, organization_id);

create table public.organization_member_athlete_links (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null,
  athlete_id uuid not null,
  relation_type text not null check (relation_type in ('self', 'managed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (membership_id, athlete_id),
  constraint organization_member_athlete_links_membership_fk
    foreign key (membership_id, organization_id)
    references public.organization_members(id, organization_id)
    on delete cascade,
  constraint organization_member_athlete_links_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade
);

create index organization_member_athlete_links_org_athlete_idx
  on public.organization_member_athlete_links (organization_id, athlete_id);

create unique index organization_member_athlete_links_single_self_idx
  on public.organization_member_athlete_links (membership_id)
  where relation_type = 'self';

alter table public.organization_member_athlete_links enable row level security;
revoke all on table public.organization_member_athlete_links from public, anon, authenticated;

-- Vorhandene Direktverknuepfungen werden verlustfrei uebernommen. Nur die Rolle
-- Athlet bleibt eine echte Selbstverknuepfung; alle anderen Rollen werden als
-- betreute Athletenbeziehung gespeichert.
insert into public.organization_member_athlete_links (
  organization_id,
  membership_id,
  athlete_id,
  relation_type,
  created_by
)
select
  membership.organization_id,
  membership.id,
  athlete.id,
  case when membership.role = 'athlete' then 'self' else 'managed' end,
  membership.user_id
from public.athletes athlete
join public.organization_members membership
  on membership.organization_id = athlete.organization_id
 and membership.user_id = athlete.linked_user_id
where athlete.linked_user_id is not null
on conflict (membership_id, athlete_id) do update
set relation_type = excluded.relation_type;

-- Der bestehende Audit-Trigger synchronisiert kuenftig die kanonische
-- Selbstverknuepfung eines Athletenkontos mit der neuen Zuordnungstabelle.
create or replace function public.audit_member_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_entity_id uuid;
  v_old_user_id uuid;
  v_new_user_id uuid;
  v_link_key text;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_organization_id := new.organization_id;
    v_entity_id := new.id;
    v_new_user_id := new.linked_user_id;
  elsif tg_op = 'DELETE' then
    v_organization_id := old.organization_id;
    v_entity_id := old.id;
    v_old_user_id := old.linked_user_id;
  else
    v_organization_id := new.organization_id;
    v_entity_id := new.id;
    v_old_user_id := old.linked_user_id;
    v_new_user_id := new.linked_user_id;
  end if;

  if v_old_user_id is not distinct from v_new_user_id then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'athletes' then
    v_link_key := 'athlete_id';
    v_action := 'member.athlete_link_changed';

    if v_old_user_id is not null then
      delete from public.organization_member_athlete_links link
      using public.organization_members membership
      where membership.organization_id = v_organization_id
        and membership.user_id = v_old_user_id
        and link.organization_id = membership.organization_id
        and link.membership_id = membership.id
        and link.athlete_id = v_entity_id;
    end if;

    if v_new_user_id is not null then
      insert into public.organization_member_athlete_links (
        organization_id,
        membership_id,
        athlete_id,
        relation_type,
        created_by
      )
      select
        membership.organization_id,
        membership.id,
        v_entity_id,
        case when membership.role = 'athlete' then 'self' else 'managed' end,
        (select auth.uid())
      from public.organization_members membership
      where membership.organization_id = v_organization_id
        and membership.user_id = v_new_user_id
      on conflict (membership_id, athlete_id) do update
      set relation_type = excluded.relation_type;
    end if;
  elsif tg_table_name = 'trainers' then
    v_link_key := 'trainer_id';
    v_action := 'member.trainer_link_changed';
  else
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Die V3-RPC protokolliert Mehrfach- und Trainerzuordnungen gesammelt.
  -- Die Synchronisation oben bleibt aktiv, doppelte Einzelprotokolle entfallen.
  if coalesce(current_setting('ulc.user_management_v3', true), 'off') = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if v_old_user_id is not null then
    insert into public.audit_log (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    )
    select
      membership.organization_id,
      (select auth.uid()),
      v_action,
      'organization_member',
      membership.id::text,
      jsonb_build_object(v_link_key, v_entity_id),
      jsonb_build_object(v_link_key, null)
    from public.organization_members membership
    where membership.organization_id = v_organization_id
      and membership.user_id = v_old_user_id;

    update public.organization_members membership
    set updated_at = now()
    where membership.organization_id = v_organization_id
      and membership.user_id = v_old_user_id;
  end if;

  if v_new_user_id is not null then
    insert into public.audit_log (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    )
    select
      membership.organization_id,
      (select auth.uid()),
      v_action,
      'organization_member',
      membership.id::text,
      jsonb_build_object(v_link_key, null),
      jsonb_build_object(v_link_key, v_entity_id)
    from public.organization_members membership
    where membership.organization_id = v_organization_id
      and membership.user_id = v_new_user_id;

    update public.organization_members membership
    set updated_at = now()
    where membership.organization_id = v_organization_id
      and membership.user_id = v_new_user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.admin_member_overview_v3(
  p_organization_id uuid
)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  status public.membership_status,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  invitation_last_sent_at timestamptz,
  invitation_send_count integer,
  linked_athletes jsonb,
  linked_trainer_id uuid,
  linked_trainer_name text,
  permissions jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Fuer diese Benutzerverwaltung fehlen die Administratorrechte.';
  end if;

  return query
  select
    membership.id,
    membership.user_id,
    auth_user.email::text,
    profile.display_name,
    membership.role,
    membership.status,
    auth_user.email_confirmed_at,
    auth_user.last_sign_in_at,
    membership.created_at,
    membership.updated_at,
    membership.invitation_last_sent_at,
    membership.invitation_send_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', athlete.id,
            'name', nullif(trim(concat_ws(' ', athlete.first_name, athlete.last_name)), ''),
            'is_active', athlete.is_active,
            'relation_type', link.relation_type
          ) order by athlete.is_active desc, lower(athlete.last_name), lower(athlete.first_name), athlete.id
        )
        from public.organization_member_athlete_links link
        join public.athletes athlete
          on athlete.organization_id = link.organization_id
         and athlete.id = link.athlete_id
        where link.organization_id = membership.organization_id
          and link.membership_id = membership.id
      ),
      '[]'::jsonb
    ),
    trainer.id,
    nullif(trim(concat_ws(' ', trainer.first_name, trainer.last_name)), ''),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'module_key', permission.module_key,
            'can_view', permission.can_view,
            'can_edit', permission.can_edit
          ) order by module.sort_order, permission.module_key
        )
        from public.member_module_permissions permission
        join public.app_modules module on module.key = permission.module_key
        where permission.membership_id = membership.id
      ),
      '[]'::jsonb
    )
  from public.organization_members membership
  join auth.users auth_user on auth_user.id = membership.user_id
  join public.profiles profile on profile.id = membership.user_id
  left join public.trainers trainer
    on trainer.organization_id = membership.organization_id
   and trainer.linked_user_id = membership.user_id
  where membership.organization_id = p_organization_id
  order by
    case membership.status
      when 'active' then 1
      when 'invited' then 2
      else 3
    end,
    lower(profile.display_name),
    lower(auth_user.email);
end;
$$;

create or replace function public.admin_update_organization_member_v3(
  p_organization_id uuid,
  p_membership_id uuid,
  p_display_name text,
  p_role public.app_role,
  p_status public.membership_status,
  p_permissions jsonb,
  p_linked_athlete_ids uuid[],
  p_linked_trainer_id uuid,
  p_lock_token uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_target_user_id uuid;
  v_old_role public.app_role;
  v_old_status public.membership_status;
  v_old_display_name text;
  v_old_permissions jsonb;
  v_new_permissions jsonb;
  v_old_athlete_ids uuid[];
  v_requested_athlete_ids uuid[];
  v_stored_athlete_ids uuid[];
  v_selected_athlete_id uuid;
  v_old_trainer_id uuid;
  v_active_admin_count integer;
  v_updated_at timestamptz;
begin
  if v_current_user_id is null or not public.is_org_admin(p_organization_id) then
    raise exception 'Fuer diese Aenderung fehlen die Administratorrechte.';
  end if;

  perform public.assert_edit_lock_for_write(
    p_organization_id,
    'organization_member',
    p_membership_id,
    p_lock_token,
    p_expected_updated_at
  );

  select
    membership.user_id,
    membership.role,
    membership.status,
    profile.display_name
  into
    v_target_user_id,
    v_old_role,
    v_old_status,
    v_old_display_name
  from public.organization_members membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id;

  if v_target_user_id is null then
    raise exception 'Die Vereinszuordnung wurde nicht gefunden.';
  end if;

  if char_length(coalesce(trim(p_display_name), '')) not between 2 and 120 then
    raise exception 'Der Anzeigename muss zwischen zwei und 120 Zeichen lang sein.';
  end if;

  if v_target_user_id = v_current_user_id
     and (p_role <> 'admin' or p_status <> 'active') then
    raise exception 'Du kannst deine eigene aktive Administratorrolle nicht entfernen.';
  end if;

  if v_old_role = 'admin'
     and v_old_status = 'active'
     and (p_role <> 'admin' or p_status <> 'active') then
    select count(*) into v_active_admin_count
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.role = 'admin'
      and membership.status = 'active';

    if v_active_admin_count <= 1 then
      raise exception 'Der letzte aktive Administrator darf nicht deaktiviert oder herabgestuft werden.';
    end if;
  end if;

  select coalesce(array_agg(distinct selected_id order by selected_id), '{}'::uuid[])
  into v_requested_athlete_ids
  from unnest(coalesce(p_linked_athlete_ids, '{}'::uuid[])) as selected(selected_id)
  where selected_id is not null;

  if p_role not in ('athlete', 'parent') and cardinality(v_requested_athlete_ids) > 0 then
    raise exception 'Direkte Athletenverknuepfungen sind nur fuer Athleten- und Elternkonten vorgesehen.';
  end if;

  if p_role = 'athlete' and cardinality(v_requested_athlete_ids) > 1 then
    raise exception 'Ein Athletenkonto kann nur mit einem Athleten verknuepft werden.';
  end if;

  if exists (
    select 1
    from unnest(v_requested_athlete_ids) as selected(selected_id)
    left join public.athletes athlete
      on athlete.organization_id = p_organization_id
     and athlete.id = selected_id
    where athlete.id is null
       or (
         not athlete.is_active
         and not exists (
           select 1
           from public.organization_member_athlete_links existing_link
           where existing_link.organization_id = p_organization_id
             and existing_link.membership_id = p_membership_id
             and existing_link.athlete_id = selected_id
         )
       )
  ) then
    raise exception 'Mindestens ein ausgewaehlter Athlet wurde nicht gefunden oder ist inaktiv.';
  end if;

  if p_role = 'athlete' and exists (
    select 1
    from unnest(v_requested_athlete_ids) as selected(selected_id)
    join public.athletes athlete
      on athlete.organization_id = p_organization_id
     and athlete.id = selected_id
    where athlete.linked_user_id is not null
      and athlete.linked_user_id <> v_target_user_id
  ) then
    raise exception 'Der ausgewaehlte Athlet ist bereits mit einem anderen Athletenkonto verknuepft.';
  end if;

  if p_linked_trainer_id is not null then
    if not exists (
      select 1
      from public.trainers trainer
      where trainer.organization_id = p_organization_id
        and trainer.id = p_linked_trainer_id
        and (trainer.is_active or trainer.linked_user_id = v_target_user_id)
    ) then
      raise exception 'Der ausgewaehlte Trainer wurde nicht gefunden oder ist inaktiv.';
    end if;

    if exists (
      select 1
      from public.trainers trainer
      where trainer.organization_id = p_organization_id
        and trainer.id = p_linked_trainer_id
        and trainer.linked_user_id is not null
        and trainer.linked_user_id <> v_target_user_id
    ) then
      raise exception 'Der ausgewaehlte Trainer ist bereits mit einem anderen Benutzer verknuepft.';
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'module_key', permission.module_key,
        'can_view', permission.can_view,
        'can_edit', permission.can_edit
      ) order by permission.module_key
    ),
    '[]'::jsonb
  )
  into v_old_permissions
  from public.member_module_permissions permission
  where permission.membership_id = p_membership_id;

  select coalesce(array_agg(link.athlete_id order by link.athlete_id), '{}'::uuid[])
  into v_old_athlete_ids
  from public.organization_member_athlete_links link
  where link.organization_id = p_organization_id
    and link.membership_id = p_membership_id;

  select trainer.id into v_old_trainer_id
  from public.trainers trainer
  where trainer.organization_id = p_organization_id
    and trainer.linked_user_id = v_target_user_id;

  update public.profiles
  set display_name = trim(p_display_name)
  where id = v_target_user_id;

  update public.organization_members membership
  set role = p_role,
      status = p_status
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id;

  perform public.replace_member_permissions(p_membership_id, p_role, p_permissions);

  -- Direkte Stammdaten-Trigger synchronisieren weiterhin die Relationstabelle,
  -- waehrend diese RPC die fachlichen Aenderungen gesammelt protokolliert.
  perform set_config('ulc.user_management_v3', 'on', true);

  if p_role = 'athlete' then
    v_selected_athlete_id := v_requested_athlete_ids[1];

    update public.athletes athlete
    set linked_user_id = null
    where athlete.organization_id = p_organization_id
      and athlete.linked_user_id = v_target_user_id
      and athlete.id is distinct from v_selected_athlete_id;

    if v_selected_athlete_id is not null then
      update public.athletes athlete
      set linked_user_id = v_target_user_id
      where athlete.organization_id = p_organization_id
        and athlete.id = v_selected_athlete_id
        and athlete.linked_user_id is distinct from v_target_user_id;
    end if;

    delete from public.organization_member_athlete_links link
    where link.organization_id = p_organization_id
      and link.membership_id = p_membership_id
      and (
        v_selected_athlete_id is null
        or link.athlete_id is distinct from v_selected_athlete_id
        or link.relation_type <> 'self'
      );

    if v_selected_athlete_id is not null then
      insert into public.organization_member_athlete_links (
        organization_id,
        membership_id,
        athlete_id,
        relation_type,
        created_by
      ) values (
        p_organization_id,
        p_membership_id,
        v_selected_athlete_id,
        'self',
        v_current_user_id
      )
      on conflict (membership_id, athlete_id) do update
      set relation_type = 'self';
    end if;
  elsif p_role = 'parent' then
    update public.athletes athlete
    set linked_user_id = null
    where athlete.organization_id = p_organization_id
      and athlete.linked_user_id = v_target_user_id;

    delete from public.organization_member_athlete_links link
    where link.organization_id = p_organization_id
      and link.membership_id = p_membership_id
      and not (link.athlete_id = any(v_requested_athlete_ids));

    insert into public.organization_member_athlete_links (
      organization_id,
      membership_id,
      athlete_id,
      relation_type,
      created_by
    )
    select
      p_organization_id,
      p_membership_id,
      selected_id,
      'managed',
      v_current_user_id
    from unnest(v_requested_athlete_ids) as selected(selected_id)
    on conflict (membership_id, athlete_id) do update
    set relation_type = 'managed';
  else
    update public.athletes athlete
    set linked_user_id = null
    where athlete.organization_id = p_organization_id
      and athlete.linked_user_id = v_target_user_id;

    delete from public.organization_member_athlete_links link
    where link.organization_id = p_organization_id
      and link.membership_id = p_membership_id;
  end if;

  update public.trainers trainer
  set linked_user_id = null
  where trainer.organization_id = p_organization_id
    and trainer.linked_user_id = v_target_user_id
    and trainer.id is distinct from p_linked_trainer_id;

  if p_linked_trainer_id is not null then
    update public.trainers trainer
    set linked_user_id = v_target_user_id
    where trainer.organization_id = p_organization_id
      and trainer.id = p_linked_trainer_id
      and trainer.linked_user_id is distinct from v_target_user_id;
  end if;

  perform set_config('ulc.user_management_v3', 'off', true);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'module_key', permission.module_key,
        'can_view', permission.can_view,
        'can_edit', permission.can_edit
      ) order by permission.module_key
    ),
    '[]'::jsonb
  )
  into v_new_permissions
  from public.member_module_permissions permission
  where permission.membership_id = p_membership_id;

  select coalesce(array_agg(link.athlete_id order by link.athlete_id), '{}'::uuid[])
  into v_stored_athlete_ids
  from public.organization_member_athlete_links link
  where link.organization_id = p_organization_id
    and link.membership_id = p_membership_id;

  if v_old_role is distinct from p_role
     or v_old_status is distinct from p_status
     or v_old_permissions is distinct from v_new_permissions
     or v_old_display_name is distinct from trim(p_display_name) then
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
      v_current_user_id,
      'member.updated',
      'organization_member',
      p_membership_id::text,
      jsonb_build_object(
        'role', v_old_role,
        'status', v_old_status,
        'permissions', v_old_permissions,
        'display_name_changed', false
      ),
      jsonb_build_object(
        'role', p_role,
        'status', p_status,
        'permissions', v_new_permissions,
        'display_name_changed', v_old_display_name is distinct from trim(p_display_name)
      )
    );
  end if;

  if v_old_athlete_ids is distinct from v_stored_athlete_ids then
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
      v_current_user_id,
      'member.athlete_links_changed',
      'organization_member',
      p_membership_id::text,
      jsonb_build_object('athlete_ids', to_jsonb(v_old_athlete_ids)),
      jsonb_build_object('athlete_ids', to_jsonb(v_stored_athlete_ids))
    );
  end if;

  if v_old_trainer_id is distinct from p_linked_trainer_id then
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
      v_current_user_id,
      'member.trainer_link_changed',
      'organization_member',
      p_membership_id::text,
      jsonb_build_object('trainer_id', v_old_trainer_id),
      jsonb_build_object('trainer_id', p_linked_trainer_id)
    );
  end if;

  select membership.updated_at into v_updated_at
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id;

  return jsonb_build_object(
    'id', p_membership_id,
    'updated_at', v_updated_at,
    'linked_athlete_ids', to_jsonb(v_stored_athlete_ids),
    'linked_trainer_id', p_linked_trainer_id
  );
end;
$$;

revoke all on function public.admin_member_overview_v3(uuid) from public;
revoke all on function public.admin_update_organization_member_v3(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid[], uuid, uuid, timestamptz) from public;

grant execute on function public.admin_member_overview_v3(uuid) to authenticated;
grant execute on function public.admin_update_organization_member_v3(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid[], uuid, uuid, timestamptz) to authenticated;

commit;
