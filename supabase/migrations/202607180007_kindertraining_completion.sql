-- ULC Linz App – Kindertraining Ausbau
-- Trainerstammdaten, Trainingsort, löschbare Sondertrainings, Notfallkontakte und Statistik.

insert into public.app_modules (
  key,
  title,
  description,
  route,
  icon,
  sort_order,
  is_active
) values (
  'kindertraining_statistics',
  'Kindertraining',
  'Trainings-, Athleten- und Trainerstatistik',
  '/module/kindertraining/statistik',
  'chart-no-axes-combined',
  110,
  true
)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  route = excluded.route,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true;

-- Bestehende Kindertraining-Rechte werden einmalig für die Statistik übernommen.
insert into public.member_module_permissions (
  membership_id,
  module_key,
  can_view,
  can_edit
)
select
  permission.membership_id,
  'kindertraining_statistics',
  permission.can_view,
  permission.can_edit
from public.member_module_permissions permission
where permission.module_key = 'kindertraining'
on conflict (membership_id, module_key) do nothing;

create type public.training_environment as enum (
  'indoor',
  'outdoor',
  'mixed'
);

alter table public.training_sessions
  add column environment public.training_environment,
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete set null;

-- Archivierte Sondertrainings dürfen später am selben Datum neu angelegt werden.
alter table public.training_sessions
  drop constraint training_sessions_organization_id_group_id_session_date_key;

create unique index training_sessions_org_group_date_active_unique
  on public.training_sessions (organization_id, group_id, session_date)
  where deleted_at is null;

create index training_sessions_active_date_idx
  on public.training_sessions (organization_id, group_id, session_date desc)
  where deleted_at is null;

create table public.trainers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  phone text check (phone is null or char_length(trim(phone)) <= 40),
  email text check (email is null or char_length(trim(email)) <= 254),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  linked_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create index trainers_org_active_name_idx
  on public.trainers (organization_id, is_active, lower(last_name), lower(first_name));

create unique index trainers_org_linked_user_unique
  on public.trainers (organization_id, linked_user_id)
  where linked_user_id is not null;

create trigger trainers_set_updated_at
before update on public.trainers
for each row execute function public.set_updated_at();

create table public.training_session_trainers (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null,
  trainer_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id, trainer_id),
  constraint training_session_trainers_session_fk
    foreign key (session_id, organization_id)
    references public.training_sessions(id, organization_id)
    on delete cascade,
  constraint training_session_trainers_trainer_fk
    foreign key (trainer_id, organization_id)
    references public.trainers(id, organization_id)
    on delete restrict
);

create index training_session_trainers_org_trainer_idx
  on public.training_session_trainers (organization_id, trainer_id, session_id);

create table public.athlete_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null,
  contact_name text not null check (char_length(trim(contact_name)) between 1 and 120),
  relationship text check (relationship is null or char_length(trim(relationship)) <= 80),
  phone text not null check (char_length(trim(phone)) between 3 and 40),
  is_emergency boolean not null default true,
  priority smallint not null default 1 check (priority between 1 and 20),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_contacts_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade
);

create index athlete_contacts_athlete_priority_idx
  on public.athlete_contacts (organization_id, athlete_id, is_emergency desc, priority, contact_name);

create trigger athlete_contacts_set_updated_at
before update on public.athlete_contacts
for each row execute function public.set_updated_at();

create table public.organization_statistics_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  kindertraining_default_from date not null default date_trunc('year', current_date)::date,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_statistics_settings_set_updated_at
before update on public.organization_statistics_settings
for each row execute function public.set_updated_at();

alter table public.trainers enable row level security;
alter table public.training_session_trainers enable row level security;
alter table public.athlete_contacts enable row level security;
alter table public.organization_statistics_settings enable row level security;

revoke all on table public.trainers from anon, authenticated;
revoke all on table public.training_session_trainers from anon, authenticated;
revoke all on table public.athlete_contacts from anon, authenticated;
revoke all on table public.organization_statistics_settings from anon, authenticated;

create or replace function public.can_read_kindertraining_statistics(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_module_access(target_organization_id, 'kindertraining_statistics', false)
    or public.has_module_access(target_organization_id, 'kindertraining', false);
$$;

create or replace function public.can_edit_kindertraining_statistics(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_module_access(target_organization_id, 'kindertraining_statistics', true)
    or public.has_module_access(target_organization_id, 'kindertraining', true);
$$;

create or replace function public.trainer_overview(
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

create or replace function public.create_trainer(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_email text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_first_name text := trim(coalesce(p_first_name, ''));
  normalized_last_name text := trim(coalesce(p_last_name, ''));
  normalized_phone text := nullif(trim(coalesce(p_phone, '')), '');
  normalized_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
  new_trainer_id uuid;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für das Anlegen von Trainern fehlen die Bearbeitungsrechte im Athletenmodul.';
  end if;

  if char_length(normalized_first_name) not between 1 and 80
     or char_length(normalized_last_name) not between 1 and 80 then
    raise exception 'Vor- und Nachname des Trainers sind erforderlich.';
  end if;

  if exists (
    select 1
    from public.trainers trainer
    where trainer.organization_id = p_organization_id
      and lower(trim(trainer.first_name)) = lower(normalized_first_name)
      and lower(trim(trainer.last_name)) = lower(normalized_last_name)
      and trainer.is_active
  ) then
    raise exception 'Ein aktiver Trainer mit diesem Namen existiert bereits.';
  end if;

  insert into public.trainers (
    organization_id,
    first_name,
    last_name,
    phone,
    email,
    notes,
    created_by
  ) values (
    p_organization_id,
    normalized_first_name,
    normalized_last_name,
    normalized_phone,
    normalized_email,
    normalized_notes,
    current_user_id
  )
  returning id into new_trainer_id;

  insert into public.audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_organization_id,
    current_user_id,
    'trainer.created',
    'trainer',
    new_trainer_id::text,
    jsonb_build_object(
      'first_name', normalized_first_name,
      'last_name', normalized_last_name,
      'phone', normalized_phone,
      'email', normalized_email
    )
  );

  return new_trainer_id;
end;
$$;

create or replace function public.update_trainer(
  p_organization_id uuid,
  p_trainer_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text default null,
  p_email text default null,
  p_notes text default null,
  p_is_active boolean default true
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
  normalized_phone text := nullif(trim(coalesce(p_phone, '')), '');
  normalized_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
  old_data jsonb;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für die Bearbeitung von Trainern fehlen die Bearbeitungsrechte im Athletenmodul.';
  end if;

  if char_length(normalized_first_name) not between 1 and 80
     or char_length(normalized_last_name) not between 1 and 80 then
    raise exception 'Vor- und Nachname des Trainers sind erforderlich.';
  end if;

  select jsonb_build_object(
    'first_name', trainer.first_name,
    'last_name', trainer.last_name,
    'phone', trainer.phone,
    'email', trainer.email,
    'notes', trainer.notes,
    'is_active', trainer.is_active
  )
  into old_data
  from public.trainers trainer
  where trainer.id = p_trainer_id
    and trainer.organization_id = p_organization_id;

  if old_data is null then
    raise exception 'Der Trainer wurde nicht gefunden.';
  end if;

  if exists (
    select 1
    from public.trainers trainer
    where trainer.organization_id = p_organization_id
      and trainer.id <> p_trainer_id
      and lower(trim(trainer.first_name)) = lower(normalized_first_name)
      and lower(trim(trainer.last_name)) = lower(normalized_last_name)
      and trainer.is_active
      and coalesce(p_is_active, true)
  ) then
    raise exception 'Ein anderer aktiver Trainer mit diesem Namen existiert bereits.';
  end if;

  update public.trainers
  set first_name = normalized_first_name,
      last_name = normalized_last_name,
      phone = normalized_phone,
      email = normalized_email,
      notes = normalized_notes,
      is_active = coalesce(p_is_active, true)
  where id = p_trainer_id
    and organization_id = p_organization_id;

  insert into public.audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_organization_id,
    current_user_id,
    'trainer.updated',
    'trainer',
    p_trainer_id::text,
    old_data,
    jsonb_build_object(
      'first_name', normalized_first_name,
      'last_name', normalized_last_name,
      'phone', normalized_phone,
      'email', normalized_email,
      'notes', normalized_notes,
      'is_active', coalesce(p_is_active, true)
    )
  );
end;
$$;

create or replace function public.replace_athlete_contacts(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_contacts jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_contacts jsonb := coalesce(p_contacts, '[]'::jsonb);
  contact_item jsonb;
  contact_index integer := 0;
begin
  if current_user_id is null or not public.can_edit_athlete_data(p_organization_id) then
    raise exception 'Für die Bearbeitung von Notfallkontakten fehlen die erforderlichen Rechte.';
  end if;

  if not exists (
    select 1 from public.athletes athlete
    where athlete.id = p_athlete_id
      and athlete.organization_id = p_organization_id
  ) then
    raise exception 'Der Athlet wurde nicht gefunden.';
  end if;

  if jsonb_typeof(normalized_contacts) <> 'array' then
    raise exception 'Die Kontaktdaten sind ungültig.';
  end if;

  if jsonb_array_length(normalized_contacts) > 10 then
    raise exception 'Pro Athlet können höchstens zehn Kontakte gespeichert werden.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(normalized_contacts) item
    where jsonb_typeof(item) <> 'object'
      or char_length(trim(coalesce(item ->> 'contact_name', ''))) not between 1 and 120
      or char_length(trim(coalesce(item ->> 'phone', ''))) not between 3 and 40
      or char_length(trim(coalesce(item ->> 'relationship', ''))) > 80
      or char_length(trim(coalesce(item ->> 'notes', ''))) > 500
  ) then
    raise exception 'Mindestens ein Notfallkontakt ist unvollständig oder ungültig.';
  end if;

  delete from public.athlete_contacts contact
  where contact.organization_id = p_organization_id
    and contact.athlete_id = p_athlete_id;

  for contact_item in
    select item from jsonb_array_elements(normalized_contacts) item
  loop
    contact_index := contact_index + 1;
    insert into public.athlete_contacts (
      organization_id,
      athlete_id,
      contact_name,
      relationship,
      phone,
      is_emergency,
      priority,
      notes,
      created_by
    ) values (
      p_organization_id,
      p_athlete_id,
      trim(contact_item ->> 'contact_name'),
      nullif(trim(coalesce(contact_item ->> 'relationship', '')), ''),
      trim(contact_item ->> 'phone'),
      coalesce((contact_item ->> 'is_emergency')::boolean, true),
      contact_index,
      nullif(trim(coalesce(contact_item ->> 'notes', '')), ''),
      current_user_id
    );
  end loop;
end;
$$;

create or replace function public.create_athlete_v2(
  p_organization_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null,
  p_notes text default null,
  p_group_ids uuid[] default array[]::uuid[],
  p_contacts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_athlete_id uuid;
begin
  new_athlete_id := public.create_athlete(
    p_organization_id,
    p_first_name,
    p_last_name,
    p_birth_year,
    p_notes,
    p_group_ids
  );

  perform public.replace_athlete_contacts(
    p_organization_id,
    new_athlete_id,
    p_contacts
  );

  return new_athlete_id;
end;
$$;

create or replace function public.update_athlete_v2(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null,
  p_notes text default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default array[]::uuid[],
  p_contacts jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.update_athlete(
    p_organization_id,
    p_athlete_id,
    p_first_name,
    p_last_name,
    p_birth_year,
    p_notes,
    p_is_active,
    p_group_ids
  );

  perform public.replace_athlete_contacts(
    p_organization_id,
    p_athlete_id,
    p_contacts
  );
end;
$$;

-- Die Athletenübersicht wird um Notfallkontakte ergänzt.
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

-- Sondertrainingstage: gelöschte/archivierte Termine werden nicht mehr angeboten.
create or replace function public.kindertraining_configuration_overview(
  p_organization_id uuid
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
  if not public.can_read_kindertraining(p_organization_id) then
    raise exception 'Für das Kindertraining fehlen die erforderlichen Leserechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.module_key = 'kindertraining';

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

create or replace function public.kindertraining_session_overview(
  p_organization_id uuid,
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

  if not public.can_read_kindertraining(p_organization_id) then
    raise exception 'Für das Kindertraining fehlen die erforderlichen Leserechte.';
  end if;

  select training_group.*
  into target_group
  from public.training_groups training_group
  where training_group.id = p_group_id
    and training_group.organization_id = p_organization_id
    and training_group.module_key = 'kindertraining';

  if target_group.id is null then
    raise exception 'Die Kindertrainingsgruppe wurde nicht gefunden oder ist nicht zugeordnet.';
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

create or replace function public.save_kindertraining_session_v3(
  p_organization_id uuid,
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
     or not public.can_edit_kindertraining(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Kindertraining.';
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
    and training_group.module_key = 'kindertraining';

  if target_group.id is null then
    raise exception 'Die Kindertrainingsgruppe wurde nicht gefunden oder ist nicht zugeordnet.';
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
    case when session_existed then 'kindertraining.updated' else 'kindertraining.created' end,
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

  return public.kindertraining_session_overview(
    p_organization_id,
    p_group_id,
    p_session_date
  );
end;
$$;

create or replace function public.delete_kindertraining_special_session(
  p_organization_id uuid,
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
  if current_user_id is null or not public.can_edit_kindertraining(p_organization_id) then
    raise exception 'Für das Löschen des Sondertrainings fehlen die Bearbeitungsrechte.';
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
      'kindertraining.special_archived',
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
    'kindertraining.special_deleted',
    'training_session',
    target_session.id::text,
    jsonb_build_object('session_date', target_session.session_date)
  );

  return jsonb_build_object('mode', 'deleted');
end;
$$;

create or replace function public.kindertraining_statistics_overview(
  p_organization_id uuid,
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
  if not public.can_read_kindertraining_statistics(p_organization_id) then
    raise exception 'Für die Kindertraining-Statistik fehlen die erforderlichen Rechte.';
  end if;

  select coalesce(
    settings.kindertraining_default_from,
    date_trunc('year', current_date)::date
  )
  into default_from_date
  from (select 1) seed
  left join public.organization_statistics_settings settings
    on settings.organization_id = p_organization_id;

  effective_from_date := coalesce(p_from_date, default_from_date);

  if effective_from_date > effective_to_date then
    raise exception 'Das Von-Datum darf nicht nach dem Bis-Datum liegen.';
  end if;

  select training_group.id
  into target_group_id
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.module_key = 'kindertraining';

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

create or replace function public.save_kindertraining_statistics_default(
  p_organization_id uuid,
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
     or not public.can_edit_kindertraining_statistics(p_organization_id) then
    raise exception 'Für das Speichern des Statistik-Standards fehlen die Bearbeitungsrechte.';
  end if;

  if p_from_date is null or p_from_date > current_date then
    raise exception 'Das Standard-Von-Datum ist ungültig.';
  end if;

  insert into public.organization_statistics_settings (
    organization_id,
    kindertraining_default_from,
    updated_by
  ) values (
    p_organization_id,
    p_from_date,
    current_user_id
  )
  on conflict (organization_id) do update set
    kindertraining_default_from = excluded.kindertraining_default_from,
    updated_by = current_user_id;

  return p_from_date;
end;
$$;

revoke all on function public.can_read_kindertraining_statistics(uuid) from public;
revoke all on function public.can_edit_kindertraining_statistics(uuid) from public;
revoke all on function public.trainer_overview(uuid) from public;
revoke all on function public.create_trainer(uuid, text, text, text, text, text) from public;
revoke all on function public.update_trainer(uuid, uuid, text, text, text, text, text, boolean) from public;
revoke all on function public.replace_athlete_contacts(uuid, uuid, jsonb) from public;
revoke all on function public.create_athlete_v2(uuid, text, text, integer, text, uuid[], jsonb) from public;
revoke all on function public.update_athlete_v2(uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb) from public;
revoke all on function public.athlete_overview(uuid) from public;
revoke all on function public.kindertraining_configuration_overview(uuid) from public;
revoke all on function public.kindertraining_session_overview(uuid, uuid, date) from public;
revoke all on function public.save_kindertraining_session_v3(uuid, uuid, date, public.training_session_state, text, jsonb, uuid[], public.training_environment, timestamptz) from public;
revoke all on function public.delete_kindertraining_special_session(uuid, uuid, date) from public;
revoke all on function public.kindertraining_statistics_overview(uuid, date, date, integer) from public;
revoke all on function public.save_kindertraining_statistics_default(uuid, date) from public;

grant execute on function public.can_read_kindertraining_statistics(uuid) to authenticated;
grant execute on function public.can_edit_kindertraining_statistics(uuid) to authenticated;
grant execute on function public.trainer_overview(uuid) to authenticated;
grant execute on function public.create_trainer(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.update_trainer(uuid, uuid, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.replace_athlete_contacts(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_athlete_v2(uuid, text, text, integer, text, uuid[], jsonb) to authenticated;
grant execute on function public.update_athlete_v2(uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb) to authenticated;
grant execute on function public.athlete_overview(uuid) to authenticated;
grant execute on function public.kindertraining_configuration_overview(uuid) to authenticated;
grant execute on function public.kindertraining_session_overview(uuid, uuid, date) to authenticated;
grant execute on function public.save_kindertraining_session_v3(uuid, uuid, date, public.training_session_state, text, jsonb, uuid[], public.training_environment, timestamptz) to authenticated;
grant execute on function public.delete_kindertraining_special_session(uuid, uuid, date) to authenticated;
grant execute on function public.kindertraining_statistics_overview(uuid, date, date, integer) to authenticated;
grant execute on function public.save_kindertraining_statistics_default(uuid, date) to authenticated;
