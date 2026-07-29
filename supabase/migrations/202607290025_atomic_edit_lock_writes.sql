-- D1: Atomare Bearbeitungssperren für gemeinsam bearbeitete Stammdaten.
-- Die Sperr- und Versionsprüfung läuft in derselben Datenbanktransaktion wie das Speichern.

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
    else
      raise exception 'Dieser Datensatztyp unterstützt keine Bearbeitungssperre.';
  end case;

  if v_version is null then
    raise exception 'Der Datensatz wurde nicht gefunden oder bereits gelöscht.';
  end if;

  if abs(extract(epoch from (v_version - p_expected_updated_at))) > 0.001 then
    raise exception 'Der Datensatz wurde seit dem Öffnen verändert. Bitte neu laden, damit keine Änderungen überschrieben werden.';
  end if;

  return v_version;
end;
$$;

create or replace function public.save_exercise_catalog_item_v3(
  p_organization_id uuid,
  p_exercise_id uuid default null,
  p_name text default null,
  p_category_key text default null,
  p_subcategory text default null,
  p_goal text default null,
  p_description text default null,
  p_coaching_cues text default null,
  p_common_mistakes text default null,
  p_equipment text[] default '{}',
  p_video_url text default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default '{}',
  p_parameters jsonb default '[]'::jsonb,
  p_lock_token uuid default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exercise_id uuid;
  v_updated_at timestamptz;
begin
  if p_exercise_id is not null then
    perform public.assert_edit_lock_for_write(
      p_organization_id,
      'exercise',
      p_exercise_id,
      p_lock_token,
      p_expected_updated_at
    );
  end if;

  v_exercise_id := public.save_exercise_catalog_item_v2(
    p_organization_id,
    p_exercise_id,
    p_name,
    p_category_key,
    p_subcategory,
    p_goal,
    p_description,
    p_coaching_cues,
    p_common_mistakes,
    p_equipment,
    p_video_url,
    p_is_active,
    p_group_ids,
    p_parameters
  );

  select exercise.updated_at
  into v_updated_at
  from public.exercises exercise
  where exercise.organization_id = p_organization_id
    and exercise.id = v_exercise_id;

  return jsonb_build_object(
    'id', v_exercise_id,
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.save_training_block_v2(
  p_organization_id uuid,
  p_block_id uuid default null,
  p_name text default null,
  p_goal text default null,
  p_description text default null,
  p_estimated_minutes integer default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default '{}',
  p_items jsonb default '[]'::jsonb,
  p_lock_token uuid default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block_id uuid;
  v_updated_at timestamptz;
begin
  if p_block_id is not null then
    perform public.assert_edit_lock_for_write(
      p_organization_id,
      'training_block',
      p_block_id,
      p_lock_token,
      p_expected_updated_at
    );
  end if;

  v_block_id := public.save_training_block(
    p_organization_id,
    p_block_id,
    p_name,
    p_goal,
    p_description,
    p_estimated_minutes,
    p_is_active,
    p_group_ids,
    p_items
  );

  select block.updated_at
  into v_updated_at
  from public.training_blocks block
  where block.organization_id = p_organization_id
    and block.id = v_block_id;

  return jsonb_build_object(
    'id', v_block_id,
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.update_athlete_v4(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer,
  p_notes text,
  p_is_active boolean,
  p_group_ids uuid[],
  p_contacts jsonb,
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
    'athlete',
    p_athlete_id,
    p_lock_token,
    p_expected_updated_at
  );

  perform public.update_athlete_v3(
    p_organization_id,
    p_athlete_id,
    p_first_name,
    p_last_name,
    p_birth_year,
    p_notes,
    p_is_active,
    p_group_ids,
    p_contacts,
    p_linked_user_id
  );

  select athlete.updated_at
  into v_updated_at
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.id = p_athlete_id;

  return jsonb_build_object(
    'id', p_athlete_id,
    'updated_at', v_updated_at
  );
end;
$$;

create or replace function public.save_athlete_training_plan_v2(
  p_organization_id uuid,
  p_plan_id uuid,
  p_athlete_id uuid,
  p_group_id uuid,
  p_training_date date,
  p_title text,
  p_notes text,
  p_sections jsonb,
  p_lock_token uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_updated_at timestamptz;
begin
  if p_plan_id is not null then
    perform public.assert_edit_lock_for_write(
      p_organization_id,
      'training_plan',
      p_plan_id,
      p_lock_token,
      p_expected_updated_at
    );
  end if;

  v_plan_id := public.save_athlete_training_plan(
    p_organization_id,
    p_plan_id,
    p_athlete_id,
    p_group_id,
    p_training_date,
    p_title,
    p_notes,
    p_sections
  );

  select plan.updated_at
  into v_updated_at
  from public.athlete_training_plans plan
  where plan.organization_id = p_organization_id
    and plan.id = v_plan_id;

  return jsonb_build_object(
    'id', v_plan_id,
    'updated_at', v_updated_at
  );
end;
$$;

revoke all on function public.assert_edit_lock_for_write(uuid, text, uuid, uuid, timestamptz) from public;
revoke all on function public.save_exercise_catalog_item_v3(uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb, uuid, timestamptz) from public;
revoke all on function public.save_training_block_v2(uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb, uuid, timestamptz) from public;
revoke all on function public.update_athlete_v4(uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb, uuid, uuid, timestamptz) from public;
revoke all on function public.save_athlete_training_plan_v2(uuid, uuid, uuid, uuid, date, text, text, jsonb, uuid, timestamptz) from public;

grant execute on function public.save_exercise_catalog_item_v3(uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb, uuid, timestamptz) to authenticated;
grant execute on function public.save_training_block_v2(uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb, uuid, timestamptz) to authenticated;
grant execute on function public.update_athlete_v4(uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.save_athlete_training_plan_v2(uuid, uuid, uuid, uuid, date, text, text, jsonb, uuid, timestamptz) to authenticated;
