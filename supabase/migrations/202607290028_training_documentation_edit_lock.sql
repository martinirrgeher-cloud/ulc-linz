-- D2.1: Aktiver Bearbeitungsschutz für Trainingsdokumentationen.
-- Ergänzt die vorhandene serielle/versionsgesicherte Speicherung um eine
-- Bearbeitungsreservierung, die in derselben Transaktion wie das Speichern geprüft wird.

alter table public.edit_locks
  drop constraint if exists edit_locks_entity_type_check;

alter table public.edit_locks
  add constraint edit_locks_entity_type_check
  check (entity_type in (
    'exercise',
    'training_block',
    'athlete',
    'training_plan',
    'training_documentation'
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
      select item.updated_at
      into v_version
      from public.exercises item
      where item.organization_id = p_organization_id
        and item.id = p_entity_id
      for update;
    when 'training_block' then
      select item.updated_at
      into v_version
      from public.training_blocks item
      where item.organization_id = p_organization_id
        and item.id = p_entity_id
      for update;
    when 'athlete' then
      select item.updated_at
      into v_version
      from public.athletes item
      where item.organization_id = p_organization_id
        and item.id = p_entity_id
      for update;
    when 'training_plan' then
      select item.updated_at
      into v_version
      from public.athlete_training_plans item
      where item.organization_id = p_organization_id
        and item.id = p_entity_id
      for update;
    when 'training_documentation' then
      select item.updated_at
      into v_version
      from public.athlete_training_sessions item
      where item.organization_id = p_organization_id
        and item.id = p_entity_id
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

create or replace function public.save_training_documentation_v3(
  p_organization_id uuid,
  p_session_id uuid,
  p_status text,
  p_actual_minutes integer,
  p_overall_rpe integer,
  p_overall_rating integer,
  p_overall_comment text,
  p_pain_level text,
  p_pain_comment text,
  p_trainer_feedback text,
  p_items jsonb,
  p_lock_token uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_edit_lock_for_write(
    p_organization_id,
    'training_documentation',
    p_session_id,
    p_lock_token,
    p_expected_updated_at
  );

  return public.save_training_documentation_v2(
    p_organization_id,
    p_session_id,
    p_status,
    p_actual_minutes,
    p_overall_rpe,
    p_overall_rating,
    p_overall_comment,
    p_pain_level,
    p_pain_comment,
    p_trainer_feedback,
    p_items,
    p_expected_updated_at
  );
end;
$$;

revoke all on function public.save_training_documentation_v3(
  uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb, uuid, timestamptz
) from public;

grant execute on function public.save_training_documentation_v3(
  uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb, uuid, timestamptz
) to authenticated;
