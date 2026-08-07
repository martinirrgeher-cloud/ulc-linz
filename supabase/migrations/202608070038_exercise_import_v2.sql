-- Übungsimport v2: aktueller E5a-Katalog mit Schwierigkeit und ähnlichen Übungen.
-- Additiv zur bestehenden v1-Funktion, damit ältere Clients während des Rollouts weiter funktionieren.

create or replace function public.apply_exercise_import_v2(
  p_organization_id uuid,
  p_import_id uuid,
  p_rows jsonb,
  p_missing_options jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_payload_hash text;
  v_existing_run public.data_import_runs%rowtype;
  v_row jsonb;
  v_values jsonb;
  v_option jsonb;
  v_parameter jsonb;
  v_parameters jsonb;
  v_parameter_key text;
  v_category_key text;
  v_difficulty_key text;
  v_exercise_id uuid;
  v_group_ids uuid[];
  v_equipment text[];
  v_row_number integer;
  v_label text;
  v_action text;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_result_rows jsonb := '[]'::jsonb;
  v_result jsonb;
  v_normalized_name text;
  v_similar_ref jsonb;
  v_similar_id uuid;
begin
  if v_user_id is null or not public.has_module_access(p_organization_id, 'exercise_catalog', true) then
    raise exception 'Du darfst keine Übungen importieren.';
  end if;
  if p_import_id is null then
    raise exception 'Die Import-ID fehlt.';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Die Importdaten besitzen ein ungültiges Format.';
  end if;
  if jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) = 0 then
    raise exception 'Der Import enthält keine Zeilen.';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'Ein Import darf maximal 1.000 Datenzeilen enthalten.';
  end if;
  if jsonb_typeof(coalesce(p_missing_options, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_missing_options, '[]'::jsonb)) > 500 then
    raise exception 'Die automatisch anzulegenden Auswahllistenwerte sind ungültig.';
  end if;
  if jsonb_array_length(coalesce(p_missing_options, '[]'::jsonb)) > 0
     and not public.has_module_access(p_organization_id, 'dropdown_settings', true) then
    raise exception 'Für das automatische Anlegen von Auswahllistenwerten fehlen die Rechte.';
  end if;
  if (
    select count(*)
    from jsonb_array_elements(p_rows) item(value)
    where item.value ->> 'action' = 'update'
  ) <> (
    select count(distinct item.value ->> 'existing_id')
    from jsonb_array_elements(p_rows) item(value)
    where item.value ->> 'action' = 'update'
  ) then
    raise exception 'Ein bestehender Übungsdatensatz ist im Import mehrfach zur Aktualisierung ausgewählt.';
  end if;

  v_payload_hash := md5(p_rows::text || '|' || coalesce(p_missing_options, '[]'::jsonb)::text);
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':exercise-import-v2:' || p_import_id::text, 0));

  select run.*
  into v_existing_run
  from public.data_import_runs run
  where run.organization_id = p_organization_id
    and run.import_id = p_import_id
  for update;

  if v_existing_run.import_id is not null then
    if v_existing_run.import_kind <> 'exercises' or v_existing_run.payload_hash <> v_payload_hash then
      raise exception 'Diese Import-ID wurde bereits für andere Importdaten verwendet.';
    end if;
    return v_existing_run.result;
  end if;

  -- Vor jeglicher Änderung alle Updates auf Version und Bearbeitungssperren prüfen.
  for v_row in
    select item.value
    from jsonb_array_elements(p_rows) item(value)
    where item.value ->> 'action' = 'update'
    order by item.value ->> 'existing_id'
  loop
    perform public.assert_import_entity_available(
      p_organization_id,
      'exercise',
      (v_row ->> 'existing_id')::uuid,
      (v_row ->> 'expected_updated_at')::timestamptz
    );
  end loop;

  -- Fehlende Stammdaten innerhalb derselben Transaktion anlegen.
  for v_option in
    select item.value
    from jsonb_array_elements(coalesce(p_missing_options, '[]'::jsonb)) item(value)
  loop
    if v_option ->> 'list_key' is null
       or v_option ->> 'list_key' not in ('category', 'subcategory', 'material', 'difficulty', 'planning_parameter') then
      raise exception 'Unbekannte Auswahlliste im Import.';
    end if;
    if char_length(trim(coalesce(v_option ->> 'label', ''))) < 2 then
      raise exception 'Ein Auswahllistenwert im Import ist zu kurz.';
    end if;

    if v_option ->> 'list_key' = 'category' then
      if not exists (
        select 1
        from public.organization_exercise_categories assignment
        where assignment.organization_id = p_organization_id
          and lower(trim(assignment.title)) = lower(trim(v_option ->> 'label'))
      ) then
        perform public.save_dropdown_setting(
          p_organization_id,
          'category',
          null,
          null,
          v_option ->> 'label',
          '',
          'text',
          null,
          coalesce((v_option ->> 'sort_order')::integer, 100)
        );
      end if;
    else
      if not exists (
        select 1
        from public.organization_dropdown_options option_row
        where option_row.organization_id = p_organization_id
          and option_row.list_key = v_option ->> 'list_key'
          and lower(trim(option_row.label)) = lower(trim(v_option ->> 'label'))
      ) then
        perform public.save_dropdown_setting(
          p_organization_id,
          v_option ->> 'list_key',
          null,
          nullif(trim(coalesce(v_option ->> 'option_key', '')), ''),
          v_option ->> 'label',
          coalesce(v_option ->> 'unit', ''),
          coalesce(nullif(v_option ->> 'input_type', ''), 'text'),
          nullif(v_option ->> 'step_value', '')::numeric,
          coalesce((v_option ->> 'sort_order')::integer, 100)
        );
      end if;
    end if;
  end loop;

  -- Erster Durchlauf: alle Übungsstammdaten speichern. Beziehungen folgen erst danach,
  -- damit auch in derselben Datei neu angelegte Übungen referenziert werden können.
  for v_row in
    select item.value
    from jsonb_array_elements(p_rows) item(value)
    order by coalesce((item.value ->> 'row_number')::integer, 0)
  loop
    v_row_number := coalesce((v_row ->> 'row_number')::integer, 0);
    v_label := coalesce(nullif(trim(v_row ->> 'label'), ''), 'Unbenannte Zeile');
    v_action := v_row ->> 'action';

    if v_action = 'skip' then
      v_skipped := v_skipped + 1;
      v_result_rows := v_result_rows || jsonb_build_array(jsonb_build_object(
        'row_number', v_row_number,
        'label', v_label,
        'action', 'skip',
        'success', true,
        'message', coalesce(nullif(v_row ->> 'skip_message', ''), 'Übersprungen.')
      ));
      continue;
    end if;

    if v_action is null
       or v_action not in ('create', 'update')
       or jsonb_typeof(v_row -> 'values') is distinct from 'object' then
      raise exception 'Zeile % (%): Ungültige Importaktion oder fehlende Werte.', v_row_number, v_label;
    end if;

    begin
      v_values := v_row -> 'values';
      v_normalized_name := public.normalize_catalog_name(v_values ->> 'name');
      if char_length(v_normalized_name) < 2 then
        raise exception 'Der Übungsname ist zu kurz.';
      end if;

      -- Gleiche Dublettenregel wie im aktuellen Übungskatalog v4.
      perform pg_advisory_xact_lock(hashtextextended(
        'exercise_name:' || p_organization_id::text || ':' || v_normalized_name,
        0
      ));
      if exists (
        select 1
        from public.exercises existing
        where existing.organization_id = p_organization_id
          and existing.normalized_name = v_normalized_name
          and (
            v_action <> 'update'
            or existing.id <> (v_row ->> 'existing_id')::uuid
          )
      ) then
        raise exception 'Eine Übung mit praktisch gleichem Namen existiert bereits.';
      end if;

      select assignment.category_key
      into v_category_key
      from public.organization_exercise_categories assignment
      join public.exercise_categories category on category.key = assignment.category_key
      where assignment.organization_id = p_organization_id
        and lower(trim(assignment.title)) = lower(trim(v_values ->> 'category_label'))
        and assignment.is_active
        and category.is_active
      order by assignment.sort_order, assignment.category_key
      limit 1;

      if v_category_key is null then
        raise exception 'Kategorie „%“ wurde nicht gefunden oder ist inaktiv.', coalesce(v_values ->> 'category_label', '');
      end if;

      v_difficulty_key := null;
      if nullif(trim(coalesce(v_values ->> 'difficulty_label', '')), '') is not null then
        select option_row.option_key
        into v_difficulty_key
        from public.organization_dropdown_options option_row
        where option_row.organization_id = p_organization_id
          and option_row.list_key = 'difficulty'
          and lower(trim(option_row.label)) = lower(trim(v_values ->> 'difficulty_label'))
          and option_row.is_active
        order by option_row.sort_order, option_row.option_key
        limit 1;
        if v_difficulty_key is null then
          raise exception 'Schwierigkeitsgrad „%“ wurde nicht gefunden oder ist inaktiv.', coalesce(v_values ->> 'difficulty_label', '');
        end if;
      end if;

      select coalesce(array_agg(item.value), '{}'::text[])
      into v_equipment
      from jsonb_array_elements_text(coalesce(v_values -> 'equipment', '[]'::jsonb)) item(value);

      select coalesce(array_agg(item.value::uuid), '{}'::uuid[])
      into v_group_ids
      from jsonb_array_elements_text(coalesce(v_values -> 'group_ids', '[]'::jsonb)) item(value);

      v_parameters := '[]'::jsonb;
      for v_parameter in
        select item.value
        from jsonb_array_elements(coalesce(v_values -> 'parameters', '[]'::jsonb)) item(value)
        order by coalesce((item.value ->> 'sort_order')::integer, 100)
      loop
        v_parameter_key := nullif(trim(coalesce(v_parameter ->> 'parameter_key', '')), '');
        if v_parameter_key is null then
          select option_row.option_key
          into v_parameter_key
          from public.organization_dropdown_options option_row
          where option_row.organization_id = p_organization_id
            and option_row.list_key = 'planning_parameter'
            and lower(trim(option_row.label)) = lower(trim(v_parameter ->> 'label'))
            and option_row.is_active
          order by option_row.sort_order, option_row.option_key
          limit 1;
        end if;
        if v_parameter_key is null then
          raise exception 'Planungsparameter „%“ wurde nicht gefunden.', coalesce(v_parameter ->> 'label', '');
        end if;
        v_parameters := v_parameters || jsonb_build_array(
          jsonb_set(v_parameter, '{parameter_key}', to_jsonb(v_parameter_key), true)
        );
      end loop;

      -- Der Import hat seine eigene transaktionale Lock-/Versionsprüfung und darf daher
      -- nicht über v3/v4 erneut einen UI-Lock verlangen. Die neuen v4-Felder werden
      -- unmittelbar danach in derselben Transaktion validiert gespeichert.
      v_exercise_id := public.save_exercise_catalog_item_v2(
        p_organization_id,
        case when v_action = 'update' then (v_row ->> 'existing_id')::uuid else null end,
        v_values ->> 'name',
        v_category_key,
        nullif(trim(coalesce(v_values ->> 'subcategory', '')), ''),
        nullif(trim(coalesce(v_values ->> 'goal', '')), ''),
        nullif(trim(coalesce(v_values ->> 'description', '')), ''),
        nullif(trim(coalesce(v_values ->> 'coaching_cues', '')), ''),
        nullif(trim(coalesce(v_values ->> 'common_mistakes', '')), ''),
        v_equipment,
        nullif(trim(coalesce(v_values ->> 'video_url', '')), ''),
        coalesce((v_values ->> 'is_active')::boolean, true),
        v_group_ids,
        v_parameters
      );

      update public.exercises
      set difficulty_key = v_difficulty_key,
          updated_at = now()
      where id = v_exercise_id
        and organization_id = p_organization_id;

      if v_action = 'create' then v_created := v_created + 1;
      else v_updated := v_updated + 1;
      end if;

      v_result_rows := v_result_rows || jsonb_build_array(jsonb_build_object(
        'row_number', v_row_number,
        'label', v_label,
        'action', v_action,
        'success', true,
        'message', case when v_action = 'create' then 'Neu angelegt.' else 'Aktualisiert.' end,
        'id', v_exercise_id
      ));
    exception when others then
      raise exception 'Zeile % (%): %', v_row_number, v_label, sqlerrm;
    end;
  end loop;

  -- Zweiter Durchlauf: ähnliche Übungen nach den finalen IDs/Namen auflösen.
  -- Beziehungen sind symmetrisch. Deshalb entfernen wir zuerst gesammelt alle alten
  -- Beziehungen der tatsächlich importierten Übungen und bauen anschließend die
  -- Vereinigungsmenge aller in der Datei gewünschten Beziehungen neu auf. So hängt
  -- das Ergebnis nicht von der Reihenfolge der Importzeilen ab.
  delete from public.exercise_similarities similarity
  where similarity.organization_id = p_organization_id
    and (
      similarity.exercise_id in (
        select exercise.id
        from jsonb_array_elements(p_rows) item(value)
        join public.exercises exercise
          on exercise.organization_id = p_organization_id
         and exercise.id = case
           when item.value ->> 'action' = 'update' then (item.value ->> 'existing_id')::uuid
           else exercise.id
         end
         and (
           item.value ->> 'action' = 'update'
           or exercise.normalized_name = public.normalize_catalog_name(item.value -> 'values' ->> 'name')
         )
        where item.value ->> 'action' in ('create', 'update')
      )
      or similarity.related_exercise_id in (
        select exercise.id
        from jsonb_array_elements(p_rows) item(value)
        join public.exercises exercise
          on exercise.organization_id = p_organization_id
         and exercise.id = case
           when item.value ->> 'action' = 'update' then (item.value ->> 'existing_id')::uuid
           else exercise.id
         end
         and (
           item.value ->> 'action' = 'update'
           or exercise.normalized_name = public.normalize_catalog_name(item.value -> 'values' ->> 'name')
         )
        where item.value ->> 'action' in ('create', 'update')
      )
    );

  for v_row in
    select item.value
    from jsonb_array_elements(p_rows) item(value)
    where item.value ->> 'action' in ('create', 'update')
    order by coalesce((item.value ->> 'row_number')::integer, 0)
  loop
    v_row_number := coalesce((v_row ->> 'row_number')::integer, 0);
    v_label := coalesce(nullif(trim(v_row ->> 'label'), ''), 'Unbenannte Zeile');
    v_values := v_row -> 'values';

    if v_row ->> 'action' = 'update' then
      v_exercise_id := (v_row ->> 'existing_id')::uuid;
    else
      select exercise.id
      into v_exercise_id
      from public.exercises exercise
      where exercise.organization_id = p_organization_id
        and exercise.normalized_name = public.normalize_catalog_name(v_values ->> 'name')
      order by exercise.created_at desc
      limit 1;
    end if;

    if v_exercise_id is null then
      raise exception 'Zeile % (%): Die soeben importierte Übung konnte nicht wiedergefunden werden.', v_row_number, v_label;
    end if;

    for v_similar_ref in
      select item.value
      from jsonb_array_elements(coalesce(v_values -> 'similar_exercise_refs', '[]'::jsonb)) item(value)
    loop
      v_similar_id := null;
      if nullif(trim(coalesce(v_similar_ref ->> 'id', '')), '') is not null then
        select exercise.id
        into v_similar_id
        from public.exercises exercise
        where exercise.organization_id = p_organization_id
          and exercise.id = (v_similar_ref ->> 'id')::uuid;
      elsif nullif(trim(coalesce(v_similar_ref ->> 'name', '')), '') is not null then
        select exercise.id
        into v_similar_id
        from public.exercises exercise
        where exercise.organization_id = p_organization_id
          and exercise.normalized_name = public.normalize_catalog_name(v_similar_ref ->> 'name')
        order by exercise.created_at desc
        limit 1;
      end if;

      if v_similar_id is null then
        raise exception 'Zeile % (%): Ähnliche Übung „%“ wurde nicht gefunden.',
          v_row_number, v_label, coalesce(v_similar_ref ->> 'name', v_similar_ref ->> 'id', '');
      end if;
      if v_similar_id = v_exercise_id then
        raise exception 'Zeile % (%): Eine Übung kann nicht mit sich selbst verknüpft werden.', v_row_number, v_label;
      end if;

      insert into public.exercise_similarities (
        organization_id,
        exercise_id,
        related_exercise_id,
        created_by
      ) values (
        p_organization_id,
        least(v_exercise_id, v_similar_id),
        greatest(v_exercise_id, v_similar_id),
        v_user_id
      )
      on conflict (exercise_id, related_exercise_id) do nothing;
    end loop;
  end loop;

  v_result := jsonb_build_object(
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'failed', 0,
    'rows', v_result_rows
  );

  insert into public.data_import_runs (
    organization_id, import_id, import_kind, requested_by, payload_hash, result
  ) values (
    p_organization_id, p_import_id, 'exercises', v_user_id, v_payload_hash, v_result
  );

  return v_result;
end;
$$;

revoke all on function public.apply_exercise_import_v2(uuid, uuid, jsonb, jsonb) from public;
grant execute on function public.apply_exercise_import_v2(uuid, uuid, jsonb, jsonb) to authenticated;
