-- Übungskatalog-UX: persistente Gruppen für Planungsparameter.
-- Die Gruppierung ist Stammdatenlogik und wird daher nicht aus Bezeichnungen im Client abgeleitet.

begin;

alter table public.organization_dropdown_options
  add column if not exists parameter_group text not null default 'execution';

alter table public.organization_dropdown_options
  drop constraint if exists organization_dropdown_options_parameter_group_check;
alter table public.organization_dropdown_options
  add constraint organization_dropdown_options_parameter_group_check
  check (parameter_group in ('volume', 'distance_geometry', 'time_recovery', 'load', 'execution'));

update public.organization_dropdown_options
set parameter_group = case
  when option_key in ('sets', 'repetitions', 'contacts') then 'volume'
  when option_key in ('distance_m', 'approach_distance_m', 'flying_distance_m', 'height_cm') then 'distance_geometry'
  when option_key in ('duration_s', 'target_time_s', 'rest_s', 'series_rest_s') then 'time_recovery'
  when option_key in ('weight_kg', 'resistance_kg', 'intensity_percent') then 'load'
  else 'execution'
end,
updated_at = now()
where list_key = 'planning_parameter';

-- Auch neu angelegte Organisationen erhalten die Standardparameter bereits richtig gruppiert.
create or replace function public.seed_planning_parameters_for_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_dropdown_options (
    organization_id, list_key, option_key, label, unit, input_type, step_value, parameter_group, sort_order, is_active
  ) values
    (new.id, 'planning_parameter', 'sets', 'Sätze', '', 'number', 1, 'volume', 10, true),
    (new.id, 'planning_parameter', 'repetitions', 'Wiederholungen', '', 'number', 1, 'volume', 20, true),
    (new.id, 'planning_parameter', 'distance_m', 'Distanz', 'm', 'number', 1, 'distance_geometry', 30, true),
    (new.id, 'planning_parameter', 'weight_kg', 'Gewicht', 'kg', 'number', 0.5, 'load', 40, true),
    (new.id, 'planning_parameter', 'duration_s', 'Dauer', 's', 'number', 1, 'time_recovery', 50, true),
    (new.id, 'planning_parameter', 'target_time_s', 'Zielzeit', 's', 'number', 0.01, 'time_recovery', 60, true),
    (new.id, 'planning_parameter', 'intensity_percent', 'Intensität', '%', 'number', 1, 'load', 70, true),
    (new.id, 'planning_parameter', 'rest_s', 'Pause', 's', 'number', 5, 'time_recovery', 80, true),
    (new.id, 'planning_parameter', 'series_rest_s', 'Serienpause', 's', 'number', 5, 'time_recovery', 90, true),
    (new.id, 'planning_parameter', 'approach_distance_m', 'Anlauf', 'm', 'number', 1, 'distance_geometry', 100, true),
    (new.id, 'planning_parameter', 'flying_distance_m', 'Fliegende Distanz', 'm', 'number', 1, 'distance_geometry', 110, true),
    (new.id, 'planning_parameter', 'contacts', 'Kontakte', '', 'number', 1, 'volume', 120, true),
    (new.id, 'planning_parameter', 'resistance_kg', 'Widerstand', 'kg', 'number', 0.5, 'load', 130, true),
    (new.id, 'planning_parameter', 'height_cm', 'Höhe', 'cm', 'number', 1, 'distance_geometry', 140, true),
    (new.id, 'planning_parameter', 'tempo_text', 'Tempo', '', 'text', null, 'execution', 150, true),
    (new.id, 'planning_parameter', 'surface_text', 'Untergrund', '', 'text', null, 'execution', 160, true),
    (new.id, 'planning_parameter', 'start_position_text', 'Startposition', '', 'text', null, 'execution', 170, true),
    (new.id, 'planning_parameter', 'note_text', 'Zusatzhinweis', '', 'text', null, 'execution', 180, true)
  on conflict (organization_id, list_key, option_key) do nothing;

  return new;
end;
$$;

drop trigger if exists organizations_seed_planning_parameters on public.organizations;
create trigger organizations_seed_planning_parameters
after insert on public.organizations
for each row execute function public.seed_planning_parameters_for_organization();

create or replace function public.dropdown_settings_overview(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'dropdown_settings',
    false
  ) then
    raise exception 'Für die Auswahllisten fehlen die erforderlichen Rechte.';
  end if;

  return jsonb_build_object(
    'category', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', null,
          'key', category.key,
          'label', assignment.title,
          'unit', '',
          'input_type', 'text',
          'step_value', null,
          'sort_order', assignment.sort_order,
          'is_active', assignment.is_active and category.is_active,
          'usage_count', (
            select count(*)
            from public.exercises exercise
            where exercise.organization_id = p_organization_id
              and exercise.category_key = category.key
          )
        ) order by assignment.sort_order, lower(assignment.title)
      )
      from public.organization_exercise_categories assignment
      join public.exercise_categories category on category.key = assignment.category_key
      where assignment.organization_id = p_organization_id
    ), '[]'::jsonb),
    'subcategory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'key', option.option_key,
        'label', option.label,
        'unit', option.unit,
        'input_type', option.input_type,
        'step_value', option.step_value,
        'parameter_group', option.parameter_group,
        'sort_order', option.sort_order,
        'is_active', option.is_active,
        'usage_count', (
          select count(*) from public.exercises exercise
          where exercise.organization_id = p_organization_id
            and exercise.subcategory = option.label
        )
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id and option.list_key = 'subcategory'
    ), '[]'::jsonb),
    'material', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'key', option.option_key,
        'label', option.label,
        'unit', option.unit,
        'input_type', option.input_type,
        'step_value', option.step_value,
        'parameter_group', option.parameter_group,
        'sort_order', option.sort_order,
        'is_active', option.is_active,
        'usage_count', (
          select count(*) from public.exercises exercise
          where exercise.organization_id = p_organization_id
            and option.label = any(exercise.equipment)
        )
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id and option.list_key = 'material'
    ), '[]'::jsonb),
    'difficulty', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'key', option.option_key,
        'label', option.label,
        'unit', option.unit,
        'input_type', option.input_type,
        'step_value', option.step_value,
        'parameter_group', option.parameter_group,
        'sort_order', option.sort_order,
        'is_active', option.is_active,
        'usage_count', (
          select count(*) from public.exercises exercise
          where exercise.organization_id = p_organization_id
            and exercise.difficulty_key = option.option_key
        )
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id and option.list_key = 'difficulty'
    ), '[]'::jsonb),
    'planning_parameter', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'key', option.option_key,
        'label', option.label,
        'unit', option.unit,
        'input_type', option.input_type,
        'step_value', option.step_value,
        'parameter_group', option.parameter_group,
        'sort_order', option.sort_order,
        'is_active', option.is_active,
        'usage_count', (
          select count(*) from public.exercise_parameter_definitions parameter
          where parameter.organization_id = p_organization_id
            and parameter.parameter_key = option.option_key
        )
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id and option.list_key = 'planning_parameter'
    ), '[]'::jsonb)
  );
end;
$$;

-- Die Signatur wird um die Gruppe erweitert. Der letzte Parameter besitzt einen Default,
-- damit bestehende serverseitige 9-Argument-Aufrufe kompatibel bleiben.
drop function if exists public.save_dropdown_setting(uuid, text, uuid, text, text, text, text, numeric, integer);

create or replace function public.save_dropdown_setting(
  p_organization_id uuid,
  p_list_key text,
  p_option_id uuid default null,
  p_option_key text default null,
  p_label text default null,
  p_unit text default '',
  p_input_type text default 'text',
  p_step_value numeric default null,
  p_sort_order integer default 100,
  p_parameter_group text default 'execution'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_label text := trim(coalesce(p_label, ''));
  v_key text := nullif(trim(coalesce(p_option_key, '')), '');
  v_old_label text;
  v_old_input_type text;
  v_option_id uuid := p_option_id;
  v_parameter_group text := case
    when p_list_key = 'planning_parameter' then coalesce(nullif(trim(p_parameter_group), ''), 'execution')
    else 'execution'
  end;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'dropdown_settings',
    true
  ) then
    raise exception 'Du darfst die Auswahllisten nicht bearbeiten.';
  end if;

  if p_list_key not in ('category', 'subcategory', 'material', 'planning_parameter', 'difficulty') then
    raise exception 'Unbekannte Auswahlliste.';
  end if;
  if char_length(v_label) < 2 then
    raise exception 'Die Bezeichnung ist zu kurz.';
  end if;
  if p_input_type not in ('number', 'text') then
    raise exception 'Der Eingabetyp ist ungültig.';
  end if;
  if p_step_value is not null and p_step_value <= 0 then
    raise exception 'Die Schrittweite muss größer als 0 sein.';
  end if;
  if v_parameter_group not in ('volume', 'distance_geometry', 'time_recovery', 'load', 'execution') then
    raise exception 'Die Parametergruppe ist ungültig.';
  end if;

  if p_list_key = 'category' then
    if exists (
      select 1
      from public.organization_exercise_categories assignment
      where assignment.organization_id = p_organization_id
        and lower(trim(assignment.title)) = lower(v_label)
        and (v_key is null or assignment.category_key <> v_key)
    ) then
      raise exception 'Eine Kategorie mit dieser Bezeichnung existiert bereits.';
    end if;
    if v_key is null then
      v_key := 'org_' || substr(replace(p_organization_id::text, '-', ''), 1, 8)
        || '_' || substr(md5(v_label || clock_timestamp()::text), 1, 12);
      insert into public.exercise_categories (key, title, sort_order, is_active)
      values (v_key, v_label, coalesce(p_sort_order, 100), true);
      insert into public.organization_exercise_categories (
        organization_id, category_key, title, sort_order, is_active
      ) values (
        p_organization_id, v_key, v_label, coalesce(p_sort_order, 100), true
      );
    else
      if not exists (
        select 1 from public.organization_exercise_categories assignment
        where assignment.organization_id = p_organization_id
          and assignment.category_key = v_key
      ) then
        raise exception 'Die Kategorie wurde nicht gefunden.';
      end if;
      update public.organization_exercise_categories
      set title = v_label, sort_order = coalesce(p_sort_order, 100), updated_at = now()
      where organization_id = p_organization_id and category_key = v_key;
    end if;
    return v_key;
  end if;

  if exists (
    select 1
    from public.organization_dropdown_options option
    where option.organization_id = p_organization_id
      and option.list_key = p_list_key
      and lower(trim(option.label)) = lower(v_label)
      and (v_option_id is null or option.id <> v_option_id)
  ) then
    raise exception 'Ein Eintrag mit dieser Bezeichnung existiert bereits.';
  end if;

  if v_option_id is null then
    if v_key is null then
      v_key := case when p_list_key = 'planning_parameter' then 'custom_' else p_list_key || '_' end
        || substr(md5(p_organization_id::text || v_label || clock_timestamp()::text), 1, 18);
    end if;

    insert into public.organization_dropdown_options (
      organization_id, list_key, option_key, label, unit, input_type,
      step_value, parameter_group, sort_order, is_active
    ) values (
      p_organization_id,
      p_list_key,
      v_key,
      v_label,
      case when p_list_key = 'planning_parameter' then trim(coalesce(p_unit, '')) else '' end,
      case when p_list_key = 'planning_parameter' then p_input_type else 'text' end,
      case when p_list_key = 'planning_parameter' and p_input_type = 'number' then p_step_value else null end,
      v_parameter_group,
      coalesce(p_sort_order, 100),
      true
    )
    returning id into v_option_id;
  else
    select option.label, option.option_key, option.input_type
    into v_old_label, v_key, v_old_input_type
    from public.organization_dropdown_options option
    where option.id = v_option_id
      and option.organization_id = p_organization_id
      and option.list_key = p_list_key;

    if v_old_label is null then
      raise exception 'Der Eintrag wurde nicht gefunden.';
    end if;

    if p_list_key = 'planning_parameter'
      and v_old_input_type <> p_input_type
      and exists (
        select 1
        from public.exercise_parameter_definitions parameter
        where parameter.organization_id = p_organization_id
          and parameter.parameter_key = v_key
      ) then
      raise exception 'Der Eingabetyp eines bereits verwendeten Planungsparameters kann nicht geändert werden.';
    end if;

    update public.organization_dropdown_options
    set
      label = v_label,
      unit = case when p_list_key = 'planning_parameter' then trim(coalesce(p_unit, '')) else '' end,
      input_type = case when p_list_key = 'planning_parameter' then p_input_type else 'text' end,
      step_value = case when p_list_key = 'planning_parameter' and p_input_type = 'number' then p_step_value else null end,
      parameter_group = v_parameter_group,
      sort_order = coalesce(p_sort_order, 100),
      updated_at = now()
    where id = v_option_id;

    if p_list_key = 'subcategory' and v_old_label <> v_label then
      update public.exercises
      set subcategory = v_label, updated_at = now()
      where organization_id = p_organization_id and subcategory = v_old_label;
    elsif p_list_key = 'material' and v_old_label <> v_label then
      update public.exercises exercise
      set equipment = (
        select array_agg(
          case when material.value = v_old_label then v_label else material.value end
          order by material.ordinality
        )
        from unnest(exercise.equipment) with ordinality as material(value, ordinality)
      ), updated_at = now()
      where exercise.organization_id = p_organization_id
        and v_old_label = any(exercise.equipment);
    elsif p_list_key = 'planning_parameter' then
      update public.exercise_parameter_definitions
      set
        label = v_label,
        unit = trim(coalesce(p_unit, '')),
        input_type = p_input_type,
        step_value = case when p_input_type = 'number' then p_step_value else null end,
        min_value = case when p_input_type = 'number' then min_value else null end,
        max_value = case when p_input_type = 'number' then max_value else null end,
        updated_at = now()
      where organization_id = p_organization_id and parameter_key = v_key;
    end if;
  end if;

  return v_key;
end;
$$;

create or replace function public.exercise_catalog_overview_v4(
  p_organization_id uuid,
  p_include_inactive boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
begin
  v_base := public.exercise_catalog_overview_v2(p_organization_id, p_include_inactive);

  return v_base || jsonb_build_object(
    'parameter_options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', option.option_key,
        'label', option.label,
        'unit', option.unit,
        'input_type', option.input_type,
        'step_value', option.step_value,
        'parameter_group', option.parameter_group,
        'sort_order', option.sort_order,
        'is_active', option.is_active
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id
        and option.list_key = 'planning_parameter'
    ), '[]'::jsonb),
    'difficulties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', option.option_key,
        'label', option.label,
        'sort_order', option.sort_order,
        'is_active', option.is_active
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id
        and option.list_key = 'difficulty'
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(
        exercise_json || jsonb_build_object(
          'difficulty_key', exercise.difficulty_key,
          'difficulty_label', difficulty.label,
          'similar_exercise_ids', coalesce((
            select jsonb_agg(related_id order by related_id)
            from (
              select similarity.related_exercise_id as related_id
              from public.exercise_similarities similarity
              where similarity.exercise_id = exercise.id
              union
              select similarity.exercise_id as related_id
              from public.exercise_similarities similarity
              where similarity.related_exercise_id = exercise.id
            ) related
          ), '[]'::jsonb),
          'block_usage_count', (
            select count(distinct item.block_id)
            from public.training_block_items item
            where item.organization_id = p_organization_id
              and item.exercise_id = exercise.id
          ),
          'plan_usage_count', (
            select count(distinct item.plan_id)
            from public.athlete_training_plan_items item
            where item.organization_id = p_organization_id
              and item.source_exercise_id = exercise.id
          ),
          'last_used_at', (
            select max(plan.training_date)
            from public.athlete_training_plan_items item
            join public.athlete_training_plans plan on plan.id = item.plan_id
            where item.organization_id = p_organization_id
              and item.source_exercise_id = exercise.id
          )
        )
        order by lower(exercise_json ->> 'name')
      )
      from jsonb_array_elements(coalesce(v_base -> 'exercises', '[]'::jsonb)) exercise_json
      join public.exercises exercise on exercise.id = (exercise_json ->> 'id')::uuid
      left join public.organization_dropdown_options difficulty
        on difficulty.organization_id = p_organization_id
       and difficulty.list_key = 'difficulty'
       and difficulty.option_key = exercise.difficulty_key
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.save_dropdown_setting(uuid, text, uuid, text, text, text, text, numeric, integer, text) from public;
grant execute on function public.save_dropdown_setting(uuid, text, uuid, text, text, text, text, numeric, integer, text) to authenticated;

commit;
