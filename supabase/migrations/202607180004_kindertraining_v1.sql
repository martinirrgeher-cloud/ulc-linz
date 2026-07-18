-- ULC Linz App – Kindertraining V1
-- Persistente Trainingstermine, Teilnehmer-Snapshot, Anwesenheit und Notizen.

create type public.training_session_state as enum (
  'scheduled',
  'cancelled'
);

create type public.training_attendance_status as enum (
  'open',
  'present',
  'excused',
  'absent'
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  session_date date not null,
  state public.training_session_state not null default 'scheduled',
  note text check (note is null or char_length(note) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_sessions_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete restrict,
  unique (id, organization_id),
  unique (organization_id, group_id, session_date)
);

create index training_sessions_org_group_date_idx
  on public.training_sessions (organization_id, group_id, session_date desc);

create table public.training_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null,
  athlete_id uuid not null,
  status public.training_attendance_status not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_attendance_session_fk
    foreign key (session_id, organization_id)
    references public.training_sessions(id, organization_id)
    on delete cascade,
  constraint training_attendance_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete restrict,
  unique (session_id, athlete_id)
);

create index training_attendance_org_athlete_idx
  on public.training_attendance (organization_id, athlete_id, session_id);

create trigger training_sessions_set_updated_at
before update on public.training_sessions
for each row execute function public.set_updated_at();

create trigger training_attendance_set_updated_at
before update on public.training_attendance
for each row execute function public.set_updated_at();

create or replace function public.can_read_kindertraining(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_access(
    target_organization_id,
    'kindertraining',
    false
  );
$$;

create or replace function public.can_edit_kindertraining(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_module_access(
    target_organization_id,
    'kindertraining',
    true
  );
$$;

-- Liefert entweder den gespeicherten Teilnehmer-Snapshot eines Trainings
-- oder – solange noch kein Training gespeichert wurde – die am Datum gültige
-- aktuelle Gruppenzusammensetzung.
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
  participant_data jsonb;
begin
  if p_session_date is null then
    raise exception 'Der Trainingstag fehlt.';
  end if;

  if not public.can_read_kindertraining(p_organization_id) then
    raise exception 'Für das Kindertraining fehlen die erforderlichen Leserechte.';
  end if;

  if not exists (
    select 1
    from public.training_groups training_group
    where training_group.id = p_group_id
      and training_group.organization_id = p_organization_id
  ) then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden.';
  end if;

  select training_session.*
  into target_session
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = p_group_id
    and training_session.session_date = p_session_date;

  if target_session.id is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'athlete_id', athlete.id,
          'first_name', athlete.first_name,
          'last_name', athlete.last_name,
          'birth_year', athlete.birth_year,
          'is_active', athlete.is_active,
          'status', attendance.status
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
          'status', 'open'
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
  end if;

  return jsonb_build_object(
    'session',
      case
        when target_session.id is null then null
        else jsonb_build_object(
          'id', target_session.id,
          'state', target_session.state,
          'note', coalesce(target_session.note, ''),
          'created_at', target_session.created_at,
          'updated_at', target_session.updated_at
        )
      end,
    'participants', participant_data
  );
end;
$$;

-- Speichert Termin, Notiz und Anwesenheit atomar. Die Teilnehmerliste wird
-- beim ersten Speichern als Snapshot festgehalten. Eine Versionsprüfung über
-- updated_at verhindert, dass zwei Trainer unbemerkt Änderungen überschreiben.
create or replace function public.save_kindertraining_session(
  p_organization_id uuid,
  p_group_id uuid,
  p_session_date date,
  p_state public.training_session_state,
  p_note text,
  p_attendance jsonb,
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
  target_session_id uuid;
  previous_updated_at timestamptz;
  session_existed boolean := false;
  group_is_active boolean;
  duplicate_count integer;
  invalid_athlete_count integer;
  old_summary jsonb;
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

  select training_group.is_active
  into group_is_active
  from public.training_groups training_group
  where training_group.id = p_group_id
    and training_group.organization_id = p_organization_id;

  if group_is_active is null then
    raise exception 'Die Trainingsgruppe wurde nicht gefunden.';
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

  -- Serialisiert parallele Erstspeicherungen desselben Gruppentermins.
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
      'updated_at', training_session.updated_at
    )
  into target_session_id, previous_updated_at, old_summary
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = p_group_id
    and training_session.session_date = p_session_date
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
        updated_by = current_user_id
    where id = target_session_id
      and organization_id = p_organization_id;
  else
    if p_expected_updated_at is not null then
      raise exception 'Das Training wurde inzwischen geändert. Bitte neu laden.';
    end if;

    if not group_is_active then
      raise exception 'Für eine deaktivierte Trainingsgruppe kann kein neuer Termin angelegt werden.';
    end if;

    -- Bei einem neuen Training dürfen nur am gewählten Tag gültige,
    -- aktive Gruppenmitglieder in den ersten Snapshot aufgenommen werden.
    select count(*)
    into invalid_athlete_count
    from jsonb_array_elements(normalized_attendance) attendance_item
    left join public.athlete_group_memberships membership
      on membership.organization_id = p_organization_id
     and membership.group_id = p_group_id
     and membership.athlete_id = (attendance_item ->> 'athlete_id')::uuid
     and membership.started_on <= p_session_date
     and (membership.ended_on is null or membership.ended_on >= p_session_date)
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
      created_by,
      updated_by
    ) values (
      p_organization_id,
      p_group_id,
      p_session_date,
      p_state,
      normalized_note,
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
    case
      when session_existed then 'kindertraining.updated'
      else 'kindertraining.created'
    end,
    'training_session',
    target_session_id::text,
    old_summary,
    jsonb_build_object(
      'group_id', p_group_id,
      'session_date', p_session_date,
      'state', p_state,
      'note', normalized_note,
      'participant_count', jsonb_array_length(normalized_attendance),
      'present_count', (
        select count(*)
        from jsonb_array_elements(normalized_attendance) attendance_item
        where attendance_item ->> 'status' = 'present'
      ),
      'excused_count', (
        select count(*)
        from jsonb_array_elements(normalized_attendance) attendance_item
        where attendance_item ->> 'status' = 'excused'
      ),
      'absent_count', (
        select count(*)
        from jsonb_array_elements(normalized_attendance) attendance_item
        where attendance_item ->> 'status' = 'absent'
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

revoke all on function public.can_read_kindertraining(uuid) from public;
revoke all on function public.can_edit_kindertraining(uuid) from public;
revoke all on function public.kindertraining_session_overview(uuid, uuid, date) from public;
revoke all on function public.save_kindertraining_session(
  uuid,
  uuid,
  date,
  public.training_session_state,
  text,
  jsonb,
  timestamptz
) from public;

grant execute on function public.can_read_kindertraining(uuid) to authenticated;
grant execute on function public.can_edit_kindertraining(uuid) to authenticated;
grant execute on function public.kindertraining_session_overview(uuid, uuid, date) to authenticated;
grant execute on function public.save_kindertraining_session(
  uuid,
  uuid,
  date,
  public.training_session_state,
  text,
  jsonb,
  timestamptz
) to authenticated;

alter table public.training_sessions enable row level security;
alter table public.training_attendance enable row level security;

create policy "training_sessions_select_kindertraining"
on public.training_sessions
for select
to authenticated
using (public.can_read_kindertraining(organization_id));

create policy "training_attendance_select_kindertraining"
on public.training_attendance
for select
to authenticated
using (public.can_read_kindertraining(organization_id));

grant select on public.training_sessions to authenticated;
grant select on public.training_attendance to authenticated;

revoke insert, update, delete on public.training_sessions from anon, authenticated;
revoke insert, update, delete on public.training_attendance from anon, authenticated;
