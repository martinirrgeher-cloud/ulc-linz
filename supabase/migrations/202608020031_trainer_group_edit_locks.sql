-- E2: Atomarer Bearbeitungsschutz fuer Trainer und Trainingsgruppen.
-- Neue Schreib-RPCs pruefen Bearbeitungssperre und Datensatzversion in derselben Transaktion.

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
    'trainer'
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
    else
      raise exception 'Dieser Datensatztyp unterstützt keine Bearbeitungssperre.';
  end case;

  if v_updated_at is null then
    raise exception 'Der Datensatz wurde nicht gefunden oder bereits gelöscht.';
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
    raise exception 'Für die Bearbeitung ist eine Anmeldung erforderlich.';
  end if;

  if p_lock_token is null then
    raise exception 'Die Bearbeitungsreservierung fehlt. Bitte Datensatz neu öffnen.';
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
    raise exception 'Die Bearbeitungsreservierung ist abgelaufen oder wurde übernommen. Bitte Datensatz neu öffnen.';
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
    else
      raise exception 'Dieser Datensatztyp unterstützt keine Bearbeitungssperre.';
  end case;

  if v_version is null then
    raise exception 'Der Datensatz wurde nicht gefunden oder bereits gelöscht.';
  end if;

  if abs(extract(epoch from (v_version - p_expected_updated_at))) > 0.001 then
    if p_entity_type = 'training_documentation' then
      raise exception using
        errcode = '40001',
        message = 'TRAINING_DOCUMENTATION_VERSION_CONFLICT: Die Trainingsdokumentation wurde zwischenzeitlich geändert.';
    end if;

    raise exception 'Der Datensatz wurde seit dem Öffnen verändert. Bitte neu laden, damit keine Änderungen überschrieben werden.';
  end if;

  return v_version;
end;
$$;

create or replace function public.update_trainer_v4(
  p_organization_id uuid,
  p_trainer_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_is_active boolean,
  p_group_ids uuid[],
  p_linked_user_id uuid,
  p_lock_token uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  perform public.assert_edit_lock_for_write(
    p_organization_id,
    'trainer',
    p_trainer_id,
    p_lock_token,
    p_expected_updated_at
  );

  perform public.update_trainer_v3(
    p_organization_id,
    p_trainer_id,
    p_first_name,
    p_last_name,
    p_phone,
    p_email,
    p_notes,
    p_is_active,
    p_group_ids,
    p_linked_user_id
  );

  select trainer.updated_at
  into v_updated_at
  from public.trainers trainer
  where trainer.organization_id = p_organization_id
    and trainer.id = p_trainer_id;

  return jsonb_build_object(
    'id', p_trainer_id,
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.update_training_group_v4(
  p_organization_id uuid,
  p_group_id uuid,
  p_name text,
  p_short_name text,
  p_description text,
  p_is_active boolean,
  p_sort_order integer,
  p_module_key text,
  p_regular_weekdays smallint[],
  p_allow_special_training boolean,
  p_is_performance_group boolean,
  p_registration_deadline_weekday smallint,
  p_registration_deadline_time time,
  p_performance_weeks_ahead smallint,
  p_allow_late_registration boolean,
  p_lock_token uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  perform public.assert_edit_lock_for_write(
    p_organization_id,
    'training_group',
    p_group_id,
    p_lock_token,
    p_expected_updated_at
  );

  perform public.update_training_group_v3(
    p_organization_id,
    p_group_id,
    p_name,
    p_short_name,
    p_description,
    p_is_active,
    p_sort_order,
    p_module_key,
    p_regular_weekdays,
    p_allow_special_training,
    p_is_performance_group,
    p_registration_deadline_weekday,
    p_registration_deadline_time,
    p_performance_weeks_ahead,
    p_allow_late_registration
  );

  select training_group.updated_at
  into v_updated_at
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id;

  return jsonb_build_object(
    'id', p_group_id,
    'updated_at', v_updated_at
  );
end;
$$;

revoke all on function public.edit_lock_module_key(text) from public;
revoke all on function public.edit_lock_record_version(uuid, text, uuid) from public;
revoke all on function public.assert_edit_lock_for_write(uuid, text, uuid, uuid, timestamptz) from public;
revoke all on function public.update_trainer_v4(
  uuid, uuid, text, text, text, text, text, boolean, uuid[], uuid, uuid, timestamptz
) from public;
revoke all on function public.update_training_group_v4(
  uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean,
  boolean, smallint, time, smallint, boolean, uuid, timestamptz
) from public;

grant execute on function public.update_trainer_v4(
  uuid, uuid, text, text, text, text, text, boolean, uuid[], uuid, uuid, timestamptz
) to authenticated;
grant execute on function public.update_training_group_v4(
  uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean,
  boolean, smallint, time, smallint, boolean, uuid, timestamptz
) to authenticated;

-- Finaler Repository-Zustand: Direkte ungesperrte Updates sind nicht mehr per API aufrufbar.
revoke all on function public.update_trainer_v3(
  uuid, uuid, text, text, text, text, text, boolean, uuid[], uuid
) from authenticated, anon, public;
revoke all on function public.update_training_group_v3(
  uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean,
  boolean, smallint, time, smallint, boolean
) from authenticated, anon, public;
