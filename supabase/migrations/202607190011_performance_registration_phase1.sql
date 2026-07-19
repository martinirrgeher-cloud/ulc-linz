-- ULC Linz App – Leistungsgruppen Phase 1
-- Trainingsanmeldung, Standardwoche, Traineranwesenheit und Wochenübersicht.

begin;

update public.app_modules
set title = 'Leistungsgruppen',
    description = 'Trainingsanmeldung und Wochenübersicht',
    route = '/module/performance_registration',
    icon = 'calendar-check',
    is_active = true
where key = 'performance_registration';

do $$
begin
  create type public.performance_availability_status as enum (
    'coming',
    'maybe',
    'unavailable'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.athletes
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists athletes_org_linked_user_unique
  on public.athletes (organization_id, linked_user_id)
  where linked_user_id is not null;

create table public.performance_group_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  registration_deadline_weekday smallint not null default 7
    check (registration_deadline_weekday between 1 and 7),
  registration_deadline_time time not null default '18:00',
  weeks_ahead smallint not null default 4 check (weeks_ahead between 1 and 12),
  allow_late_registration boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, group_id),
  constraint performance_group_settings_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete cascade
);

create table public.athlete_availability_defaults (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  athlete_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  status public.performance_availability_status not null,
  available_from time,
  available_until time,
  comment text check (comment is null or char_length(comment) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, athlete_id, weekday),
  constraint athlete_availability_defaults_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete cascade,
  constraint athlete_availability_defaults_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade,
  constraint athlete_availability_defaults_times_check
    check (available_from is null or available_until is null or available_from <= available_until)
);

create table public.performance_athlete_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  athlete_id uuid not null,
  training_date date not null,
  status public.performance_availability_status not null,
  available_from time,
  available_until time,
  comment text check (comment is null or char_length(comment) <= 500),
  source text not null default 'self'
    check (source in ('self', 'trainer', 'default', 'copy')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, athlete_id, training_date),
  constraint performance_athlete_availability_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete cascade,
  constraint performance_athlete_availability_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade,
  constraint performance_athlete_availability_times_check
    check (available_from is null or available_until is null or available_from <= available_until)
);

create index performance_athlete_availability_week_idx
  on public.performance_athlete_availability (organization_id, group_id, training_date, status);

create index performance_athlete_availability_athlete_idx
  on public.performance_athlete_availability (organization_id, athlete_id, training_date desc);

create table public.performance_trainer_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  trainer_id uuid not null,
  training_date date not null,
  status public.performance_availability_status not null,
  available_from time,
  available_until time,
  comment text check (comment is null or char_length(comment) <= 500),
  source text not null default 'self'
    check (source in ('self', 'trainer')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, trainer_id, training_date),
  constraint performance_trainer_availability_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete cascade,
  constraint performance_trainer_availability_trainer_fk
    foreign key (trainer_id, organization_id)
    references public.trainers(id, organization_id)
    on delete cascade,
  constraint performance_trainer_availability_times_check
    check (available_from is null or available_until is null or available_from <= available_until)
);

create index performance_trainer_availability_week_idx
  on public.performance_trainer_availability (organization_id, group_id, training_date, status);

create trigger performance_group_settings_set_updated_at
before update on public.performance_group_settings
for each row execute function public.set_updated_at();

create trigger athlete_availability_defaults_set_updated_at
before update on public.athlete_availability_defaults
for each row execute function public.set_updated_at();

create trigger performance_athlete_availability_set_updated_at
before update on public.performance_athlete_availability
for each row execute function public.set_updated_at();

create trigger performance_trainer_availability_set_updated_at
before update on public.performance_trainer_availability
for each row execute function public.set_updated_at();

alter table public.performance_group_settings enable row level security;
alter table public.athlete_availability_defaults enable row level security;
alter table public.performance_athlete_availability enable row level security;
alter table public.performance_trainer_availability enable row level security;

revoke all on table public.performance_group_settings from anon, authenticated;
revoke all on table public.athlete_availability_defaults from anon, authenticated;
revoke all on table public.performance_athlete_availability from anon, authenticated;
revoke all on table public.performance_trainer_availability from anon, authenticated;

create or replace function public.current_organization_role(
  p_organization_id uuid
)
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
  limit 1;
$$;

create or replace function public.can_manage_performance_registration(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_module_access(p_organization_id, 'performance_registration', true)
    and public.current_organization_role(p_organization_id) in ('admin', 'trainer');
$$;

create or replace function public.performance_registration_deadline(
  p_organization_id uuid,
  p_group_id uuid,
  p_training_date date
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.performance_group_settings%rowtype;
  week_start date := date_trunc('week', p_training_date::timestamp)::date;
  deadline_date date;
begin
  select performance_settings.*
  into settings
  from public.performance_group_settings performance_settings
  where performance_settings.organization_id = p_organization_id
    and performance_settings.group_id = p_group_id;

  if settings.group_id is null then
    return null;
  end if;

  deadline_date := week_start - (8 - settings.registration_deadline_weekday);
  return (deadline_date + settings.registration_deadline_time) at time zone 'Europe/Vienna';
end;
$$;

create or replace function public.training_group_overview_v3(
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
  module_key text,
  regular_weekdays smallint[],
  allow_special_training boolean,
  is_performance_group boolean,
  registration_deadline_weekday smallint,
  registration_deadline_time time,
  performance_weeks_ahead smallint,
  allow_late_registration boolean,
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
    (
      select count(*)
      from public.athlete_group_memberships current_membership
      where current_membership.organization_id = training_group.organization_id
        and current_membership.group_id = training_group.id
        and current_membership.ended_on is null
    ) as athlete_count,
    training_group.module_key,
    training_group.regular_weekdays,
    training_group.allow_special_training,
    performance_settings.group_id is not null as is_performance_group,
    coalesce(performance_settings.registration_deadline_weekday, 7)::smallint,
    coalesce(performance_settings.registration_deadline_time, '18:00'::time),
    coalesce(performance_settings.weeks_ahead, 4)::smallint,
    coalesce(performance_settings.allow_late_registration, true),
    training_group.created_at,
    training_group.updated_at
  from public.training_groups training_group
  left join public.performance_group_settings performance_settings
    on performance_settings.organization_id = training_group.organization_id
   and performance_settings.group_id = training_group.id
  where training_group.organization_id = p_organization_id
  order by training_group.is_active desc, training_group.sort_order, lower(training_group.name);
end;
$$;

create or replace function public.save_performance_group_settings(
  p_organization_id uuid,
  p_group_id uuid,
  p_enabled boolean,
  p_registration_deadline_weekday smallint default 7,
  p_registration_deadline_time time default '18:00',
  p_weeks_ahead smallint default 4,
  p_allow_late_registration boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_group public.training_groups%rowtype;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für die Leistungsgruppen-Einstellungen fehlen die Bearbeitungsrechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id;

  if target_group.id is null then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden.';
  end if;

  if not coalesce(p_enabled, false) then
    delete from public.performance_group_settings
    where organization_id = p_organization_id
      and group_id = p_group_id;
    return;
  end if;

  if cardinality(target_group.regular_weekdays) = 0 then
    raise exception 'Für eine Leistungsgruppe muss mindestens ein Trainingstag ausgewählt sein.';
  end if;

  if p_registration_deadline_weekday not between 1 and 7 then
    raise exception 'Der Wochentag des Anmeldeschlusses ist ungültig.';
  end if;

  if p_weeks_ahead not between 1 and 12 then
    raise exception 'Es können zwischen 1 und 12 Wochen im Voraus freigeschaltet werden.';
  end if;

  insert into public.performance_group_settings (
    organization_id,
    group_id,
    registration_deadline_weekday,
    registration_deadline_time,
    weeks_ahead,
    allow_late_registration,
    created_by
  ) values (
    p_organization_id,
    p_group_id,
    p_registration_deadline_weekday,
    p_registration_deadline_time,
    p_weeks_ahead,
    coalesce(p_allow_late_registration, true),
    current_user_id
  )
  on conflict (organization_id, group_id) do update set
    registration_deadline_weekday = excluded.registration_deadline_weekday,
    registration_deadline_time = excluded.registration_deadline_time,
    weeks_ahead = excluded.weeks_ahead,
    allow_late_registration = excluded.allow_late_registration;
end;
$$;

create or replace function public.organization_linkable_users(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für die Benutzerverknüpfung fehlen die Bearbeitungsrechte.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', membership.user_id,
          'email', auth_user.email,
          'display_name', profile.display_name,
          'role', membership.role,
          'status', membership.status,
          'athlete_id', athlete.id,
          'trainer_id', trainer.id
        )
        order by lower(coalesce(profile.display_name, auth_user.email, ''))
      )
      from public.organization_members membership
      join auth.users auth_user on auth_user.id = membership.user_id
      left join public.profiles profile on profile.id = membership.user_id
      left join public.athletes athlete
        on athlete.organization_id = membership.organization_id
       and athlete.linked_user_id = membership.user_id
      left join public.trainers trainer
        on trainer.organization_id = membership.organization_id
       and trainer.linked_user_id = membership.user_id
      where membership.organization_id = p_organization_id
        and membership.status in ('active', 'invited')
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.set_athlete_user_link(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für die Benutzerverknüpfung fehlen die Bearbeitungsrechte.';
  end if;

  if p_user_id is not null and not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.status in ('active', 'invited')
  ) then
    raise exception 'Das Benutzerkonto gehört nicht zu diesem Verein.';
  end if;

  update public.athletes
  set linked_user_id = p_user_id
  where organization_id = p_organization_id
    and id = p_athlete_id;

  if not found then
    raise exception 'Der Athlet wurde nicht gefunden.';
  end if;
end;
$$;

create or replace function public.set_trainer_user_link(
  p_organization_id uuid,
  p_trainer_id uuid,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für die Benutzerverknüpfung fehlen die Bearbeitungsrechte.';
  end if;

  if p_user_id is not null and not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.status in ('active', 'invited')
  ) then
    raise exception 'Das Benutzerkonto gehört nicht zu diesem Verein.';
  end if;

  update public.trainers
  set linked_user_id = p_user_id
  where organization_id = p_organization_id
    and id = p_trainer_id;

  if not found then
    raise exception 'Der Trainer wurde nicht gefunden.';
  end if;
end;
$$;

-- Stammdaten inklusive Benutzerverknüpfungen und Leistungsgruppen-Einstellungen
-- jeweils in einer Transaktion speichern. So entstehen bei einem Fehler keine
-- teilweise gespeicherten Datensätze.
create or replace function public.create_athlete_v3(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null,
  p_notes text default null,
  p_group_ids uuid[] default array[]::uuid[],
  p_contacts jsonb default '[]'::jsonb,
  p_linked_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_athlete_id uuid;
begin
  new_athlete_id := public.create_athlete_v2(
    p_organization_id, p_first_name, p_last_name, p_birth_year,
    p_notes, p_group_ids, p_contacts
  );
  perform public.set_athlete_user_link(
    p_organization_id, new_athlete_id, p_linked_user_id
  );
  return new_athlete_id;
end;
$$;

create or replace function public.update_athlete_v3(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default array[]::uuid[],
  p_contacts jsonb default '[]'::jsonb,
  p_linked_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.update_athlete_v2(
    p_organization_id, p_athlete_id, p_first_name, p_last_name,
    p_birth_year, p_notes, p_is_active, p_group_ids, p_contacts
  );
  perform public.set_athlete_user_link(
    p_organization_id, p_athlete_id, p_linked_user_id
  );
end;
$$;

create or replace function public.create_trainer_v3(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_group_ids uuid[] default array[]::uuid[],
  p_linked_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_trainer_id uuid;
begin
  new_trainer_id := public.create_trainer_v2(
    p_organization_id, p_first_name, p_last_name, p_phone,
    p_email, p_notes, p_group_ids
  );
  perform public.set_trainer_user_link(
    p_organization_id, new_trainer_id, p_linked_user_id
  );
  return new_trainer_id;
end;
$$;

create or replace function public.update_trainer_v3(
  p_organization_id uuid,
  p_trainer_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default array[]::uuid[],
  p_linked_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.update_trainer_v2(
    p_organization_id, p_trainer_id, p_first_name, p_last_name,
    p_phone, p_email, p_notes, p_is_active, p_group_ids
  );
  perform public.set_trainer_user_link(
    p_organization_id, p_trainer_id, p_linked_user_id
  );
end;
$$;

create or replace function public.create_training_group_v3(
  p_organization_id uuid,
  p_name text,
  p_short_name text default null,
  p_description text default null,
  p_sort_order integer default 100,
  p_module_key text default null,
  p_regular_weekdays smallint[] default array[]::smallint[],
  p_allow_special_training boolean default true,
  p_is_performance_group boolean default false,
  p_registration_deadline_weekday smallint default 7,
  p_registration_deadline_time time default '18:00',
  p_performance_weeks_ahead smallint default 4,
  p_allow_late_registration boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group_id uuid;
begin
  new_group_id := public.create_training_group_v2(
    p_organization_id, p_name, p_short_name, p_description,
    p_sort_order, p_module_key, p_regular_weekdays, p_allow_special_training
  );
  perform public.save_performance_group_settings(
    p_organization_id, new_group_id, p_is_performance_group,
    p_registration_deadline_weekday, p_registration_deadline_time,
    p_performance_weeks_ahead, p_allow_late_registration
  );
  return new_group_id;
end;
$$;

create or replace function public.update_training_group_v3(
  p_organization_id uuid,
  p_group_id uuid,
  p_name text,
  p_short_name text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_sort_order integer default 100,
  p_module_key text default null,
  p_regular_weekdays smallint[] default array[]::smallint[],
  p_allow_special_training boolean default true,
  p_is_performance_group boolean default false,
  p_registration_deadline_weekday smallint default 7,
  p_registration_deadline_time time default '18:00',
  p_performance_weeks_ahead smallint default 4,
  p_allow_late_registration boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.update_training_group_v2(
    p_organization_id, p_group_id, p_name, p_short_name, p_description,
    p_is_active, p_sort_order, p_module_key, p_regular_weekdays,
    p_allow_special_training
  );
  perform public.save_performance_group_settings(
    p_organization_id, p_group_id, p_is_performance_group,
    p_registration_deadline_weekday, p_registration_deadline_time,
    p_performance_weeks_ahead, p_allow_late_registration
  );
end;
$$;

-- Athletenübersicht um die optionale Benutzerverknüpfung ergänzen.
drop function if exists public.athlete_overview(uuid);

create function public.athlete_overview(
  p_organization_id uuid
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  birth_year smallint,
  notes text,
  is_active boolean,
  linked_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  groups jsonb,
  contacts jsonb
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
    athlete.linked_user_id,
    athlete.created_at,
    athlete.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', training_group.id,
            'name', training_group.name,
            'short_name', training_group.short_name,
            'is_active', training_group.is_active
          )
          order by training_group.sort_order, lower(training_group.name)
        )
        from public.athlete_group_memberships membership
        join public.training_groups training_group
          on training_group.id = membership.group_id
         and training_group.organization_id = membership.organization_id
        where membership.organization_id = athlete.organization_id
          and membership.athlete_id = athlete.id
          and membership.ended_on is null
      ),
      '[]'::jsonb
    ) as groups,
    coalesce(
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
    ) as contacts
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
  order by athlete.is_active desc, lower(athlete.last_name), lower(athlete.first_name);
end;
$$;

create or replace function public.performance_registration_context(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role public.app_role;
  current_athlete_id uuid;
  current_trainer_id uuid;
  can_manage boolean;
begin
  if current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Leistungsgruppen fehlen die erforderlichen Rechte.';
  end if;

  current_role := public.current_organization_role(p_organization_id);
  can_manage := public.can_manage_performance_registration(p_organization_id);

  select athlete.id
  into current_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = current_user_id
  limit 1;

  select trainer.id
  into current_trainer_id
  from public.trainers trainer
  where trainer.organization_id = p_organization_id
    and trainer.linked_user_id = current_user_id
  limit 1;

  return jsonb_build_object(
    'role', current_role,
    'can_manage', can_manage,
    'athlete', (
      select jsonb_build_object(
        'id', athlete.id,
        'first_name', athlete.first_name,
        'last_name', athlete.last_name,
        'is_active', athlete.is_active
      )
      from public.athletes athlete
      where athlete.id = current_athlete_id
        and athlete.organization_id = p_organization_id
    ),
    'trainer', (
      select jsonb_build_object(
        'id', trainer.id,
        'first_name', trainer.first_name,
        'last_name', trainer.last_name,
        'is_active', trainer.is_active
      )
      from public.trainers trainer
      where trainer.id = current_trainer_id
        and trainer.organization_id = p_organization_id
    ),
    'groups', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', training_group.id,
            'name', training_group.name,
            'short_name', training_group.short_name,
            'regular_weekdays', to_jsonb(training_group.regular_weekdays),
            'deadline_weekday', settings.registration_deadline_weekday,
            'deadline_time', to_char(settings.registration_deadline_time, 'HH24:MI'),
            'weeks_ahead', settings.weeks_ahead,
            'allow_late_registration', settings.allow_late_registration
          )
          order by training_group.sort_order, lower(training_group.name)
        )
        from public.training_groups training_group
        join public.performance_group_settings settings
          on settings.organization_id = training_group.organization_id
         and settings.group_id = training_group.id
        where training_group.organization_id = p_organization_id
          and training_group.is_active
          and (
            current_role = 'admin'
            or (
              current_role = 'trainer'
              and (
                current_trainer_id is null
                or exists (
                  select 1
                  from public.trainer_group_assignments assignment
                  where assignment.organization_id = p_organization_id
                    and assignment.group_id = training_group.id
                    and assignment.trainer_id = current_trainer_id
                )
              )
            )
            or (
              current_role = 'athlete'
              and current_athlete_id is not null
              and exists (
                select 1
                from public.athlete_group_memberships membership
                where membership.organization_id = p_organization_id
                  and membership.group_id = training_group.id
                  and membership.athlete_id = current_athlete_id
                  and membership.ended_on is null
              )
            )
          )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.performance_group_week_overview(
  p_organization_id uuid,
  p_group_id uuid,
  p_week_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role public.app_role;
  current_athlete_id uuid;
  current_trainer_id uuid;
  can_manage boolean;
  normalized_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  normalized_week_end date := normalized_week_start + 6;
  target_group public.training_groups%rowtype;
  target_settings public.performance_group_settings%rowtype;
begin
  if current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Leistungsgruppen fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  select settings.*
  into target_settings
  from public.performance_group_settings settings
  where settings.organization_id = p_organization_id
    and settings.group_id = p_group_id;

  if target_group.id is null or target_settings.group_id is null then
    raise exception 'Die Leistungsgruppe wurde nicht gefunden oder ist nicht aktiv.';
  end if;

  current_role := public.current_organization_role(p_organization_id);
  can_manage := public.can_manage_performance_registration(p_organization_id);

  select athlete.id
  into current_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = current_user_id
  limit 1;

  select trainer.id
  into current_trainer_id
  from public.trainers trainer
  where trainer.organization_id = p_organization_id
    and trainer.linked_user_id = current_user_id
  limit 1;

  if not can_manage and current_role = 'athlete' and not exists (
    select 1
    from public.athlete_group_memberships membership
    where membership.organization_id = p_organization_id
      and membership.group_id = p_group_id
      and membership.athlete_id = current_athlete_id
      and membership.started_on <= normalized_week_end
      and (membership.ended_on is null or membership.ended_on >= normalized_week_start)
  ) then
    raise exception 'Du bist dieser Leistungsgruppe nicht zugeordnet.';
  end if;

  return jsonb_build_object(
    'week_start', normalized_week_start,
    'week_end', normalized_week_end,
    'group', jsonb_build_object(
      'id', target_group.id,
      'name', target_group.name,
      'short_name', target_group.short_name,
      'regular_weekdays', to_jsonb(target_group.regular_weekdays),
      'deadline_weekday', target_settings.registration_deadline_weekday,
      'deadline_time', to_char(target_settings.registration_deadline_time, 'HH24:MI'),
      'weeks_ahead', target_settings.weeks_ahead,
      'allow_late_registration', target_settings.allow_late_registration
    ),
    'dates', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', training_date,
            'weekday', weekday,
            'deadline_at', public.performance_registration_deadline(
              p_organization_id,
              p_group_id,
              training_date
            )
          )
          order by training_date
        )
        from (
          select
            normalized_week_start + (weekday_value - 1) as training_date,
            weekday_value as weekday
          from unnest(target_group.regular_weekdays) weekday_value
        ) training_dates
      ),
      '[]'::jsonb
    ),
    'athletes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', athlete.id,
            'first_name', athlete.first_name,
            'last_name', athlete.last_name,
            'birth_year', athlete.birth_year,
            'availability', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'date', dates.training_date,
                    'status', coalesce(availability.status::text, 'open'),
                    'available_from', to_char(availability.available_from, 'HH24:MI'),
                    'available_until', to_char(availability.available_until, 'HH24:MI'),
                    'comment', availability.comment,
                    'source', availability.source,
                    'updated_at', availability.updated_at,
                    'is_late', availability.updated_at > public.performance_registration_deadline(
                      p_organization_id,
                      p_group_id,
                      dates.training_date
                    )
                  )
                  order by dates.training_date
                )
                from (
                  select normalized_week_start + (weekday_value - 1) as training_date
                  from unnest(target_group.regular_weekdays) weekday_value
                ) dates
                left join public.performance_athlete_availability availability
                  on availability.organization_id = p_organization_id
                 and availability.group_id = p_group_id
                 and availability.athlete_id = athlete.id
                 and availability.training_date = dates.training_date
              ),
              '[]'::jsonb
            ),
            'defaults', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'weekday', default_value.weekday,
                    'status', default_value.status,
                    'available_from', to_char(default_value.available_from, 'HH24:MI'),
                    'available_until', to_char(default_value.available_until, 'HH24:MI'),
                    'comment', default_value.comment
                  )
                  order by default_value.weekday
                )
                from public.athlete_availability_defaults default_value
                where default_value.organization_id = p_organization_id
                  and default_value.group_id = p_group_id
                  and default_value.athlete_id = athlete.id
              ),
              '[]'::jsonb
            )
          )
          order by lower(athlete.last_name), lower(athlete.first_name)
        )
        from public.athletes athlete
        where athlete.organization_id = p_organization_id
          and (
            can_manage
            or athlete.id = current_athlete_id
          )
          and exists (
            select 1
            from public.athlete_group_memberships membership
            where membership.organization_id = p_organization_id
              and membership.group_id = p_group_id
              and membership.athlete_id = athlete.id
              and membership.started_on <= normalized_week_end
              and (membership.ended_on is null or membership.ended_on >= normalized_week_start)
          )
      ),
      '[]'::jsonb
    ),
    'trainers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', trainer.id,
            'first_name', trainer.first_name,
            'last_name', trainer.last_name,
            'availability', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'date', dates.training_date,
                    'status', coalesce(availability.status::text, 'open'),
                    'available_from', to_char(availability.available_from, 'HH24:MI'),
                    'available_until', to_char(availability.available_until, 'HH24:MI'),
                    'comment', availability.comment,
                    'source', availability.source,
                    'updated_at', availability.updated_at,
                    'is_late', availability.updated_at > public.performance_registration_deadline(
                      p_organization_id,
                      p_group_id,
                      dates.training_date
                    )
                  )
                  order by dates.training_date
                )
                from (
                  select normalized_week_start + (weekday_value - 1) as training_date
                  from unnest(target_group.regular_weekdays) weekday_value
                ) dates
                left join public.performance_trainer_availability availability
                  on availability.organization_id = p_organization_id
                 and availability.group_id = p_group_id
                 and availability.trainer_id = trainer.id
                 and availability.training_date = dates.training_date
              ),
              '[]'::jsonb
            )
          )
          order by lower(trainer.last_name), lower(trainer.first_name)
        )
        from public.trainers trainer
        where trainer.organization_id = p_organization_id
          and trainer.is_active
          and (
            can_manage
            or trainer.id = current_trainer_id
          )
          and exists (
            select 1
            from public.trainer_group_assignments assignment
            where assignment.organization_id = p_organization_id
              and assignment.group_id = p_group_id
              and assignment.trainer_id = trainer.id
          )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.save_performance_athlete_availability(
  p_organization_id uuid,
  p_group_id uuid,
  p_athlete_id uuid,
  p_training_date date,
  p_status text,
  p_available_from time default null,
  p_available_until time default null,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_is_self boolean;
  target_group public.training_groups%rowtype;
  settings public.performance_group_settings%rowtype;
  normalized_status text := lower(trim(coalesce(p_status, 'open')));
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  deadline_at timestamptz;
  saved_row public.performance_athlete_availability%rowtype;
begin
  if current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Trainingsanmeldung fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  select performance_settings.*
  into settings
  from public.performance_group_settings performance_settings
  where performance_settings.organization_id = p_organization_id
    and performance_settings.group_id = p_group_id;

  if target_group.id is null or settings.group_id is null then
    raise exception 'Die Leistungsgruppe wurde nicht gefunden.';
  end if;

  if extract(isodow from p_training_date)::smallint <> all(target_group.regular_weekdays) then
    raise exception 'Das ausgewählte Datum ist kein regulärer Trainingstag dieser Gruppe.';
  end if;

  if not exists (
    select 1
    from public.athlete_group_memberships membership
    where membership.organization_id = p_organization_id
      and membership.group_id = p_group_id
      and membership.athlete_id = p_athlete_id
      and membership.started_on <= p_training_date
      and (membership.ended_on is null or membership.ended_on >= p_training_date)
  ) then
    raise exception 'Der Athlet ist diesem Trainingstag nicht zugeordnet.';
  end if;

  select exists (
    select 1
    from public.athletes athlete
    where athlete.organization_id = p_organization_id
      and athlete.id = p_athlete_id
      and athlete.linked_user_id = current_user_id
  ) into current_is_self;

  if not current_is_self and not public.can_manage_performance_registration(p_organization_id) then
    raise exception 'Diese Trainingsanmeldung darf nicht bearbeitet werden.';
  end if;

  if p_available_from is not null and p_available_until is not null
     and p_available_from > p_available_until then
    raise exception 'Die Ankunftszeit darf nicht nach der Abfahrtszeit liegen.';
  end if;

  deadline_at := public.performance_registration_deadline(
    p_organization_id,
    p_group_id,
    p_training_date
  );

  if current_is_self
     and not public.can_manage_performance_registration(p_organization_id)
     and not settings.allow_late_registration
     and now() > deadline_at then
    raise exception 'Der Anmeldeschluss für diese Trainingswoche ist bereits vorbei.';
  end if;

  if normalized_status = 'open' then
    delete from public.performance_athlete_availability
    where organization_id = p_organization_id
      and group_id = p_group_id
      and athlete_id = p_athlete_id
      and training_date = p_training_date;

    return jsonb_build_object(
      'date', p_training_date,
      'status', 'open',
      'available_from', null,
      'available_until', null,
      'comment', null,
      'source', case when current_is_self then 'self' else 'trainer' end,
      'updated_at', now(),
      'is_late', now() > deadline_at
    );
  end if;

  if normalized_status not in ('coming', 'maybe', 'unavailable') then
    raise exception 'Der ausgewählte Anmeldestatus ist ungültig.';
  end if;

  insert into public.performance_athlete_availability (
    organization_id,
    group_id,
    athlete_id,
    training_date,
    status,
    available_from,
    available_until,
    comment,
    source,
    updated_by
  ) values (
    p_organization_id,
    p_group_id,
    p_athlete_id,
    p_training_date,
    normalized_status::public.performance_availability_status,
    p_available_from,
    p_available_until,
    normalized_comment,
    case when current_is_self then 'self' else 'trainer' end,
    current_user_id
  )
  on conflict (group_id, athlete_id, training_date) do update set
    status = excluded.status,
    available_from = excluded.available_from,
    available_until = excluded.available_until,
    comment = excluded.comment,
    source = excluded.source,
    updated_by = excluded.updated_by
  returning * into saved_row;

  return jsonb_build_object(
    'date', saved_row.training_date,
    'status', saved_row.status,
    'available_from', to_char(saved_row.available_from, 'HH24:MI'),
    'available_until', to_char(saved_row.available_until, 'HH24:MI'),
    'comment', saved_row.comment,
    'source', saved_row.source,
    'updated_at', saved_row.updated_at,
    'is_late', saved_row.updated_at > deadline_at
  );
end;
$$;

create or replace function public.save_performance_trainer_availability(
  p_organization_id uuid,
  p_group_id uuid,
  p_trainer_id uuid,
  p_training_date date,
  p_status text,
  p_available_from time default null,
  p_available_until time default null,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_is_self boolean;
  target_group public.training_groups%rowtype;
  normalized_status text := lower(trim(coalesce(p_status, 'open')));
  normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  deadline_at timestamptz;
  saved_row public.performance_trainer_availability%rowtype;
begin
  if current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Traineranwesenheit fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  join public.performance_group_settings settings
    on settings.organization_id = training_group.organization_id
   and settings.group_id = training_group.id
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  if target_group.id is null then
    raise exception 'Die Leistungsgruppe wurde nicht gefunden.';
  end if;

  if extract(isodow from p_training_date)::smallint <> all(target_group.regular_weekdays) then
    raise exception 'Das ausgewählte Datum ist kein regulärer Trainingstag dieser Gruppe.';
  end if;

  if not exists (
    select 1
    from public.trainers trainer
    where trainer.organization_id = p_organization_id
      and trainer.id = p_trainer_id
  ) then
    raise exception 'Der Trainer wurde nicht gefunden.';
  end if;

  select exists (
    select 1
    from public.trainers trainer
    where trainer.organization_id = p_organization_id
      and trainer.id = p_trainer_id
      and trainer.linked_user_id = current_user_id
  ) into current_is_self;

  if not current_is_self and not public.can_manage_performance_registration(p_organization_id) then
    raise exception 'Diese Traineranwesenheit darf nicht bearbeitet werden.';
  end if;

  if current_is_self and not public.can_manage_performance_registration(p_organization_id)
     and not exists (
       select 1
       from public.trainer_group_assignments assignment
       where assignment.organization_id = p_organization_id
         and assignment.group_id = p_group_id
         and assignment.trainer_id = p_trainer_id
     ) then
    raise exception 'Du bist dieser Leistungsgruppe nicht als Trainer zugeordnet.';
  end if;

  if p_available_from is not null and p_available_until is not null
     and p_available_from > p_available_until then
    raise exception 'Die Ankunftszeit darf nicht nach der Abfahrtszeit liegen.';
  end if;

  deadline_at := public.performance_registration_deadline(
    p_organization_id,
    p_group_id,
    p_training_date
  );

  if normalized_status = 'open' then
    delete from public.performance_trainer_availability
    where organization_id = p_organization_id
      and group_id = p_group_id
      and trainer_id = p_trainer_id
      and training_date = p_training_date;

    return jsonb_build_object(
      'date', p_training_date,
      'status', 'open',
      'available_from', null,
      'available_until', null,
      'comment', null,
      'source', 'self',
      'updated_at', now(),
      'is_late', now() > deadline_at
    );
  end if;

  if normalized_status not in ('coming', 'maybe', 'unavailable') then
    raise exception 'Der ausgewählte Anmeldestatus ist ungültig.';
  end if;

  insert into public.performance_trainer_availability (
    organization_id,
    group_id,
    trainer_id,
    training_date,
    status,
    available_from,
    available_until,
    comment,
    source,
    updated_by
  ) values (
    p_organization_id,
    p_group_id,
    p_trainer_id,
    p_training_date,
    normalized_status::public.performance_availability_status,
    p_available_from,
    p_available_until,
    normalized_comment,
    case when current_is_self then 'self' else 'trainer' end,
    current_user_id
  )
  on conflict (group_id, trainer_id, training_date) do update set
    status = excluded.status,
    available_from = excluded.available_from,
    available_until = excluded.available_until,
    comment = excluded.comment,
    source = excluded.source,
    updated_by = excluded.updated_by
  returning * into saved_row;

  return jsonb_build_object(
    'date', saved_row.training_date,
    'status', saved_row.status,
    'available_from', to_char(saved_row.available_from, 'HH24:MI'),
    'available_until', to_char(saved_row.available_until, 'HH24:MI'),
    'comment', saved_row.comment,
    'source', saved_row.source,
    'updated_at', saved_row.updated_at,
    'is_late', saved_row.updated_at > deadline_at
  );
end;
$$;

create or replace function public.save_performance_athlete_default(
  p_organization_id uuid,
  p_group_id uuid,
  p_athlete_id uuid,
  p_weekday smallint,
  p_status text,
  p_available_from time default null,
  p_available_until time default null,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_is_self boolean;
  target_group public.training_groups%rowtype;
  normalized_status text := lower(trim(coalesce(p_status, 'open')));
begin
  if current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Standardwoche fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  join public.performance_group_settings settings
    on settings.organization_id = training_group.organization_id
   and settings.group_id = training_group.id
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  if target_group.id is null or p_weekday <> all(target_group.regular_weekdays) then
    raise exception 'Der ausgewählte Wochentag gehört nicht zu dieser Leistungsgruppe.';
  end if;

  if not exists (
    select 1
    from public.athlete_group_memberships membership
    where membership.organization_id = p_organization_id
      and membership.group_id = p_group_id
      and membership.athlete_id = p_athlete_id
      and membership.ended_on is null
  ) then
    raise exception 'Der Athlet ist dieser Leistungsgruppe nicht aktuell zugeordnet.';
  end if;

  select exists (
    select 1
    from public.athletes athlete
    where athlete.organization_id = p_organization_id
      and athlete.id = p_athlete_id
      and athlete.linked_user_id = current_user_id
  ) into current_is_self;

  if not current_is_self and not public.can_manage_performance_registration(p_organization_id) then
    raise exception 'Diese Standardwoche darf nicht bearbeitet werden.';
  end if;

  if p_available_from is not null and p_available_until is not null
     and p_available_from > p_available_until then
    raise exception 'Die Ankunftszeit darf nicht nach der Abfahrtszeit liegen.';
  end if;

  if normalized_status = 'open' then
    delete from public.athlete_availability_defaults
    where organization_id = p_organization_id
      and group_id = p_group_id
      and athlete_id = p_athlete_id
      and weekday = p_weekday;
    return;
  end if;

  if normalized_status not in ('coming', 'maybe', 'unavailable') then
    raise exception 'Der ausgewählte Anmeldestatus ist ungültig.';
  end if;

  insert into public.athlete_availability_defaults (
    organization_id,
    group_id,
    athlete_id,
    weekday,
    status,
    available_from,
    available_until,
    comment,
    updated_by
  ) values (
    p_organization_id,
    p_group_id,
    p_athlete_id,
    p_weekday,
    normalized_status::public.performance_availability_status,
    p_available_from,
    p_available_until,
    nullif(trim(coalesce(p_comment, '')), ''),
    current_user_id
  )
  on conflict (group_id, athlete_id, weekday) do update set
    status = excluded.status,
    available_from = excluded.available_from,
    available_until = excluded.available_until,
    comment = excluded.comment,
    updated_by = excluded.updated_by;
end;
$$;

create or replace function public.apply_performance_athlete_defaults(
  p_organization_id uuid,
  p_group_id uuid,
  p_athlete_id uuid,
  p_week_start date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_is_self boolean;
  normalized_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  target_group public.training_groups%rowtype;
  target_settings public.performance_group_settings%rowtype;
begin
  if current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Standardwoche fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  select settings.*
  into target_settings
  from public.performance_group_settings settings
  where settings.organization_id = p_organization_id
    and settings.group_id = p_group_id;

  if target_group.id is null or target_settings.group_id is null then
    raise exception 'Die Leistungsgruppe wurde nicht gefunden.';
  end if;

  if not exists (
    select 1
    from public.athlete_group_memberships membership
    where membership.organization_id = p_organization_id
      and membership.group_id = p_group_id
      and membership.athlete_id = p_athlete_id
      and membership.started_on <= normalized_week_start + 6
      and (membership.ended_on is null or membership.ended_on >= normalized_week_start)
  ) then
    raise exception 'Der Athlet ist dieser Leistungsgruppe in dieser Woche nicht zugeordnet.';
  end if;

  select exists (
    select 1
    from public.athletes athlete
    where athlete.organization_id = p_organization_id
      and athlete.id = p_athlete_id
      and athlete.linked_user_id = current_user_id
  ) into current_is_self;

  if not current_is_self and not public.can_manage_performance_registration(p_organization_id) then
    raise exception 'Diese Trainingswoche darf nicht bearbeitet werden.';
  end if;

  if current_is_self
     and not public.can_manage_performance_registration(p_organization_id)
     and not target_settings.allow_late_registration
     and now() > public.performance_registration_deadline(
       p_organization_id,
       p_group_id,
       normalized_week_start
     ) then
    raise exception 'Der Anmeldeschluss für diese Trainingswoche ist bereits vorbei.';
  end if;

  delete from public.performance_athlete_availability availability
  where availability.organization_id = p_organization_id
    and availability.group_id = p_group_id
    and availability.athlete_id = p_athlete_id
    and availability.training_date between normalized_week_start and normalized_week_start + 6;

  insert into public.performance_athlete_availability (
    organization_id,
    group_id,
    athlete_id,
    training_date,
    status,
    available_from,
    available_until,
    comment,
    source,
    updated_by
  )
  select
    p_organization_id,
    p_group_id,
    p_athlete_id,
    normalized_week_start + (default_value.weekday - 1),
    default_value.status,
    default_value.available_from,
    default_value.available_until,
    default_value.comment,
    'default',
    current_user_id
  from public.athlete_availability_defaults default_value
  where default_value.organization_id = p_organization_id
    and default_value.group_id = p_group_id
    and default_value.athlete_id = p_athlete_id
    and default_value.weekday = any(target_group.regular_weekdays);
end;
$$;

create or replace function public.copy_performance_previous_week(
  p_organization_id uuid,
  p_group_id uuid,
  p_athlete_id uuid,
  p_week_start date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_is_self boolean;
  normalized_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  target_group public.training_groups%rowtype;
  target_settings public.performance_group_settings%rowtype;
begin
  if current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Übernahme der Vorwoche fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  select settings.*
  into target_settings
  from public.performance_group_settings settings
  where settings.organization_id = p_organization_id
    and settings.group_id = p_group_id;

  if target_group.id is null or target_settings.group_id is null then
    raise exception 'Die Leistungsgruppe wurde nicht gefunden.';
  end if;

  if not exists (
    select 1
    from public.athlete_group_memberships membership
    where membership.organization_id = p_organization_id
      and membership.group_id = p_group_id
      and membership.athlete_id = p_athlete_id
      and membership.started_on <= normalized_week_start + 6
      and (membership.ended_on is null or membership.ended_on >= normalized_week_start)
  ) then
    raise exception 'Der Athlet ist dieser Leistungsgruppe in dieser Woche nicht zugeordnet.';
  end if;

  select exists (
    select 1
    from public.athletes athlete
    where athlete.organization_id = p_organization_id
      and athlete.id = p_athlete_id
      and athlete.linked_user_id = current_user_id
  ) into current_is_self;

  if not current_is_self and not public.can_manage_performance_registration(p_organization_id) then
    raise exception 'Diese Trainingswoche darf nicht bearbeitet werden.';
  end if;

  if current_is_self
     and not public.can_manage_performance_registration(p_organization_id)
     and not target_settings.allow_late_registration
     and now() > public.performance_registration_deadline(
       p_organization_id,
       p_group_id,
       normalized_week_start
     ) then
    raise exception 'Der Anmeldeschluss für diese Trainingswoche ist bereits vorbei.';
  end if;

  delete from public.performance_athlete_availability availability
  where availability.organization_id = p_organization_id
    and availability.group_id = p_group_id
    and availability.athlete_id = p_athlete_id
    and availability.training_date between normalized_week_start and normalized_week_start + 6;

  insert into public.performance_athlete_availability (
    organization_id,
    group_id,
    athlete_id,
    training_date,
    status,
    available_from,
    available_until,
    comment,
    source,
    updated_by
  )
  select
    source_value.organization_id,
    source_value.group_id,
    source_value.athlete_id,
    source_value.training_date + 7,
    source_value.status,
    source_value.available_from,
    source_value.available_until,
    source_value.comment,
    'copy',
    current_user_id
  from public.performance_athlete_availability source_value
  where source_value.organization_id = p_organization_id
    and source_value.group_id = p_group_id
    and source_value.athlete_id = p_athlete_id
    and source_value.training_date between normalized_week_start - 7 and normalized_week_start - 1
    and extract(isodow from (source_value.training_date + 7))::smallint = any(target_group.regular_weekdays);
end;
$$;

revoke all on function public.create_athlete_v3(uuid, text, text, integer, text, uuid[], jsonb, uuid) from public;
revoke all on function public.update_athlete_v3(uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb, uuid) from public;
revoke all on function public.create_trainer_v3(uuid, text, text, text, text, text, uuid[], uuid) from public;
revoke all on function public.update_trainer_v3(uuid, uuid, text, text, text, text, text, boolean, uuid[], uuid) from public;
revoke all on function public.create_training_group_v3(uuid, text, text, text, integer, text, smallint[], boolean, boolean, smallint, time, smallint, boolean) from public;
revoke all on function public.update_training_group_v3(uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean, boolean, smallint, time, smallint, boolean) from public;
revoke all on function public.current_organization_role(uuid) from public;
revoke all on function public.can_manage_performance_registration(uuid) from public;
revoke all on function public.performance_registration_deadline(uuid, uuid, date) from public;
revoke all on function public.training_group_overview_v3(uuid) from public;
revoke all on function public.save_performance_group_settings(uuid, uuid, boolean, smallint, time, smallint, boolean) from public;
revoke all on function public.organization_linkable_users(uuid) from public;
revoke all on function public.set_athlete_user_link(uuid, uuid, uuid) from public;
revoke all on function public.set_trainer_user_link(uuid, uuid, uuid) from public;
revoke all on function public.athlete_overview(uuid) from public;
revoke all on function public.performance_registration_context(uuid) from public;
revoke all on function public.performance_group_week_overview(uuid, uuid, date) from public;
revoke all on function public.save_performance_athlete_availability(uuid, uuid, uuid, date, text, time, time, text) from public;
revoke all on function public.save_performance_trainer_availability(uuid, uuid, uuid, date, text, time, time, text) from public;
revoke all on function public.save_performance_athlete_default(uuid, uuid, uuid, smallint, text, time, time, text) from public;
revoke all on function public.apply_performance_athlete_defaults(uuid, uuid, uuid, date) from public;
revoke all on function public.copy_performance_previous_week(uuid, uuid, uuid, date) from public;

grant execute on function public.create_athlete_v3(uuid, text, text, integer, text, uuid[], jsonb, uuid) to authenticated;
grant execute on function public.update_athlete_v3(uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb, uuid) to authenticated;
grant execute on function public.create_trainer_v3(uuid, text, text, text, text, text, uuid[], uuid) to authenticated;
grant execute on function public.update_trainer_v3(uuid, uuid, text, text, text, text, text, boolean, uuid[], uuid) to authenticated;
grant execute on function public.create_training_group_v3(uuid, text, text, text, integer, text, smallint[], boolean, boolean, smallint, time, smallint, boolean) to authenticated;
grant execute on function public.update_training_group_v3(uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean, boolean, smallint, time, smallint, boolean) to authenticated;
grant execute on function public.current_organization_role(uuid) to authenticated;
grant execute on function public.can_manage_performance_registration(uuid) to authenticated;
grant execute on function public.performance_registration_deadline(uuid, uuid, date) to authenticated;
grant execute on function public.training_group_overview_v3(uuid) to authenticated;
grant execute on function public.save_performance_group_settings(uuid, uuid, boolean, smallint, time, smallint, boolean) to authenticated;
grant execute on function public.organization_linkable_users(uuid) to authenticated;
grant execute on function public.set_athlete_user_link(uuid, uuid, uuid) to authenticated;
grant execute on function public.set_trainer_user_link(uuid, uuid, uuid) to authenticated;
grant execute on function public.athlete_overview(uuid) to authenticated;
grant execute on function public.performance_registration_context(uuid) to authenticated;
grant execute on function public.performance_group_week_overview(uuid, uuid, date) to authenticated;
grant execute on function public.save_performance_athlete_availability(uuid, uuid, uuid, date, text, time, time, text) to authenticated;
grant execute on function public.save_performance_trainer_availability(uuid, uuid, uuid, date, text, time, time, text) to authenticated;
grant execute on function public.save_performance_athlete_default(uuid, uuid, uuid, smallint, text, time, time, text) to authenticated;
grant execute on function public.apply_performance_athlete_defaults(uuid, uuid, uuid, date) to authenticated;
grant execute on function public.copy_performance_previous_week(uuid, uuid, uuid, date) to authenticated;

commit;
