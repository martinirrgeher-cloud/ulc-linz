-- ULC Linz App – Kindertraining V2.2
-- Autosave-Unterstützung und nachträgliche Erfassung älterer Trainingstage.
-- Bestehende gespeicherte Teilnehmer-Snapshots bleiben unverändert.

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
  target_group public.training_groups%rowtype;
  is_regular_day boolean;
  uses_current_assignments boolean := false;
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
    and training_session.session_date = p_session_date;

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

    -- Bei älteren, noch nie erfassten Terminen können historische
    -- Gruppenzuordnungen fehlen. In diesem Fall wird die aktuell aktive
    -- Kindertrainingsgruppe als Ausgangsliste verwendet und beim ersten
    -- Speichern dauerhaft als Teilnehmer-Snapshot festgehalten.
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
        and membership.started_on <= current_date
        and (membership.ended_on is null or membership.ended_on >= current_date)
        and athlete.is_active;
    end if;
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
          'created_at', target_session.created_at,
          'updated_at', target_session.updated_at
        )
      end,
    'is_regular_day', is_regular_day,
    'uses_current_assignments', uses_current_assignments,
    'participants', participant_data
  );
end;
$$;

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
  target_group public.training_groups%rowtype;
  is_regular_day boolean;
  duplicate_count integer;
  invalid_athlete_count integer;
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
        is_special = not is_regular_day,
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

    -- Ist für einen alten, noch nie gespeicherten Termin keine historische
    -- Teilnehmerzuordnung vorhanden, darf die aktuell aktive Gruppenzuordnung
    -- als Ausgangsliste gespeichert werden.
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
      created_by,
      updated_by
    ) values (
      p_organization_id,
      p_group_id,
      p_session_date,
      p_state,
      normalized_note,
      not is_regular_day,
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
      'is_special', not is_regular_day,
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

revoke all on function public.kindertraining_session_overview(uuid, uuid, date) from public;
revoke all on function public.save_kindertraining_session(uuid, uuid, date, public.training_session_state, text, jsonb, timestamptz) from public;

grant execute on function public.kindertraining_session_overview(uuid, uuid, date) to authenticated;
grant execute on function public.save_kindertraining_session(uuid, uuid, date, public.training_session_state, text, jsonb, timestamptz) to authenticated;
