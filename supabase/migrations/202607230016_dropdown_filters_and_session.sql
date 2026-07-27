-- ULC Linz App – zentrale Auswahllisten und erweiterte Filterdaten
-- Kategorien, Unterkategorien, Material und Planungsparameter zentral verwalten.

begin;

insert into public.app_modules (key, title, description, route, icon, sort_order, is_active)
values (
  'dropdown_settings',
  'Auswahllisten',
  'Dropdownwerte für Übungen und Planung verwalten',
  '/module/dropdown_settings',
  'list-plus',
  95,
  true
)
on conflict (key) do update
set
  title = excluded.title,
  description = excluded.description,
  route = excluded.route,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create table if not exists public.organization_exercise_categories (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_key text not null references public.exercise_categories(key) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 80),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, category_key)
);

create table if not exists public.organization_dropdown_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  list_key text not null check (list_key in ('subcategory', 'material', 'planning_parameter')),
  option_key text not null check (option_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (char_length(trim(label)) between 2 and 100),
  unit text not null default '' check (char_length(unit) <= 20),
  input_type text not null default 'text' check (input_type in ('number', 'text')),
  step_value numeric check (step_value is null or step_value > 0),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, list_key, option_key)
);

create unique index if not exists organization_dropdown_options_label_unique_idx
  on public.organization_dropdown_options (organization_id, list_key, lower(label));
create index if not exists organization_dropdown_options_list_idx
  on public.organization_dropdown_options (organization_id, list_key, is_active, sort_order);

-- Freie, organisationsspezifische Planungsparameter ermöglichen.
alter table public.exercise_parameter_definitions
  drop constraint if exists exercise_parameter_definitions_parameter_key_check;

-- Bestehende Kategorien stehen jedem bestehenden Verein zunächst zur Verfügung.
insert into public.organization_exercise_categories (
  organization_id,
  category_key,
  title,
  sort_order,
  is_active
)
select
  organization.id,
  category.key,
  category.title,
  category.sort_order,
  category.is_active
from public.organizations organization
cross join public.exercise_categories category
on conflict (organization_id, category_key) do nothing;

-- Bestehende Freitextwerte werden automatisch in die neuen Auswahllisten übernommen.
insert into public.organization_dropdown_options (
  organization_id,
  list_key,
  option_key,
  label,
  input_type,
  sort_order
)
select distinct
  exercise.organization_id,
  'subcategory',
  'subcategory_' || substr(md5(lower(trim(exercise.subcategory))), 1, 16),
  trim(exercise.subcategory),
  'text',
  100
from public.exercises exercise
where nullif(trim(exercise.subcategory), '') is not null
on conflict (organization_id, list_key, option_key) do nothing;

insert into public.organization_dropdown_options (
  organization_id,
  list_key,
  option_key,
  label,
  input_type,
  sort_order
)
select distinct
  exercise.organization_id,
  'material',
  'material_' || substr(md5(lower(trim(material.value))), 1, 16),
  trim(material.value),
  'text',
  100
from public.exercises exercise
cross join lateral unnest(exercise.equipment) as material(value)
where nullif(trim(material.value), '') is not null
on conflict (organization_id, list_key, option_key) do nothing;

with parameter_defaults(option_key, label, unit, input_type, step_value, sort_order) as (
  values
    ('sets', 'Sätze', '', 'number', 1::numeric, 10),
    ('repetitions', 'Wiederholungen', '', 'number', 1::numeric, 20),
    ('distance_m', 'Distanz', 'm', 'number', 1::numeric, 30),
    ('weight_kg', 'Gewicht', 'kg', 'number', 0.5::numeric, 40),
    ('duration_s', 'Dauer', 's', 'number', 1::numeric, 50),
    ('target_time_s', 'Zielzeit', 's', 'number', 0.01::numeric, 60),
    ('intensity_percent', 'Intensität', '%', 'number', 1::numeric, 70),
    ('rest_s', 'Pause', 's', 'number', 5::numeric, 80),
    ('series_rest_s', 'Serienpause', 's', 'number', 5::numeric, 90),
    ('approach_distance_m', 'Anlauf', 'm', 'number', 1::numeric, 100),
    ('flying_distance_m', 'Fliegende Distanz', 'm', 'number', 1::numeric, 110),
    ('contacts', 'Kontakte', '', 'number', 1::numeric, 120),
    ('resistance_kg', 'Widerstand', 'kg', 'number', 0.5::numeric, 130),
    ('height_cm', 'Höhe', 'cm', 'number', 1::numeric, 140),
    ('tempo_text', 'Tempo', '', 'text', null::numeric, 150),
    ('surface_text', 'Untergrund', '', 'text', null::numeric, 160),
    ('start_position_text', 'Startposition', '', 'text', null::numeric, 170),
    ('note_text', 'Zusatzhinweis', '', 'text', null::numeric, 180)
)
insert into public.organization_dropdown_options (
  organization_id,
  list_key,
  option_key,
  label,
  unit,
  input_type,
  step_value,
  sort_order
)
select
  organization.id,
  'planning_parameter',
  parameter_defaults.option_key,
  parameter_defaults.label,
  parameter_defaults.unit,
  parameter_defaults.input_type,
  parameter_defaults.step_value,
  parameter_defaults.sort_order
from public.organizations organization
cross join parameter_defaults
on conflict (organization_id, list_key, option_key) do update
set
  label = excluded.label,
  unit = excluded.unit,
  input_type = excluded.input_type,
  step_value = excluded.step_value,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Bereits in Übungen vorkommende Parameter ebenfalls übernehmen, falls sie individuell ergänzt wurden.
insert into public.organization_dropdown_options (
  organization_id,
  list_key,
  option_key,
  label,
  unit,
  input_type,
  step_value,
  sort_order
)
select distinct on (parameter.organization_id, parameter.parameter_key)
  parameter.organization_id,
  'planning_parameter',
  parameter.parameter_key,
  parameter.label,
  parameter.unit,
  parameter.input_type,
  parameter.step_value,
  parameter.sort_order
from public.exercise_parameter_definitions parameter
order by parameter.organization_id, parameter.parameter_key, parameter.updated_at desc
on conflict (organization_id, list_key, option_key) do nothing;

-- Vorbereitete Verwendungsreferenzen für die spätere Trainingsplanung.
create table if not exists public.training_block_usages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (block_id, source_type, source_id)
);
create index if not exists training_block_usages_block_idx
  on public.training_block_usages (organization_id, block_id);

-- Zeitstempel und RLS.
drop trigger if exists organization_exercise_categories_set_updated_at on public.organization_exercise_categories;
create trigger organization_exercise_categories_set_updated_at
before update on public.organization_exercise_categories
for each row execute function public.set_updated_at();

drop trigger if exists organization_dropdown_options_set_updated_at on public.organization_dropdown_options;
create trigger organization_dropdown_options_set_updated_at
before update on public.organization_dropdown_options
for each row execute function public.set_updated_at();

alter table public.organization_exercise_categories enable row level security;
alter table public.organization_dropdown_options enable row level security;
alter table public.training_block_usages enable row level security;

drop policy if exists organization_exercise_categories_read on public.organization_exercise_categories;
drop policy if exists organization_exercise_categories_write on public.organization_exercise_categories;
drop policy if exists organization_dropdown_options_read on public.organization_dropdown_options;
drop policy if exists organization_dropdown_options_write on public.organization_dropdown_options;
drop policy if exists training_block_usages_read on public.training_block_usages;
drop policy if exists training_block_usages_write on public.training_block_usages;

create policy organization_exercise_categories_read
on public.organization_exercise_categories
for select to authenticated
using (
  public.has_module_access(organization_id, 'exercise_catalog', false)
  or public.has_module_access(organization_id, 'dropdown_settings', false)
);
create policy organization_exercise_categories_write
on public.organization_exercise_categories
for all to authenticated
using (public.has_module_access(organization_id, 'dropdown_settings', true))
with check (public.has_module_access(organization_id, 'dropdown_settings', true));

create policy organization_dropdown_options_read
on public.organization_dropdown_options
for select to authenticated
using (
  public.has_module_access(organization_id, 'exercise_catalog', false)
  or public.has_module_access(organization_id, 'training_blocks', false)
  or public.has_module_access(organization_id, 'dropdown_settings', false)
);
create policy organization_dropdown_options_write
on public.organization_dropdown_options
for all to authenticated
using (public.has_module_access(organization_id, 'dropdown_settings', true))
with check (public.has_module_access(organization_id, 'dropdown_settings', true));

create policy training_block_usages_read
on public.training_block_usages
for select to authenticated
using (public.has_module_access(organization_id, 'training_blocks', false));
create policy training_block_usages_write
on public.training_block_usages
for all to authenticated
using (public.has_module_access(organization_id, 'training_planning', true))
with check (public.has_module_access(organization_id, 'training_planning', true));

revoke all on table public.organization_exercise_categories from anon, authenticated;
revoke all on table public.organization_dropdown_options from anon, authenticated;
revoke all on table public.training_block_usages from anon, authenticated;

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
      select jsonb_agg(
        jsonb_build_object(
          'id', option.id,
          'key', option.option_key,
          'label', option.label,
          'unit', option.unit,
          'input_type', option.input_type,
          'step_value', option.step_value,
          'sort_order', option.sort_order,
          'is_active', option.is_active,
          'usage_count', (
            select count(*)
            from public.exercises exercise
            where exercise.organization_id = p_organization_id
              and exercise.subcategory = option.label
          )
        ) order by option.sort_order, lower(option.label)
      )
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id
        and option.list_key = 'subcategory'
    ), '[]'::jsonb),
    'material', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option.id,
          'key', option.option_key,
          'label', option.label,
          'unit', option.unit,
          'input_type', option.input_type,
          'step_value', option.step_value,
          'sort_order', option.sort_order,
          'is_active', option.is_active,
          'usage_count', (
            select count(*)
            from public.exercises exercise
            where exercise.organization_id = p_organization_id
              and option.label = any(exercise.equipment)
          )
        ) order by option.sort_order, lower(option.label)
      )
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id
        and option.list_key = 'material'
    ), '[]'::jsonb),
    'planning_parameter', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option.id,
          'key', option.option_key,
          'label', option.label,
          'unit', option.unit,
          'input_type', option.input_type,
          'step_value', option.step_value,
          'sort_order', option.sort_order,
          'is_active', option.is_active,
          'usage_count', (
            select count(*)
            from public.exercise_parameter_definitions parameter
            where parameter.organization_id = p_organization_id
              and parameter.parameter_key = option.option_key
          )
        ) order by option.sort_order, lower(option.label)
      )
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id
        and option.list_key = 'planning_parameter'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_dropdown_setting(
  p_organization_id uuid,
  p_list_key text,
  p_option_id uuid default null,
  p_option_key text default null,
  p_label text default null,
  p_unit text default '',
  p_input_type text default 'text',
  p_step_value numeric default null,
  p_sort_order integer default 100
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
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'dropdown_settings',
    true
  ) then
    raise exception 'Du darfst die Auswahllisten nicht bearbeiten.';
  end if;

  if p_list_key not in ('category', 'subcategory', 'material', 'planning_parameter') then
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
      v_key := 'org_' || substr(replace(p_organization_id::text, '-', ''), 1, 8) || '_' || substr(md5(v_label || clock_timestamp()::text), 1, 12);
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
      where organization_id = p_organization_id
        and category_key = v_key;
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
      step_value, sort_order, is_active
    ) values (
      p_organization_id,
      p_list_key,
      v_key,
      v_label,
      case when p_list_key = 'planning_parameter' then trim(coalesce(p_unit, '')) else '' end,
      case when p_list_key = 'planning_parameter' then p_input_type else 'text' end,
      case when p_list_key = 'planning_parameter' and p_input_type = 'number' then p_step_value else null end,
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
      sort_order = coalesce(p_sort_order, 100),
      updated_at = now()
    where id = v_option_id;

    if p_list_key = 'subcategory' and v_old_label <> v_label then
      update public.exercises
      set subcategory = v_label, updated_at = now()
      where organization_id = p_organization_id
        and subcategory = v_old_label;
    elsif p_list_key = 'material' and v_old_label <> v_label then
      update public.exercises exercise
      set equipment = (
        select array_agg(case when material.value = v_old_label then v_label else material.value end order by material.ordinality)
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
      where organization_id = p_organization_id
        and parameter_key = v_key;
    end if;
  end if;

  return v_key;
end;
$$;

create or replace function public.set_dropdown_setting_active(
  p_organization_id uuid,
  p_list_key text,
  p_option_id uuid default null,
  p_option_key text default null,
  p_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'dropdown_settings',
    true
  ) then
    raise exception 'Du darfst die Auswahllisten nicht bearbeiten.';
  end if;

  if p_list_key = 'category' then
    update public.organization_exercise_categories
    set is_active = p_is_active, updated_at = now()
    where organization_id = p_organization_id
      and category_key = p_option_key;
    if not found then raise exception 'Die Kategorie wurde nicht gefunden.'; end if;
  else
    update public.organization_dropdown_options
    set is_active = p_is_active, updated_at = now()
    where organization_id = p_organization_id
      and list_key = p_list_key
      and id = p_option_id;
    if not found then raise exception 'Der Eintrag wurde nicht gefunden.'; end if;
  end if;
end;
$$;

create or replace function public.exercise_catalog_overview_v2(
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
  v_base := public.exercise_catalog_overview(p_organization_id, p_include_inactive);

  return v_base || jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', category.key,
          'title', assignment.title,
          'sort_order', assignment.sort_order,
          'is_active', assignment.is_active and category.is_active
        ) order by assignment.sort_order, lower(assignment.title)
      )
      from public.organization_exercise_categories assignment
      join public.exercise_categories category on category.key = assignment.category_key
      where assignment.organization_id = p_organization_id
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(
        exercise_json || jsonb_build_object(
          'category_title', coalesce(assignment.title, exercise_json ->> 'category_title')
        )
        order by lower(exercise_json ->> 'name')
      )
      from jsonb_array_elements(coalesce(v_base -> 'exercises', '[]'::jsonb)) exercise_json
      left join public.organization_exercise_categories assignment
        on assignment.organization_id = p_organization_id
       and assignment.category_key = exercise_json ->> 'category_key'
    ), '[]'::jsonb),
    'subcategories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', option.option_key,
        'label', option.label,
        'sort_order', option.sort_order,
        'is_active', option.is_active
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id and option.list_key = 'subcategory'
    ), '[]'::jsonb),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', option.option_key,
        'label', option.label,
        'sort_order', option.sort_order,
        'is_active', option.is_active
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id and option.list_key = 'material'
    ), '[]'::jsonb),
    'parameter_options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', option.option_key,
        'label', option.label,
        'unit', option.unit,
        'input_type', option.input_type,
        'step_value', option.step_value,
        'sort_order', option.sort_order,
        'is_active', option.is_active
      ) order by option.sort_order, lower(option.label))
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id and option.list_key = 'planning_parameter'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_exercise_catalog_item_v2(
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
  p_parameters jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_exercise_id uuid;
  v_standard_parameters jsonb;
  v_parameter jsonb;
  v_parameter_key text;
  v_input_type text;
  v_min numeric;
  v_max numeric;
  v_equipment text;
begin
  if v_current_user_id is null or not public.has_module_access(p_organization_id, 'exercise_catalog', true) then
    raise exception 'Du darfst den Übungskatalog nicht bearbeiten.';
  end if;

  if not exists (
    select 1
    from public.organization_exercise_categories assignment
    join public.exercise_categories category on category.key = assignment.category_key
    where assignment.organization_id = p_organization_id
      and assignment.category_key = p_category_key
      and (
        (assignment.is_active and category.is_active)
        or exists (
          select 1 from public.exercises existing
          where existing.id = p_exercise_id
            and existing.organization_id = p_organization_id
            and existing.category_key = p_category_key
        )
      )
  ) then
    raise exception 'Die ausgewählte Übungskategorie ist ungültig oder inaktiv.';
  end if;

  if nullif(trim(coalesce(p_subcategory, '')), '') is not null and not exists (
    select 1
    from public.organization_dropdown_options option
    where option.organization_id = p_organization_id
      and option.list_key = 'subcategory'
      and option.label = trim(p_subcategory)
      and (
        option.is_active
        or exists (
          select 1 from public.exercises existing
          where existing.id = p_exercise_id
            and existing.organization_id = p_organization_id
            and existing.subcategory = option.label
        )
      )
  ) then
    raise exception 'Die ausgewählte Unterkategorie ist ungültig oder inaktiv.';
  end if;

  foreach v_equipment in array coalesce(p_equipment, '{}'::text[]) loop
    if not exists (
      select 1
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id
        and option.list_key = 'material'
        and option.label = v_equipment
        and (
          option.is_active
          or exists (
            select 1 from public.exercises existing
            where existing.id = p_exercise_id
              and existing.organization_id = p_organization_id
              and v_equipment = any(existing.equipment)
          )
        )
    ) then
      raise exception 'Das Material % ist ungültig oder inaktiv.', v_equipment;
    end if;
  end loop;

  if jsonb_typeof(coalesce(p_parameters, '[]'::jsonb)) <> 'array' then
    raise exception 'Die Planungsparameter besitzen ein ungültiges Format.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb)) as items(element)
  ) <> (
    select count(distinct element ->> 'parameter_key')
    from jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb)) as items(element)
  ) then
    raise exception 'Ein Planungsparameter wurde mehrfach ausgewählt.';
  end if;

  for v_parameter in
    select element from jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb)) as items(element)
  loop
    v_parameter_key := v_parameter ->> 'parameter_key';
    v_input_type := v_parameter ->> 'input_type';

    if not exists (
      select 1
      from public.organization_dropdown_options option
      where option.organization_id = p_organization_id
        and option.list_key = 'planning_parameter'
        and option.option_key = v_parameter_key
        and option.input_type = v_input_type
        and (
          option.is_active
          or exists (
            select 1
            from public.exercise_parameter_definitions existing_parameter
            where existing_parameter.exercise_id = p_exercise_id
              and existing_parameter.parameter_key = v_parameter_key
          )
        )
    ) then
      raise exception 'Der Planungsparameter % ist ungültig oder inaktiv.', coalesce(v_parameter_key, 'leer');
    end if;

    begin
      v_min := nullif(v_parameter ->> 'min_value', '')::numeric;
      v_max := nullif(v_parameter ->> 'max_value', '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Minimum oder Maximum des Parameters % ist ungültig.', v_parameter_key;
    end;
    if v_min is not null and v_max is not null and v_min > v_max then
      raise exception 'Beim Parameter % liegt das Minimum über dem Maximum.', v_parameter_key;
    end if;
  end loop;

  select coalesce(jsonb_agg(element), '[]'::jsonb)
  into v_standard_parameters
  from jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb)) as items(element)
  where element ->> 'parameter_key' in (
    'sets', 'repetitions', 'distance_m', 'weight_kg', 'duration_s',
    'target_time_s', 'intensity_percent', 'rest_s', 'series_rest_s',
    'approach_distance_m', 'flying_distance_m', 'contacts', 'resistance_kg',
    'height_cm', 'tempo_text', 'surface_text', 'start_position_text', 'note_text'
  );

  v_exercise_id := public.save_exercise_catalog_item(
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
    v_standard_parameters
  );

  insert into public.exercise_parameter_definitions (
    organization_id,
    exercise_id,
    parameter_key,
    label,
    unit,
    input_type,
    default_value,
    min_value,
    max_value,
    step_value,
    is_required,
    sort_order
  )
  select
    p_organization_id,
    v_exercise_id,
    parameter ->> 'parameter_key',
    coalesce(nullif(trim(parameter ->> 'label'), ''), parameter ->> 'parameter_key'),
    coalesce(parameter ->> 'unit', ''),
    parameter ->> 'input_type',
    nullif(parameter ->> 'default_value', ''),
    nullif(parameter ->> 'min_value', '')::numeric,
    nullif(parameter ->> 'max_value', '')::numeric,
    nullif(parameter ->> 'step_value', '')::numeric,
    coalesce((parameter ->> 'is_required')::boolean, false),
    coalesce((parameter ->> 'sort_order')::integer, parameter_ordinality::integer)
  from jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb))
    with ordinality as parameter_values(parameter, parameter_ordinality)
  where parameter ->> 'parameter_key' not in (
    'sets', 'repetitions', 'distance_m', 'weight_kg', 'duration_s',
    'target_time_s', 'intensity_percent', 'rest_s', 'series_rest_s',
    'approach_distance_m', 'flying_distance_m', 'contacts', 'resistance_kg',
    'height_cm', 'tempo_text', 'surface_text', 'start_position_text', 'note_text'
  );

  return v_exercise_id;
end;
$$;

create or replace function public.training_block_overview_v2(
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
  v_base := public.training_block_overview(p_organization_id, p_include_inactive);

  return v_base || jsonb_build_object(
    'exercises', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', exercise.id,
          'name', exercise.name,
          'category_key', exercise.category_key,
          'category_title', coalesce(category_assignment.title, category.title),
          'subcategory', exercise.subcategory,
          'goal', exercise.goal,
          'equipment', to_jsonb(exercise.equipment),
          'group_ids', coalesce((
            select jsonb_agg(assignment.group_id order by assignment.group_id)
            from public.exercise_group_assignments assignment
            where assignment.exercise_id = exercise.id
          ), '[]'::jsonb),
          'is_active', exercise.is_active,
          'parameters', coalesce((
            select jsonb_agg(jsonb_build_object(
              'parameter_key', parameter.parameter_key,
              'label', parameter.label,
              'unit', parameter.unit,
              'input_type', parameter.input_type,
              'default_value', parameter.default_value,
              'min_value', parameter.min_value,
              'max_value', parameter.max_value,
              'step_value', parameter.step_value,
              'is_required', parameter.is_required,
              'sort_order', parameter.sort_order
            ) order by parameter.sort_order, parameter.label)
            from public.exercise_parameter_definitions parameter
            where parameter.exercise_id = exercise.id
          ), '[]'::jsonb)
        ) order by lower(exercise.name)
      )
      from public.exercises exercise
      join public.exercise_categories category on category.key = exercise.category_key
      left join public.organization_exercise_categories category_assignment
        on category_assignment.organization_id = p_organization_id
       and category_assignment.category_key = exercise.category_key
      where exercise.organization_id = p_organization_id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(block_with_usage.payload order by lower(block_with_usage.name))
      from (
        select
          block.name,
          jsonb_build_object(
            'id', block.id,
            'name', block.name,
            'goal', block.goal,
            'description', block.description,
            'estimated_minutes', block.estimated_minutes,
            'is_active', block.is_active,
            'group_ids', coalesce((
              select jsonb_agg(assignment.group_id order by assignment.group_id)
              from public.training_block_group_assignments assignment
              where assignment.block_id = block.id
            ), '[]'::jsonb),
            'items', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', item.id,
                'exercise_id', exercise.id,
                'exercise_name', exercise.name,
                'exercise_is_active', exercise.is_active,
                'category_title', coalesce(category_assignment.title, category.title),
                'sort_order', item.sort_order,
                'note', item.note,
                'parameter_values', item.parameter_values,
                'parameters', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'parameter_key', parameter.parameter_key,
                    'label', parameter.label,
                    'unit', parameter.unit,
                    'input_type', parameter.input_type,
                    'default_value', parameter.default_value,
                    'min_value', parameter.min_value,
                    'max_value', parameter.max_value,
                    'step_value', parameter.step_value,
                    'is_required', parameter.is_required,
                    'sort_order', parameter.sort_order
                  ) order by parameter.sort_order, parameter.label)
                  from public.exercise_parameter_definitions parameter
                  where parameter.exercise_id = exercise.id
                ), '[]'::jsonb)
              ) order by item.sort_order)
              from public.training_block_items item
              join public.exercises exercise on exercise.id = item.exercise_id
              join public.exercise_categories category on category.key = exercise.category_key
              left join public.organization_exercise_categories category_assignment
                on category_assignment.organization_id = p_organization_id
               and category_assignment.category_key = exercise.category_key
              where item.block_id = block.id
            ), '[]'::jsonb),
            'usage_count', (
              select count(*) from public.training_block_usages usage
              where usage.block_id = block.id
            ),
            'created_at', block.created_at,
            'updated_at', block.updated_at
          ) as payload
        from public.training_blocks block
        where block.organization_id = p_organization_id
          and (p_include_inactive or block.is_active)
      ) block_with_usage
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.delete_unused_training_block(
  p_organization_id uuid,
  p_block_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
begin
  if v_current_user_id is null or not public.has_module_access(p_organization_id, 'training_blocks', true) then
    raise exception 'Du darfst Trainingsblöcke nicht löschen.';
  end if;
  if exists (select 1 from public.training_block_usages usage where usage.block_id = p_block_id) then
    raise exception 'Verwendete Trainingsblöcke können nicht gelöscht werden.';
  end if;
  delete from public.training_blocks
  where id = p_block_id and organization_id = p_organization_id;
  if not found then raise exception 'Der Trainingsblock wurde nicht gefunden.'; end if;
end;
$$;

revoke all on function public.dropdown_settings_overview(uuid) from public;
revoke all on function public.save_dropdown_setting(uuid, text, uuid, text, text, text, text, numeric, integer) from public;
revoke all on function public.set_dropdown_setting_active(uuid, text, uuid, text, boolean) from public;
revoke all on function public.exercise_catalog_overview_v2(uuid, boolean) from public;
revoke all on function public.save_exercise_catalog_item_v2(uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb) from public;
revoke all on function public.training_block_overview_v2(uuid, boolean) from public;
revoke all on function public.delete_unused_training_block(uuid, uuid) from public;

grant execute on function public.dropdown_settings_overview(uuid) to authenticated;
grant execute on function public.save_dropdown_setting(uuid, text, uuid, text, text, text, text, numeric, integer) to authenticated;
grant execute on function public.set_dropdown_setting_active(uuid, text, uuid, text, boolean) to authenticated;
grant execute on function public.exercise_catalog_overview_v2(uuid, boolean) to authenticated;
grant execute on function public.save_exercise_catalog_item_v2(uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb) to authenticated;
grant execute on function public.training_block_overview_v2(uuid, boolean) to authenticated;
grant execute on function public.delete_unused_training_block(uuid, uuid) to authenticated;

commit;
