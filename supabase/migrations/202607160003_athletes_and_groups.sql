-- ULC Linz App V2 – gemeinsame Stammdaten für Athleten und Trainingsgruppen.
-- Dieses Modell bildet die Basis für Kindertraining, Leistungsgruppe und Trainingsplanung.

create table public.training_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  short_name text check (short_name is null or char_length(trim(short_name)) between 1 and 20),
  description text check (description is null or char_length(description) <= 1000),
  is_active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index training_groups_org_name_unique
  on public.training_groups (organization_id, lower(trim(name)));

create index training_groups_org_active_idx
  on public.training_groups (organization_id, is_active, sort_order, name);

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  notes text check (notes is null or char_length(notes) <= 3000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create index athletes_org_active_name_idx
  on public.athletes (organization_id, is_active, lower(last_name), lower(first_name));

create index athletes_org_birth_year_idx
  on public.athletes (organization_id, birth_year);

create table public.athlete_group_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null,
  group_id uuid not null,
  started_on date not null default current_date,
  ended_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_group_memberships_dates_check
    check (ended_on is null or ended_on >= started_on),
  constraint athlete_group_memberships_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade,
  constraint athlete_group_memberships_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete cascade
);

create unique index athlete_group_memberships_current_unique
  on public.athlete_group_memberships (athlete_id, group_id)
  where ended_on is null;

create index athlete_group_memberships_athlete_idx
  on public.athlete_group_memberships (organization_id, athlete_id, ended_on);

create index athlete_group_memberships_group_idx
  on public.athlete_group_memberships (organization_id, group_id, ended_on);

create trigger training_groups_set_updated_at
before update on public.training_groups
for each row execute function public.set_updated_at();

create trigger athletes_set_updated_at
before update on public.athletes
for each row execute function public.set_updated_at();

create trigger athlete_group_memberships_set_updated_at
before update on public.athlete_group_memberships
for each row execute function public.set_updated_at();

-- Gemeinsame Leseberechtigung für alle Module, die Athletenstammdaten benötigen.
create or replace function public.can_read_athlete_data(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_module_access(target_organization_id, 'athletes', false)
    or public.has_module_access(target_organization_id, 'kindertraining', false)
    or public.has_module_access(target_organization_id, 'performance_registration', false)
    or public.has_module_access(target_organization_id, 'training_planning', false)
    or public.has_module_access(target_organization_id, 'training_overview', false)
    or public.has_module_access(target_organization_id, 'training_documentation', false);
$$;

create or replace function public.can_edit_athlete_data(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_access(target_organization_id, 'athletes', true);
$$;

-- Liefert Trainingsgruppen inklusive Anzahl aktuell zugeordneter Athleten.
create or replace function public.training_group_overview(
  p_organization_id uuid
)
returns table (
  id uuid,
  name text,
  short_name text,
  description text,
  is_active boolean,
  sort_order integer,
  athlete_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_athlete_data(p_organization_id) then
    raise exception 'Für die Trainingsgruppen fehlen die erforderlichen Rechte.';
  end if;

  return query
  select
    training_group.id,
    training_group.name,
    training_group.short_name,
    training_group.description,
    training_group.is_active,
    training_group.sort_order,
    count(current_membership.id) as athlete_count,
    training_group.created_at,
    training_group.updated_at
  from public.training_groups training_group
  left join public.athlete_group_memberships current_membership
    on current_membership.group_id = training_group.id
   and current_membership.organization_id = training_group.organization_id
   and current_membership.ended_on is null
  where training_group.organization_id = p_organization_id
  group by training_group.id
  order by
    training_group.is_active desc,
    training_group.sort_order,
    lower(training_group.name);
end;
$$;

-- Liefert Athleten inklusive ihrer aktuell zugeordneten Gruppen.
create or replace function public.athlete_overview(
  p_organization_id uuid
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  birth_year smallint,
  notes text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  groups jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_read_athlete_data(p_organization_id) then
    raise exception 'Für die Athletenstammdaten fehlen die erforderlichen Rechte.';
  end if;

  return query
  select
    athlete.id,
    athlete.first_name,
    athlete.last_name,
    athlete.birth_year,
    athlete.notes,
    athlete.is_active,
    athlete.created_at,
    athlete.updated_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', training_group.id,
          'name', training_group.name,
          'short_name', training_group.short_name,
          'is_active', training_group.is_active
        )
        order by training_group.sort_order, lower(training_group.name)
      ) filter (where current_membership.id is not null),
      '[]'::jsonb
    ) as groups
  from public.athletes athlete
  left join public.athlete_group_memberships current_membership
    on current_membership.athlete_id = athlete.id
   and current_membership.organization_id = athlete.organization_id
   and current_membership.ended_on is null
  left join public.training_groups training_group
    on training_group.id = current_membership.group_id
   and training_group.organization_id = current_membership.organization_id
  where athlete.organization_id = p_organization_id
  group by athlete.id
  order by
    athlete.is_active desc,
    lower(athlete.last_name),
    lower(athlete.first_name);
end;
$$;

-- Interne Hilfsfunktion: aktuelle Gruppenzuordnungen atomar ersetzen und Historie erhalten.
create or replace function public.replace_current_athlete_groups(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_group_ids uuid[] := coalesce(
    array(
      select distinct requested_group_id
      from unnest(coalesce(p_group_ids, array[]::uuid[])) requested_group_id
      where requested_group_id is not null
    ),
    array[]::uuid[]
  );
  invalid_group_count integer;
begin
  select count(*)
  into invalid_group_count
  from unnest(normalized_group_ids) requested_group_id
  left join public.training_groups training_group
    on training_group.id = requested_group_id
   and training_group.organization_id = p_organization_id
   and training_group.is_active
  where training_group.id is null;

  if invalid_group_count > 0 then
    raise exception 'Mindestens eine ausgewählte Trainingsgruppe ist ungültig oder deaktiviert.';
  end if;

  update public.athlete_group_memberships current_membership
  set ended_on = greatest(current_membership.started_on, current_date)
  where current_membership.organization_id = p_organization_id
    and current_membership.athlete_id = p_athlete_id
    and current_membership.ended_on is null
    and not (current_membership.group_id = any(normalized_group_ids));

  insert into public.athlete_group_memberships (
    organization_id,
    athlete_id,
    group_id,
    started_on,
    created_by
  )
  select
    p_organization_id,
    p_athlete_id,
    requested_group_id,
    current_date,
    (select auth.uid())
  from unnest(normalized_group_ids) requested_group_id
  where not exists (
    select 1
    from public.athlete_group_memberships current_membership
    where current_membership.organization_id = p_organization_id
      and current_membership.athlete_id = p_athlete_id
      and current_membership.group_id = requested_group_id
      and current_membership.ended_on is null
  );
end;
$$;

create or replace function public.create_training_group(
  p_organization_id uuid,
  p_name text,
  p_short_name text default null,
  p_description text default null,
  p_sort_order integer default 100
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
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Athletenmodul.';
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

  if exists (
    select 1
    from public.training_groups training_group
    where training_group.organization_id = p_organization_id
      and lower(trim(training_group.name)) = lower(normalized_name)
  ) then
    raise exception 'Eine Trainingsgruppe mit diesem Namen existiert bereits.';
  end if;

  insert into public.training_groups (
    organization_id,
    name,
    short_name,
    description,
    sort_order,
    created_by
  ) values (
    p_organization_id,
    normalized_name,
    normalized_short_name,
    normalized_description,
    p_sort_order,
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
      'is_active', true
    )
  );

  return new_group_id;
end;
$$;

create or replace function public.update_training_group(
  p_organization_id uuid,
  p_group_id uuid,
  p_name text,
  p_short_name text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_sort_order integer default 100
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
  old_data jsonb;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Athletenmodul.';
  end if;

  select jsonb_build_object(
    'name', training_group.name,
    'short_name', training_group.short_name,
    'description', training_group.description,
    'sort_order', training_group.sort_order,
    'is_active', training_group.is_active
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

  if exists (
    select 1
    from public.training_groups training_group
    where training_group.organization_id = p_organization_id
      and training_group.id <> p_group_id
      and lower(trim(training_group.name)) = lower(normalized_name)
  ) then
    raise exception 'Eine Trainingsgruppe mit diesem Namen existiert bereits.';
  end if;

  update public.training_groups
  set name = normalized_name,
      short_name = normalized_short_name,
      description = normalized_description,
      is_active = p_is_active,
      sort_order = p_sort_order
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
      'is_active', p_is_active
    )
  );
end;
$$;

create or replace function public.create_athlete(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null,
  p_notes text default null,
  p_group_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_athlete_id uuid;
  normalized_first_name text := trim(coalesce(p_first_name, ''));
  normalized_last_name text := trim(coalesce(p_last_name, ''));
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
  current_year integer := extract(year from current_date)::integer;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Athletenmodul.';
  end if;

  if char_length(normalized_first_name) not between 1 and 80 then
    raise exception 'Der Vorname ist erforderlich und darf höchstens 80 Zeichen lang sein.';
  end if;

  if char_length(normalized_last_name) not between 1 and 80 then
    raise exception 'Der Nachname ist erforderlich und darf höchstens 80 Zeichen lang sein.';
  end if;

  if p_birth_year is not null and p_birth_year not between 1900 and current_year then
    raise exception 'Das Geburtsjahr ist ungültig.';
  end if;

  if normalized_notes is not null and char_length(normalized_notes) > 3000 then
    raise exception 'Die Notiz darf höchstens 3000 Zeichen lang sein.';
  end if;

  insert into public.athletes (
    organization_id,
    first_name,
    last_name,
    birth_year,
    notes,
    created_by
  ) values (
    p_organization_id,
    normalized_first_name,
    normalized_last_name,
    p_birth_year,
    normalized_notes,
    current_user_id
  )
  returning id into new_athlete_id;

  perform public.replace_current_athlete_groups(
    p_organization_id,
    new_athlete_id,
    p_group_ids
  );

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
    'athlete.created',
    'athlete',
    new_athlete_id::text,
    jsonb_build_object(
      'first_name', normalized_first_name,
      'last_name', normalized_last_name,
      'birth_year', p_birth_year,
      'is_active', true,
      'group_ids', to_jsonb(coalesce(p_group_ids, array[]::uuid[]))
    )
  );

  return new_athlete_id;
end;
$$;

create or replace function public.update_athlete(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default array[]::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_first_name text := trim(coalesce(p_first_name, ''));
  normalized_last_name text := trim(coalesce(p_last_name, ''));
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
  current_year integer := extract(year from current_date)::integer;
  old_data jsonb;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Athletenmodul.';
  end if;

  select jsonb_build_object(
    'first_name', athlete.first_name,
    'last_name', athlete.last_name,
    'birth_year', athlete.birth_year,
    'notes', athlete.notes,
    'is_active', athlete.is_active,
    'group_ids', coalesce(
      (
        select jsonb_agg(current_membership.group_id order by current_membership.group_id)
        from public.athlete_group_memberships current_membership
        where current_membership.organization_id = p_organization_id
          and current_membership.athlete_id = p_athlete_id
          and current_membership.ended_on is null
      ),
      '[]'::jsonb
    )
  )
  into old_data
  from public.athletes athlete
  where athlete.id = p_athlete_id
    and athlete.organization_id = p_organization_id;

  if old_data is null then
    raise exception 'Der Athlet wurde nicht gefunden.';
  end if;

  if char_length(normalized_first_name) not between 1 and 80 then
    raise exception 'Der Vorname ist erforderlich und darf höchstens 80 Zeichen lang sein.';
  end if;

  if char_length(normalized_last_name) not between 1 and 80 then
    raise exception 'Der Nachname ist erforderlich und darf höchstens 80 Zeichen lang sein.';
  end if;

  if p_birth_year is not null and p_birth_year not between 1900 and current_year then
    raise exception 'Das Geburtsjahr ist ungültig.';
  end if;

  if normalized_notes is not null and char_length(normalized_notes) > 3000 then
    raise exception 'Die Notiz darf höchstens 3000 Zeichen lang sein.';
  end if;

  update public.athletes
  set first_name = normalized_first_name,
      last_name = normalized_last_name,
      birth_year = p_birth_year,
      notes = normalized_notes,
      is_active = p_is_active
  where id = p_athlete_id
    and organization_id = p_organization_id;

  perform public.replace_current_athlete_groups(
    p_organization_id,
    p_athlete_id,
    p_group_ids
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
    'athlete.updated',
    'athlete',
    p_athlete_id::text,
    old_data,
    jsonb_build_object(
      'first_name', normalized_first_name,
      'last_name', normalized_last_name,
      'birth_year', p_birth_year,
      'notes', normalized_notes,
      'is_active', p_is_active,
      'group_ids', to_jsonb(coalesce(p_group_ids, array[]::uuid[]))
    )
  );
end;
$$;

revoke all on function public.can_read_athlete_data(uuid) from public;
revoke all on function public.can_edit_athlete_data(uuid) from public;
revoke all on function public.training_group_overview(uuid) from public;
revoke all on function public.athlete_overview(uuid) from public;
revoke all on function public.replace_current_athlete_groups(uuid, uuid, uuid[]) from public;
revoke all on function public.create_training_group(uuid, text, text, text, integer) from public;
revoke all on function public.update_training_group(uuid, uuid, text, text, text, boolean, integer) from public;
revoke all on function public.create_athlete(uuid, text, text, integer, text, uuid[]) from public;
revoke all on function public.update_athlete(uuid, uuid, text, text, integer, text, boolean, uuid[]) from public;

grant execute on function public.can_read_athlete_data(uuid) to authenticated;
grant execute on function public.can_edit_athlete_data(uuid) to authenticated;
grant execute on function public.training_group_overview(uuid) to authenticated;
grant execute on function public.athlete_overview(uuid) to authenticated;
grant execute on function public.create_training_group(uuid, text, text, text, integer) to authenticated;
grant execute on function public.update_training_group(uuid, uuid, text, text, text, boolean, integer) to authenticated;
grant execute on function public.create_athlete(uuid, text, text, integer, text, uuid[]) to authenticated;
grant execute on function public.update_athlete(uuid, uuid, text, text, integer, text, boolean, uuid[]) to authenticated;

alter table public.training_groups enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_group_memberships enable row level security;

create policy "training_groups_select_with_shared_access"
on public.training_groups
for select
to authenticated
using (public.can_read_athlete_data(organization_id));

create policy "athletes_select_with_shared_access"
on public.athletes
for select
to authenticated
using (public.can_read_athlete_data(organization_id));

create policy "athlete_group_memberships_select_with_shared_access"
on public.athlete_group_memberships
for select
to authenticated
using (public.can_read_athlete_data(organization_id));

grant select on public.training_groups to authenticated;
grant select on public.athletes to authenticated;
grant select on public.athlete_group_memberships to authenticated;

revoke insert, update, delete on public.training_groups from anon, authenticated;
revoke insert, update, delete on public.athletes from anon, authenticated;
revoke insert, update, delete on public.athlete_group_memberships from anon, authenticated;
