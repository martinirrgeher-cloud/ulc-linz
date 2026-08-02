-- E5c: Erweiterte Benutzerverwaltung.
-- Einladungsstatus, Rechtevorlagen-Unterstuetzung, Verknuepfungen,
-- Auditprotokoll, Bearbeitungssperren und Realtime-Abgleich.

begin;

alter table public.organization_members
  add column if not exists invitation_last_sent_at timestamptz,
  add column if not exists invitation_send_count integer not null default 0;

alter table public.organization_members
  drop constraint if exists organization_members_invitation_send_count_check;

alter table public.organization_members
  add constraint organization_members_invitation_send_count_check
  check (invitation_send_count >= 0);

-- Bereits von Supabase Auth versendete Einladungen werden nicht faelschlich als
-- "noch nicht versendet" angezeigt. Auth-Einladungen besitzen invited_at.
update public.organization_members membership
set invitation_last_sent_at = auth_user.invited_at,
    invitation_send_count = 1
from auth.users auth_user
where auth_user.id = membership.user_id
  and auth_user.invited_at is not null
  and membership.invitation_last_sent_at is null
  and membership.invitation_send_count = 0;

alter table public.edit_locks
  drop constraint if exists edit_locks_entity_type_check;

alter table public.edit_locks
  add constraint edit_locks_entity_type_check
  check (entity_type in (
    'exercise',
    'training_block',
    'athlete',
    'training_plan',
    'training_documentation',
    'training_group',
    'trainer',
    'organization_member'
  ));

create or replace function public.edit_lock_module_key(p_entity_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_entity_type
    when 'exercise' then 'exercise_catalog'
    when 'training_block' then 'training_blocks'
    when 'athlete' then 'athletes'
    when 'training_plan' then 'training_planning'
    when 'training_documentation' then 'training_documentation'
    when 'training_group' then 'athletes'
    when 'trainer' then 'athletes'
    when 'organization_member' then 'user_management'
    else null
  end;
$$;

create or replace function public.edit_lock_record_version(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  case p_entity_type
    when 'exercise' then
      select item.updated_at into v_updated_at
      from public.exercises item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'training_block' then
      select item.updated_at into v_updated_at
      from public.training_blocks item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'athlete' then
      select item.updated_at into v_updated_at
      from public.athletes item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'training_plan' then
      select item.updated_at into v_updated_at
      from public.athlete_training_plans item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'training_documentation' then
      select item.updated_at into v_updated_at
      from public.athlete_training_sessions item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'training_group' then
      select item.updated_at into v_updated_at
      from public.training_groups item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'trainer' then
      select item.updated_at into v_updated_at
      from public.trainers item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'organization_member' then
      select item.updated_at into v_updated_at
      from public.organization_members item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    else
      raise exception 'Dieser Datensatztyp unterstuetzt keine Bearbeitungssperre.';
  end case;

  if v_updated_at is null then
    raise exception 'Der Datensatz wurde nicht gefunden oder bereits geloescht.';
  end if;

  return v_updated_at;
end;
$$;

create or replace function public.assert_edit_lock_for_write(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_lock_token uuid,
  p_expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lock public.edit_locks%rowtype;
  v_version timestamptz;
begin
  if v_user_id is null then
    raise exception 'Fuer die Bearbeitung ist eine Anmeldung erforderlich.';
  end if;

  if p_lock_token is null then
    raise exception 'Die Bearbeitungsreservierung fehlt. Bitte Datensatz neu oeffnen.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Die Datensatzversion fehlt. Bitte Datensatz neu laden.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' || p_entity_type || ':' || p_entity_id::text,
      0
    )
  );

  select lock_row.*
  into v_lock
  from public.edit_locks lock_row
  where lock_row.organization_id = p_organization_id
    and lock_row.entity_type = p_entity_type
    and lock_row.entity_id = p_entity_id
  for update;

  if v_lock.entity_id is null
     or v_lock.lock_token <> p_lock_token
     or v_lock.locked_by_user_id <> v_user_id
     or v_lock.expires_at <= now() then
    raise exception 'Die Bearbeitungsreservierung ist abgelaufen oder wurde uebernommen. Bitte Datensatz neu oeffnen.';
  end if;

  case p_entity_type
    when 'exercise' then
      select item.updated_at into v_version
      from public.exercises item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    when 'training_block' then
      select item.updated_at into v_version
      from public.training_blocks item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    when 'athlete' then
      select item.updated_at into v_version
      from public.athletes item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    when 'training_plan' then
      select item.updated_at into v_version
      from public.athlete_training_plans item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    when 'training_documentation' then
      select item.updated_at into v_version
      from public.athlete_training_sessions item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    when 'training_group' then
      select item.updated_at into v_version
      from public.training_groups item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    when 'trainer' then
      select item.updated_at into v_version
      from public.trainers item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    when 'organization_member' then
      select item.updated_at into v_version
      from public.organization_members item
      where item.organization_id = p_organization_id and item.id = p_entity_id
      for update;
    else
      raise exception 'Dieser Datensatztyp unterstuetzt keine Bearbeitungssperre.';
  end case;

  if v_version is null then
    raise exception 'Der Datensatz wurde nicht gefunden oder bereits geloescht.';
  end if;

  if abs(extract(epoch from (v_version - p_expected_updated_at))) > 0.001 then
    raise exception 'Der Datensatz wurde seit dem Oeffnen veraendert. Bitte neu laden, damit keine Aenderungen ueberschrieben werden.';
  end if;

  return v_version;
end;
$$;

-- Entfernt aus alten V1-Protokolleintraegen nicht benoetigte personenbezogene Daten.
update public.audit_log
set before_data = case
      when before_data is null then null
      else before_data - 'display_name' - 'user_id' - 'email'
    end,
    after_data = case
      when after_data is null then null
      else after_data - 'display_name' - 'user_id' - 'email'
    end
where entity_type = 'organization_member';

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
  elsif tg_table_name = 'trainers' then
    v_link_key := 'trainer_id';
    v_action := 'member.trainer_link_changed';
  else
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

drop trigger if exists athletes_audit_member_link_change on public.athletes;
create trigger athletes_audit_member_link_change
after insert or update or delete on public.athletes
for each row execute function public.audit_member_link_change();

drop trigger if exists trainers_audit_member_link_change on public.trainers;
create trigger trainers_audit_member_link_change
after insert or update or delete on public.trainers
for each row execute function public.audit_member_link_change();

create or replace function public.activate_current_memberships()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_email_is_confirmed boolean := false;
  v_membership record;
  v_affected_rows integer := 0;
begin
  if v_current_user_id is null then
    return 0;
  end if;

  select auth_user.email_confirmed_at is not null
  into v_email_is_confirmed
  from auth.users auth_user
  where auth_user.id = v_current_user_id;

  if not coalesce(v_email_is_confirmed, false) then
    return 0;
  end if;

  for v_membership in
    update public.organization_members membership
    set status = 'active'
    where membership.user_id = v_current_user_id
      and membership.status = 'invited'
    returning membership.id, membership.organization_id
  loop
    v_affected_rows := v_affected_rows + 1;

    insert into public.audit_log (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    ) values (
      v_membership.organization_id,
      v_current_user_id,
      'member.invitation_accepted',
      'organization_member',
      v_membership.id::text,
      jsonb_build_object('status', 'invited'),
      jsonb_build_object('status', 'active')
    );
  end loop;

  return v_affected_rows;
end;
$$;

create or replace function public.admin_member_overview_v2(
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
  linked_athlete_id uuid,
  linked_athlete_name text,
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
    athlete.id,
    nullif(trim(concat_ws(' ', athlete.first_name, athlete.last_name)), ''),
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
  left join public.athletes athlete
    on athlete.organization_id = membership.organization_id
   and athlete.linked_user_id = membership.user_id
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

create or replace function public.admin_member_link_options(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Fuer diese Benutzerverwaltung fehlen die Administratorrechte.';
  end if;

  return jsonb_build_object(
    'athletes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', athlete.id,
            'name', trim(concat_ws(' ', athlete.first_name, athlete.last_name)),
            'is_active', athlete.is_active,
            'linked_user_id', athlete.linked_user_id
          ) order by athlete.is_active desc, lower(athlete.last_name), lower(athlete.first_name)
        )
        from public.athletes athlete
        where athlete.organization_id = p_organization_id
      ),
      '[]'::jsonb
    ),
    'trainers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', trainer.id,
            'name', trim(concat_ws(' ', trainer.first_name, trainer.last_name)),
            'is_active', trainer.is_active,
            'linked_user_id', trainer.linked_user_id
          ) order by trainer.is_active desc, lower(trainer.last_name), lower(trainer.first_name)
        )
        from public.trainers trainer
        where trainer.organization_id = p_organization_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.admin_member_audit_overview(
  p_organization_id uuid,
  p_membership_id uuid
)
returns table (
  audit_id bigint,
  actor_display_name text,
  action text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Fuer dieses Aenderungsprotokoll fehlen die Administratorrechte.';
  end if;

  if not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.id = p_membership_id
  ) then
    raise exception 'Die Vereinszuordnung wurde nicht gefunden.';
  end if;

  return query
  select
    audit.id,
    coalesce(nullif(trim(actor_profile.display_name), ''), 'System'),
    audit.action,
    audit.before_data,
    audit.after_data,
    audit.created_at
  from public.audit_log audit
  left join public.profiles actor_profile on actor_profile.id = audit.actor_user_id
  where audit.organization_id = p_organization_id
    and audit.entity_type = 'organization_member'
    and audit.entity_id = p_membership_id::text
  order by audit.created_at desc, audit.id desc
  limit 100;
end;
$$;

create or replace function public.provision_organization_member_v2(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_role public.app_role,
  p_status public.membership_status,
  p_permissions jsonb,
  p_created_by uuid,
  p_invitation_sent_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id uuid;
  v_permissions jsonb;
begin
  if not exists (
    select 1 from public.organizations organization
    where organization.id = p_organization_id
      and organization.is_active
  ) then
    raise exception 'Der Verein wurde nicht gefunden oder ist deaktiviert.';
  end if;

  if not exists (select 1 from auth.users auth_user where auth_user.id = p_user_id) then
    raise exception 'Der Benutzer wurde in Supabase Auth nicht gefunden.';
  end if;

  if char_length(coalesce(trim(p_display_name), '')) not between 2 and 120 then
    raise exception 'Der Anzeigename muss zwischen zwei und 120 Zeichen lang sein.';
  end if;

  if exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
  ) then
    raise exception 'Dieser Benutzer ist dem Verein bereits zugeordnet.';
  end if;

  if not exists (
    select 1
    from public.organization_members actor_membership
    where actor_membership.organization_id = p_organization_id
      and actor_membership.user_id = p_created_by
      and actor_membership.role = 'admin'
      and actor_membership.status = 'active'
  ) then
    raise exception 'Der ausfuehrende Benutzer ist kein aktiver Administrator.';
  end if;

  update public.profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = p_user_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    created_by,
    invitation_last_sent_at,
    invitation_send_count
  ) values (
    p_organization_id,
    p_user_id,
    p_role,
    p_status,
    p_created_by,
    p_invitation_sent_at,
    case when p_invitation_sent_at is null then 0 else 1 end
  )
  returning id into v_membership_id;

  perform public.replace_member_permissions(v_membership_id, p_role, p_permissions);

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
  into v_permissions
  from public.member_module_permissions permission
  where permission.membership_id = v_membership_id;

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
    p_created_by,
    'member.created',
    'organization_member',
    v_membership_id::text,
    null,
    jsonb_build_object(
      'role', p_role,
      'status', p_status,
      'permissions', v_permissions
    )
  );

  if p_invitation_sent_at is not null then
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
      p_created_by,
      'member.invitation_sent',
      'organization_member',
      v_membership_id::text,
      null,
      jsonb_build_object(
        'sent_at', p_invitation_sent_at,
        'send_count', 1
      )
    );
  end if;

  return v_membership_id;
end;
$$;

create or replace function public.admin_member_invitation_target(
  p_organization_id uuid,
  p_membership_id uuid,
  p_actor_user_id uuid
)
returns table (
  user_id uuid,
  email text,
  status public.membership_status,
  email_confirmed_at timestamptz,
  invitation_last_sent_at timestamptz,
  invitation_send_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organization_members actor_membership
    where actor_membership.organization_id = p_organization_id
      and actor_membership.user_id = p_actor_user_id
      and actor_membership.role = 'admin'
      and actor_membership.status = 'active'
  ) then
    raise exception 'Der ausfuehrende Benutzer ist kein aktiver Administrator.';
  end if;

  return query
  select
    membership.user_id,
    auth_user.email::text,
    membership.status,
    auth_user.email_confirmed_at,
    membership.invitation_last_sent_at,
    membership.invitation_send_count
  from public.organization_members membership
  join auth.users auth_user on auth_user.id = membership.user_id
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id;
end;
$$;

create or replace function public.record_member_invitation_sent(
  p_organization_id uuid,
  p_membership_id uuid,
  p_actor_user_id uuid,
  p_is_resend boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sent_at timestamptz := now();
  v_send_count integer;
begin
  if not exists (
    select 1
    from public.organization_members actor_membership
    where actor_membership.organization_id = p_organization_id
      and actor_membership.user_id = p_actor_user_id
      and actor_membership.role = 'admin'
      and actor_membership.status = 'active'
  ) then
    raise exception 'Der ausfuehrende Benutzer ist kein aktiver Administrator.';
  end if;

  update public.organization_members membership
  set invitation_last_sent_at = v_sent_at,
      invitation_send_count = membership.invitation_send_count + 1
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id
    and membership.status = 'invited'
  returning membership.invitation_send_count into v_send_count;

  if v_send_count is null then
    raise exception 'Die offene Einladung wurde nicht gefunden.';
  end if;

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
    p_actor_user_id,
    case when p_is_resend then 'member.invitation_resent' else 'member.invitation_sent' end,
    'organization_member',
    p_membership_id::text,
    null,
    jsonb_build_object(
      'sent_at', v_sent_at,
      'send_count', v_send_count
    )
  );

  return jsonb_build_object(
    'sent_at', v_sent_at,
    'send_count', v_send_count
  );
end;
$$;

create or replace function public.admin_update_organization_member_v2(
  p_organization_id uuid,
  p_membership_id uuid,
  p_display_name text,
  p_role public.app_role,
  p_status public.membership_status,
  p_permissions jsonb,
  p_linked_athlete_id uuid,
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
  v_old_athlete_id uuid;
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

  select athlete.id into v_old_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_target_user_id;

  select trainer.id into v_old_trainer_id
  from public.trainers trainer
  where trainer.organization_id = p_organization_id
    and trainer.linked_user_id = v_target_user_id;

  if p_linked_athlete_id is not null then
    if not exists (
      select 1
      from public.athletes athlete
      where athlete.organization_id = p_organization_id
        and athlete.id = p_linked_athlete_id
        and (athlete.is_active or athlete.linked_user_id = v_target_user_id)
    ) then
      raise exception 'Der ausgewaehlte Athlet wurde nicht gefunden oder ist inaktiv.';
    end if;

    if exists (
      select 1
      from public.athletes athlete
      where athlete.organization_id = p_organization_id
        and athlete.id = p_linked_athlete_id
        and athlete.linked_user_id is not null
        and athlete.linked_user_id <> v_target_user_id
    ) then
      raise exception 'Der ausgewaehlte Athlet ist bereits mit einem anderen Benutzer verknuepft.';
    end if;
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

  update public.profiles
  set display_name = trim(p_display_name)
  where id = v_target_user_id;

  update public.organization_members membership
  set role = p_role,
      status = p_status
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id;

  perform public.replace_member_permissions(p_membership_id, p_role, p_permissions);

  update public.athletes athlete
  set linked_user_id = null
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_target_user_id
    and athlete.id is distinct from p_linked_athlete_id;

  if p_linked_athlete_id is not null then
    update public.athletes athlete
    set linked_user_id = v_target_user_id
    where athlete.organization_id = p_organization_id
      and athlete.id = p_linked_athlete_id
      and athlete.linked_user_id is distinct from v_target_user_id;
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

  select membership.updated_at into v_updated_at
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.id = p_membership_id;

  return jsonb_build_object(
    'id', p_membership_id,
    'updated_at', v_updated_at,
    'linked_athlete_id', p_linked_athlete_id,
    'linked_trainer_id', p_linked_trainer_id
  );
end;
$$;

-- Benutzerlisten und Audit reagieren wie die anderen gemeinsam bearbeiteten Bereiche in Echtzeit.
do $$
declare
  v_table text;
  v_tables constant text[] := array['organization_members', 'audit_log'];
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Die Supabase-Realtime-Publication fehlt.';
  end if;

  foreach v_table in array v_tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;

    execute format('alter table public.%I replica identity full', v_table);
  end loop;
end;
$$;

revoke all on function public.audit_member_link_change() from public;
revoke all on function public.admin_member_overview_v2(uuid) from public;
revoke all on function public.admin_member_link_options(uuid) from public;
revoke all on function public.admin_member_audit_overview(uuid, uuid) from public;
revoke all on function public.provision_organization_member_v2(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid, timestamptz) from public;
revoke all on function public.admin_member_invitation_target(uuid, uuid, uuid) from public;
revoke all on function public.record_member_invitation_sent(uuid, uuid, uuid, boolean) from public;
revoke all on function public.admin_update_organization_member_v2(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid, uuid, uuid, timestamptz) from public;

grant execute on function public.admin_member_overview_v2(uuid) to authenticated;
grant execute on function public.admin_member_link_options(uuid) to authenticated;
grant execute on function public.admin_member_audit_overview(uuid, uuid) to authenticated;
grant execute on function public.admin_update_organization_member_v2(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.provision_organization_member_v2(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid, timestamptz) to service_role;
grant execute on function public.admin_member_invitation_target(uuid, uuid, uuid) to service_role;
grant execute on function public.record_member_invitation_sent(uuid, uuid, uuid, boolean) to service_role;

commit;
