-- ULC Linz App – Kindertraining V2
-- Feste Modulgruppe, regelmäßige Trainingstage, Sondertrainings und schnelle Athletenanlage.

alter table public.training_groups
  add column module_key text references public.app_modules(key) on delete set null,
  add column regular_weekdays smallint[] not null default array[]::smallint[],
  add column allow_special_training boolean not null default true;

alter table public.training_groups
  add constraint training_groups_regular_weekdays_valid
  check (
    regular_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and cardinality(regular_weekdays) <= 7
  );

create unique index training_groups_org_module_unique
  on public.training_groups (organization_id, module_key)
  where module_key is not null;

alter table public.training_sessions
  add column is_special boolean not null default false;

-- Erweiterte Gruppenübersicht. Die bisherigen Funktionen bleiben bewusst bestehen,
-- damit bereits getestete Ansichten und ältere Deployments nicht gebrochen werden.
create or replace function public.training_group_overview_v2(
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
    training_group.module_key,
    training_group.regular_weekdays,
    training_group.allow_special_training,
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

  if normalized_module_key is not null and not exists (
    select 1 from public.app_modules app_module
    where app_module.key = normalized_module_key and app_module.is_active
  ) then
    raise exception 'Das ausgewählte App-Modul ist ungültig.';
  end if;

  if normalized_module_key = 'kindertraining' and cardinality(normalized_weekdays) = 0 then
    raise exception 'Für das Kindertraining muss mindestens ein Trainingstag ausgewählt werden.';
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

  if normalized_module_key is not null and not exists (
    select 1 from public.app_modules app_module
    where app_module.key = normalized_module_key and app_module.is_active
  ) then
    raise exception 'Das ausgewählte App-Modul ist ungültig.';
  end if;

  if normalized_module_key = 'kindertraining' and cardinality(normalized_weekdays) = 0 then
    raise exception 'Für das Kindertraining muss mindestens ein Trainingstag ausgewählt werden.';
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

-- Liefert genau die Gruppe, die fachlich dem Kindertraining zugeordnet ist.
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
      and (
        training_session.is_special
        or not (
          extract(isodow from training_session.session_date)::smallint
          = any(target_group.regular_weekdays)
        )
      )
      and training_session.session_date between current_date - 730 and current_date + 730
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

-- Schnelle Anlage direkt im Kindertraining. Exakte Dubletten werden nicht
-- automatisch verdoppelt, sondern können nach Bestätigung reaktiviert und
-- der Kindertrainingsgruppe zugeordnet werden.
create or replace function public.create_kindertraining_athlete(
  p_organization_id uuid,
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
  if current_user_id is null or not public.can_edit_kindertraining(p_organization_id) then
    raise exception 'Für diese Änderung fehlen die Bearbeitungsrechte im Kindertraining.';
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
    and training_group.module_key = 'kindertraining'
    and training_group.is_active;

  if target_group_id is null then
    raise exception 'Für das Kindertraining ist keine aktive Trainingsgruppe eingerichtet.';
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
      and training_session.session_date = p_session_date;

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
      then 'kindertraining.athlete_created'
      else 'kindertraining.athlete_attached'
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

-- Bestehende Ladefunktion: nur mehr die fest zugeordnete Kindertrainingsgruppe
-- und reguläre bzw. ausdrücklich erlaubte Sondertermine zulassen.
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

revoke all on function public.training_group_overview_v2(uuid) from public;
revoke all on function public.create_training_group_v2(uuid, text, text, text, integer, text, smallint[], boolean) from public;
revoke all on function public.update_training_group_v2(uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean) from public;
revoke all on function public.kindertraining_configuration_overview(uuid) from public;
revoke all on function public.create_kindertraining_athlete(uuid, text, text, integer, date, boolean) from public;

grant execute on function public.training_group_overview_v2(uuid) to authenticated;
grant execute on function public.create_training_group_v2(uuid, text, text, text, integer, text, smallint[], boolean) to authenticated;
grant execute on function public.update_training_group_v2(uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean) to authenticated;
grant execute on function public.kindertraining_configuration_overview(uuid) to authenticated;
grant execute on function public.create_kindertraining_athlete(uuid, text, text, integer, date, boolean) to authenticated;
