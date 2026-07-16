-- ULC Linz App V2 – technisches Fundament
-- Organisation, Profile, Rollen, Modulrechte und sichere Ersteinrichtung.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'trainer', 'athlete', 'parent');
create type public.membership_status as enum ('invited', 'active', 'disabled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'trainer',
  status public.membership_status not null default 'invited',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx
  on public.organization_members(user_id, status);
create index organization_members_org_idx
  on public.organization_members(organization_id, status);

create table public.app_modules (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  title text not null,
  description text,
  route text not null unique,
  icon text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.member_module_permissions (
  membership_id uuid not null references public.organization_members(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (membership_id, module_key),
  check (not can_edit or can_view)
);

create index member_module_permissions_module_idx
  on public.member_module_permissions(module_key);

insert into public.app_modules (key, title, description, route, icon, sort_order) values
  ('kindertraining', 'Kindertraining', 'Anwesenheit, Notizen und Statistik', '/module/kindertraining', 'users', 10),
  ('athletes', 'Athleten', 'Athleten und Gruppenzuordnungen verwalten', '/module/athletes', 'layout-dashboard', 20),
  ('performance_registration', 'Anmeldung Leistungsgruppe', 'Wochenweise Trainingsanmeldung', '/module/performance_registration', 'calendar-check', 30),
  ('exercise_catalog', 'Übungskatalog', 'Übungen suchen und ansehen', '/module/exercise_catalog', 'book-open', 40),
  ('exercise_management', 'Übungspflege', 'Übungen und Medien verwalten', '/module/exercise_management', 'settings', 50),
  ('training_planning', 'Trainingsplanung', 'Trainingspläne erstellen', '/module/training_planning', 'dumbbell', 60),
  ('training_overview', 'Trainingsplan-Übersicht', 'Pläne und Belastung überblicken', '/module/training_overview', 'list-checks', 70),
  ('training_blocks', 'Trainingsblöcke', 'Wiederverwendbare Vorlagen verwalten', '/module/training_blocks', 'clipboard-check', 80),
  ('training_documentation', 'Trainingsdokumentation', 'Durchführung und Rückmeldung erfassen', '/module/training_documentation', 'dumbbell', 90),
  ('user_management', 'Benutzerverwaltung', 'Benutzer, Rollen und Modulrechte verwalten', '/module/user_management', 'user-round-cog', 100);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

create trigger app_modules_set_updated_at
before update on public.app_modules
for each row execute function public.set_updated_at();

create trigger member_module_permissions_set_updated_at
before update on public.member_module_permissions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_active_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = 'admin'
  );
$$;

create or replace function public.is_app_initialized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organizations);
$$;

create or replace function public.has_module_access(
  target_organization_id uuid,
  target_module_key text,
  require_edit boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and exists (
        select 1
        from public.app_modules module
        where module.key = target_module_key
          and module.is_active
      )
      and (
        membership.role = 'admin'
        or exists (
          select 1
          from public.member_module_permissions permission
          where permission.membership_id = membership.id
            and permission.module_key = target_module_key
            and permission.can_view
            and (not require_edit or permission.can_edit)
        )
      )
  );
$$;

create or replace function public.bootstrap_first_organization(
  p_organization_name text,
  p_organization_slug text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_organization_id uuid;
  new_membership_id uuid;
begin
  if current_user_id is null then
    raise exception 'Für die Ersteinrichtung ist eine Anmeldung erforderlich.';
  end if;

  perform pg_advisory_xact_lock(hashtext('ulc-app-bootstrap'));

  if exists (select 1 from public.organizations) then
    raise exception 'Die Anwendung wurde bereits eingerichtet.';
  end if;

  if char_length(trim(p_organization_name)) < 2 then
    raise exception 'Der Vereinsname ist zu kurz.';
  end if;

  if p_organization_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Die technische Kurzbezeichnung ist ungültig.';
  end if;

  insert into public.organizations (name, slug)
  values (trim(p_organization_name), lower(trim(p_organization_slug)))
  returning id into new_organization_id;

  update public.profiles
  set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = current_user_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    created_by
  ) values (
    new_organization_id,
    current_user_id,
    'admin',
    'active',
    current_user_id
  )
  returning id into new_membership_id;

  insert into public.member_module_permissions (
    membership_id,
    module_key,
    can_view,
    can_edit
  )
  select new_membership_id, module.key, true, true
  from public.app_modules module
  where module.is_active;

  return new_organization_id;
end;
$$;

revoke all on function public.is_active_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.is_app_initialized() from public;
revoke all on function public.has_module_access(uuid, text, boolean) from public;
revoke all on function public.bootstrap_first_organization(text, text, text) from public;

grant execute on function public.is_active_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_app_initialized() to anon, authenticated;
grant execute on function public.has_module_access(uuid, text, boolean) to authenticated;
grant execute on function public.bootstrap_first_organization(text, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.app_modules enable row level security;
alter table public.member_module_permissions enable row level security;

-- Explizite API-Rechte; RLS schränkt anschließend die sichtbaren Zeilen ein.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.app_modules from anon, authenticated;
revoke all on table public.member_module_permissions from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant select on table public.app_modules to authenticated;
grant select, insert, update, delete on table public.member_module_permissions to authenticated;

create policy profiles_select_own_or_org_admin
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members target_membership
    where target_membership.user_id = profiles.id
      and public.is_org_admin(target_membership.organization_id)
  )
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.is_active_org_member(id));

create policy organizations_update_admin
on public.organizations
for update
to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy organization_members_select_own_or_admin
on public.organization_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_admin(organization_id)
);

create policy organization_members_insert_admin
on public.organization_members
for insert
to authenticated
with check (public.is_org_admin(organization_id));

create policy organization_members_update_admin
on public.organization_members
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy organization_members_delete_admin
on public.organization_members
for delete
to authenticated
using (public.is_org_admin(organization_id));

create policy app_modules_select_authenticated
on public.app_modules
for select
to authenticated
using (is_active);

create policy permissions_select_own_or_admin
on public.member_module_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members membership
    where membership.id = member_module_permissions.membership_id
      and (
        membership.user_id = (select auth.uid())
        or public.is_org_admin(membership.organization_id)
      )
  )
);

create policy permissions_insert_admin
on public.member_module_permissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members membership
    where membership.id = member_module_permissions.membership_id
      and public.is_org_admin(membership.organization_id)
  )
);

create policy permissions_update_admin
on public.member_module_permissions
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members membership
    where membership.id = member_module_permissions.membership_id
      and public.is_org_admin(membership.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.organization_members membership
    where membership.id = member_module_permissions.membership_id
      and public.is_org_admin(membership.organization_id)
  )
);

create policy permissions_delete_admin
on public.member_module_permissions
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members membership
    where membership.id = member_module_permissions.membership_id
      and public.is_org_admin(membership.organization_id)
  )
);
