-- ULC Linz App V2 – Benutzerverwaltung V1
-- Sichere Einladungen, Mitgliederübersicht, Rollen, Status und Modulrechte.

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(trim(action)) between 2 and 80),
  entity_type text not null check (char_length(trim(entity_type)) between 2 and 80),
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_created_idx
  on public.audit_log(organization_id, created_at desc);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

create policy audit_log_select_admin
on public.audit_log
for select
to authenticated
using (public.is_org_admin(organization_id));

-- Eingeladene Benutzer werden beim ersten bestätigten Login automatisch aktiviert.
create or replace function public.activate_current_memberships()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  email_is_confirmed boolean := false;
  affected_rows integer := 0;
begin
  if current_user_id is null then
    return 0;
  end if;

  select auth_user.email_confirmed_at is not null
  into email_is_confirmed
  from auth.users auth_user
  where auth_user.id = current_user_id;

  if not coalesce(email_is_confirmed, false) then
    return 0;
  end if;

  update public.organization_members
  set status = 'active'
  where user_id = current_user_id
    and status = 'invited';

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

-- Liefert die vollständige Benutzerliste eines Vereins nur für Administratoren.
create or replace function public.admin_member_overview(
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
  permissions jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Für diese Benutzerverwaltung fehlen die Administratorrechte.';
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
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'module_key', permission.module_key,
          'can_view', permission.can_view,
          'can_edit', permission.can_edit
        ) order by module.sort_order
      ) filter (where permission.module_key is not null),
      '[]'::jsonb
    ) as permissions
  from public.organization_members membership
  join auth.users auth_user
    on auth_user.id = membership.user_id
  join public.profiles profile
    on profile.id = membership.user_id
  left join public.member_module_permissions permission
    on permission.membership_id = membership.id
  left join public.app_modules module
    on module.key = permission.module_key
  where membership.organization_id = p_organization_id
  group by
    membership.id,
    membership.user_id,
    auth_user.email,
    profile.display_name,
    membership.role,
    membership.status,
    auth_user.email_confirmed_at,
    auth_user.last_sign_in_at,
    membership.created_at
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

-- Interne Hilfsfunktion zum einheitlichen Setzen der Modulrechte.
create or replace function public.replace_member_permissions(
  p_membership_id uuid,
  p_role public.app_role,
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_module_permissions
  where membership_id = p_membership_id;

  if p_role = 'admin' then
    insert into public.member_module_permissions (
      membership_id,
      module_key,
      can_view,
      can_edit
    )
    select p_membership_id, module.key, true, true
    from public.app_modules module
    where module.is_active;

    return;
  end if;

  insert into public.member_module_permissions (
    membership_id,
    module_key,
    can_view,
    can_edit
  )
  select
    p_membership_id,
    module.key,
    coalesce((permission_item ->> 'can_view')::boolean, false)
      or coalesce((permission_item ->> 'can_edit')::boolean, false),
    coalesce((permission_item ->> 'can_edit')::boolean, false)
  from jsonb_array_elements(coalesce(p_permissions, '[]'::jsonb)) permission_item
  join public.app_modules module
    on module.key = permission_item ->> 'module_key'
  where module.is_active
    and module.key <> 'user_management'
    and (
      coalesce((permission_item ->> 'can_view')::boolean, false)
      or coalesce((permission_item ->> 'can_edit')::boolean, false)
    )
  on conflict (membership_id, module_key)
  do update set
    can_view = excluded.can_view,
    can_edit = excluded.can_edit;
end;
$$;

-- Wird ausschließlich von der Edge Function mit Secret Key aufgerufen.
create or replace function public.provision_organization_member(
  p_organization_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_role public.app_role,
  p_status public.membership_status,
  p_permissions jsonb,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership_id uuid;
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
    from public.organization_members existing_membership
    where existing_membership.organization_id = p_organization_id
      and existing_membership.user_id = p_user_id
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
    raise exception 'Der ausführende Benutzer ist kein aktiver Administrator.';
  end if;

  update public.profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = p_user_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    created_by
  ) values (
    p_organization_id,
    p_user_id,
    p_role,
    p_status,
    p_created_by
  )
  returning id into target_membership_id;

  perform public.replace_member_permissions(
    target_membership_id,
    p_role,
    p_permissions
  );

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
    case when p_status = 'invited' then 'member.invited' else 'member.added' end,
    'organization_member',
    target_membership_id::text,
    null,
    jsonb_build_object(
      'user_id', p_user_id,
      'role', p_role,
      'status', p_status,
      'display_name', trim(p_display_name)
    )
  );

  return target_membership_id;
end;
$$;

-- Atomische Änderung durch einen angemeldeten Vereinsadministrator.
create or replace function public.admin_update_organization_member(
  p_organization_id uuid,
  p_membership_id uuid,
  p_display_name text,
  p_role public.app_role,
  p_status public.membership_status,
  p_permissions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_user_id uuid;
  old_role public.app_role;
  old_status public.membership_status;
  active_admin_count integer;
  old_data jsonb;
begin
  if current_user_id is null or not public.is_org_admin(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Administratorrechte.';
  end if;

  select
    membership.user_id,
    membership.role,
    membership.status,
    jsonb_build_object(
      'display_name', profile.display_name,
      'role', membership.role,
      'status', membership.status
    )
  into target_user_id, old_role, old_status, old_data
  from public.organization_members membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.id = p_membership_id
    and membership.organization_id = p_organization_id;

  if target_user_id is null then
    raise exception 'Die Vereinszuordnung wurde nicht gefunden.';
  end if;

  if char_length(coalesce(trim(p_display_name), '')) not between 2 and 120 then
    raise exception 'Der Anzeigename muss zwischen zwei und 120 Zeichen lang sein.';
  end if;

  if target_user_id = current_user_id
     and (p_role <> 'admin' or p_status <> 'active') then
    raise exception 'Du kannst deine eigene aktive Administratorrolle nicht entfernen.';
  end if;

  if old_role = 'admin'
     and old_status = 'active'
     and (p_role <> 'admin' or p_status <> 'active') then
    select count(*)
    into active_admin_count
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.role = 'admin'
      and membership.status = 'active';

    if active_admin_count <= 1 then
      raise exception 'Der letzte aktive Administrator darf nicht deaktiviert oder herabgestuft werden.';
    end if;
  end if;

  update public.profiles
  set display_name = trim(p_display_name)
  where id = target_user_id;

  update public.organization_members
  set role = p_role,
      status = p_status
  where id = p_membership_id;

  perform public.replace_member_permissions(
    p_membership_id,
    p_role,
    p_permissions
  );

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
    'member.updated',
    'organization_member',
    p_membership_id::text,
    old_data,
    jsonb_build_object(
      'display_name', trim(p_display_name),
      'role', p_role,
      'status', p_status
    )
  );
end;
$$;

revoke all on function public.activate_current_memberships() from public;
revoke all on function public.admin_member_overview(uuid) from public;
revoke all on function public.replace_member_permissions(uuid, public.app_role, jsonb) from public;
revoke all on function public.provision_organization_member(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid) from public;
revoke all on function public.admin_update_organization_member(uuid, uuid, text, public.app_role, public.membership_status, jsonb) from public;

grant execute on function public.activate_current_memberships() to authenticated;
grant execute on function public.admin_member_overview(uuid) to authenticated;
grant execute on function public.admin_update_organization_member(uuid, uuid, text, public.app_role, public.membership_status, jsonb) to authenticated;
grant execute on function public.provision_organization_member(uuid, uuid, text, public.app_role, public.membership_status, jsonb, uuid) to service_role;

-- Schreibzugriff auf Mitglieder und Rechte nur mehr über kontrollierte RPCs.
revoke insert, update, delete on table public.organization_members from authenticated;
revoke insert, update, delete on table public.member_module_permissions from authenticated;
