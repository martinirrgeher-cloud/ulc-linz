-- E5a/E5b: Übungskatalog und Trainingsblöcke intelligent erweitern.
-- Schwierigkeitsgrad, ähnliche Übungen, Dublettenhinweise, Verwendung,
-- Blockvarianten, Versionen, Favoriten, letzte Nutzung und Vergleichsdaten.

begin;

create extension if not exists pg_trgm with schema extensions;

alter table public.organization_dropdown_options
  drop constraint if exists organization_dropdown_options_list_key_check;
alter table public.organization_dropdown_options
  add constraint organization_dropdown_options_list_key_check
  check (list_key in ('subcategory', 'material', 'planning_parameter', 'difficulty'));

with difficulty_defaults(option_key, label, sort_order) as (
  values
    ('beginner', 'Einsteiger', 10),
    ('easy', 'Leicht', 20),
    ('medium', 'Mittel', 30),
    ('advanced', 'Anspruchsvoll', 40),
    ('expert', 'Sehr anspruchsvoll', 50)
)
insert into public.organization_dropdown_options (
  organization_id,
  list_key,
  option_key,
  label,
  unit,
  input_type,
  step_value,
  sort_order,
  is_active
)
select
  organization.id,
  'difficulty',
  difficulty.option_key,
  difficulty.label,
  '',
  'text',
  null,
  difficulty.sort_order,
  true
from public.organizations organization
cross join difficulty_defaults difficulty
on conflict (organization_id, list_key, option_key) do nothing;

create or replace function public.seed_exercise_difficulties_for_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_dropdown_options (
    organization_id,
    list_key,
    option_key,
    label,
    unit,
    input_type,
    step_value,
    sort_order,
    is_active
  ) values
    (new.id, 'difficulty', 'beginner', 'Einsteiger', '', 'text', null, 10, true),
    (new.id, 'difficulty', 'easy', 'Leicht', '', 'text', null, 20, true),
    (new.id, 'difficulty', 'medium', 'Mittel', '', 'text', null, 30, true),
    (new.id, 'difficulty', 'advanced', 'Anspruchsvoll', '', 'text', null, 40, true),
    (new.id, 'difficulty', 'expert', 'Sehr anspruchsvoll', '', 'text', null, 50, true)
  on conflict (organization_id, list_key, option_key) do nothing;

  return new;
end;
$$;

drop trigger if exists organizations_seed_exercise_difficulties on public.organizations;
create trigger organizations_seed_exercise_difficulties
after insert on public.organizations
for each row execute function public.seed_exercise_difficulties_for_organization();

create or replace function public.normalize_catalog_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(
      replace(lower(trim(coalesce(p_value, ''))), 'ß', 'ss'),
      'äöüáàâéèêíìîóòôúùûç',
      'aouaaaeeeiiiooouuuc'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

alter table public.exercises
  add column if not exists difficulty_key text,
  add column if not exists normalized_name text not null default '';

update public.exercises
set normalized_name = public.normalize_catalog_name(name)
where normalized_name = ''
   or normalized_name is distinct from public.normalize_catalog_name(name);

create or replace function public.set_exercise_normalized_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.normalized_name := public.normalize_catalog_name(new.name);
  return new;
end;
$$;

drop trigger if exists exercises_set_normalized_name on public.exercises;
create trigger exercises_set_normalized_name
before insert or update of name on public.exercises
for each row execute function public.set_exercise_normalized_name();

create index if not exists exercises_org_normalized_name_idx
  on public.exercises (organization_id, normalized_name);
create index if not exists exercises_name_trgm_idx
  on public.exercises using gin (normalized_name extensions.gin_trgm_ops);

create table if not exists public.exercise_similarities (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  related_exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (exercise_id, related_exercise_id),
  check (exercise_id < related_exercise_id)
);

create index if not exists exercise_similarities_related_idx
  on public.exercise_similarities (organization_id, related_exercise_id);

alter table public.exercise_similarities enable row level security;

drop policy if exists exercise_similarities_read on public.exercise_similarities;
create policy exercise_similarities_read
on public.exercise_similarities
for select
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', false));

drop policy if exists exercise_similarities_write on public.exercise_similarities;
create policy exercise_similarities_write
on public.exercise_similarities
for all
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', true))
with check (public.has_module_access(organization_id, 'exercise_catalog', true));

revoke all on table public.exercise_similarities from anon, authenticated;

alter table public.training_blocks
  add column if not exists variant_parent_id uuid,
  add column if not exists variant_root_id uuid,
  add column if not exists variant_number integer not null default 1;

alter table public.training_blocks
  drop constraint if exists training_blocks_variant_parent_fk;
alter table public.training_blocks
  add constraint training_blocks_variant_parent_fk
  foreign key (variant_parent_id) references public.training_blocks(id) on delete set null;

alter table public.training_blocks
  drop constraint if exists training_blocks_variant_root_fk;
alter table public.training_blocks
  add constraint training_blocks_variant_root_fk
  foreign key (variant_root_id) references public.training_blocks(id) on delete set null;

alter table public.training_blocks
  drop constraint if exists training_blocks_variant_number_check;
alter table public.training_blocks
  add constraint training_blocks_variant_number_check check (variant_number >= 1);

create index if not exists training_blocks_variant_root_idx
  on public.training_blocks (organization_id, variant_root_id, variant_number);

create table if not exists public.training_block_user_favorites (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (block_id, user_id)
);

create index if not exists training_block_user_favorites_user_idx
  on public.training_block_user_favorites (organization_id, user_id);

create table if not exists public.training_block_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  reason text not null default 'saved' check (reason in ('created', 'saved', 'variant_created')),
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (block_id, version_number)
);

create index if not exists training_block_versions_block_idx
  on public.training_block_versions (organization_id, block_id, version_number desc);

alter table public.training_block_user_favorites enable row level security;
alter table public.training_block_versions enable row level security;

drop policy if exists training_block_favorites_own on public.training_block_user_favorites;
create policy training_block_favorites_own
on public.training_block_user_favorites
for all
to authenticated
using (
  user_id = (select auth.uid())
  and public.has_module_access(organization_id, 'training_blocks', false)
)
with check (
  user_id = (select auth.uid())
  and public.has_module_access(organization_id, 'training_blocks', false)
);

drop policy if exists training_block_versions_read on public.training_block_versions;
create policy training_block_versions_read
on public.training_block_versions
for select
to authenticated
using (public.has_module_access(organization_id, 'training_blocks', false));

drop policy if exists training_block_versions_write on public.training_block_versions;
create policy training_block_versions_write
on public.training_block_versions
for insert
to authenticated
with check (public.has_module_access(organization_id, 'training_blocks', true));

revoke all on table public.training_block_user_favorites from anon, authenticated;
revoke all on table public.training_block_versions from anon, authenticated;

alter table public.training_block_user_favorites replica identity full;
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'training_block_user_favorites'
  ) then
    alter publication supabase_realtime add table public.training_block_user_favorites;
  end if;
end;
$$;

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

create or replace function public.exercise_catalog_overview_v3(
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
          'block_usages', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', usage.block_id,
              'name', usage.block_name,
              'is_active', usage.block_is_active
            ) order by lower(usage.block_name))
            from (
              select distinct
                block.id as block_id,
                block.name as block_name,
                block.is_active as block_is_active
              from public.training_block_items item
              join public.training_blocks block on block.id = item.block_id
              where item.organization_id = p_organization_id
                and item.exercise_id = exercise.id
            ) usage
          ), '[]'::jsonb),
          'plan_usages', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', usage.plan_id,
              'title', usage.plan_title,
              'training_date', usage.training_date,
              'via_block_name', usage.via_block_name
            ) order by usage.training_date desc, lower(usage.plan_title))
            from (
              select distinct on (candidate.plan_id)
                candidate.plan_id,
                candidate.plan_title,
                candidate.training_date,
                candidate.via_block_name
              from (
                select
                  plan.id as plan_id,
                  coalesce(nullif(plan.title, ''), 'Trainingsplan') as plan_title,
                  plan.training_date,
                  block.name as via_block_name
                from public.athlete_training_plan_items item
                join public.athlete_training_plans plan on plan.id = item.plan_id
                join public.athlete_training_plan_sections section on section.id = item.section_id
                left join public.training_blocks block on block.id = section.source_block_id
                where item.organization_id = p_organization_id
                  and item.source_exercise_id = exercise.id
              ) candidate
              order by candidate.plan_id, candidate.via_block_name nulls first
            ) usage
          ), '[]'::jsonb),
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

create or replace function public.exercise_duplicate_candidates(
  p_organization_id uuid,
  p_exercise_id uuid,
  p_name text,
  p_limit integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_normalized text := public.normalize_catalog_name(p_name);
begin
  if (select auth.uid()) is null or not public.has_module_access(
    p_organization_id,
    'exercise_catalog',
    false
  ) then
    raise exception 'Für den Übungskatalog fehlen die erforderlichen Rechte.';
  end if;

  if char_length(v_normalized) < 2 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', candidate.id,
      'name', candidate.name,
      'score', candidate.score,
      'exact_normalized', candidate.normalized_name = v_normalized
    ) order by candidate.score desc, lower(candidate.name))
    from (
      select
        exercise.id,
        exercise.name,
        exercise.normalized_name,
        greatest(
          extensions.similarity(exercise.normalized_name, v_normalized),
          case when exercise.normalized_name = v_normalized then 1.0 else 0.0 end
        ) as score
      from public.exercises exercise
      where exercise.organization_id = p_organization_id
        and (p_exercise_id is null or exercise.id <> p_exercise_id)
        and (
          exercise.normalized_name = v_normalized
          or extensions.similarity(exercise.normalized_name, v_normalized) >= 0.42
        )
      order by score desc, lower(exercise.name)
      limit greatest(1, least(coalesce(p_limit, 5), 10))
    ) candidate
  ), '[]'::jsonb);
end;
$$;

create or replace function public.save_exercise_catalog_item_v4(
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
  p_difficulty_key text default null,
  p_similar_exercise_ids uuid[] default '{}',
  p_lock_token uuid default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_result jsonb;
  v_exercise_id uuid;
  v_updated_at timestamptz;
  v_normalized text := public.normalize_catalog_name(p_name);
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'exercise_catalog',
    true
  ) then
    raise exception 'Du darfst den Übungskatalog nicht bearbeiten.';
  end if;

  if char_length(v_normalized) < 2 then
    raise exception 'Der Übungsname ist zu kurz.';
  end if;

  -- Verhindert, dass zwei gleichzeitige Speicherungen denselben normalisierten
  -- Namen trotz der vorgelagerten Dublettenprüfung anlegen.
  perform pg_advisory_xact_lock(hashtextextended(
    'exercise_name:' || p_organization_id::text || ':' || v_normalized,
    0
  ));

  if exists (
    select 1
    from public.exercises existing
    where existing.organization_id = p_organization_id
      and existing.normalized_name = v_normalized
      and (p_exercise_id is null or existing.id <> p_exercise_id)
  ) then
    raise exception 'Eine Übung mit praktisch gleichem Namen existiert bereits. Bitte die bestehende Übung oder eine bewusste Variante verwenden.';
  end if;

  if nullif(trim(coalesce(p_difficulty_key, '')), '') is not null and not exists (
    select 1
    from public.organization_dropdown_options option
    where option.organization_id = p_organization_id
      and option.list_key = 'difficulty'
      and option.option_key = p_difficulty_key
      and (
        option.is_active
        or exists (
          select 1 from public.exercises existing
          where existing.id = p_exercise_id
            and existing.organization_id = p_organization_id
            and existing.difficulty_key = p_difficulty_key
        )
      )
  ) then
    raise exception 'Der ausgewählte Schwierigkeitsgrad ist ungültig oder inaktiv.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_similar_exercise_ids, '{}')) requested(id)
    where requested.id = p_exercise_id
       or not exists (
         select 1 from public.exercises related
         where related.id = requested.id
           and related.organization_id = p_organization_id
       )
  ) then
    raise exception 'Mindestens eine verknüpfte ähnliche Übung ist ungültig.';
  end if;

  v_result := public.save_exercise_catalog_item_v3(
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
    p_parameters,
    p_lock_token,
    p_expected_updated_at
  );

  v_exercise_id := (v_result ->> 'id')::uuid;

  update public.exercises
  set
    difficulty_key = nullif(trim(coalesce(p_difficulty_key, '')), ''),
    updated_at = now()
  where id = v_exercise_id
    and organization_id = p_organization_id;

  delete from public.exercise_similarities similarity
  where similarity.organization_id = p_organization_id
    and (similarity.exercise_id = v_exercise_id or similarity.related_exercise_id = v_exercise_id);

  insert into public.exercise_similarities (
    organization_id,
    exercise_id,
    related_exercise_id,
    created_by
  )
  select distinct
    p_organization_id,
    least(v_exercise_id, requested.id),
    greatest(v_exercise_id, requested.id),
    v_current_user_id
  from unnest(coalesce(p_similar_exercise_ids, '{}')) requested(id)
  where requested.id <> v_exercise_id
  on conflict (exercise_id, related_exercise_id) do nothing;

  select exercise.updated_at
  into v_updated_at
  from public.exercises exercise
  where exercise.id = v_exercise_id;

  return jsonb_build_object('id', v_exercise_id, 'updated_at', v_updated_at);
end;
$$;

create or replace function public.capture_training_block_version(
  p_organization_id uuid,
  p_block_id uuid,
  p_reason text default 'saved'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_version integer;
  v_snapshot jsonb;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'training_blocks',
    true
  ) then
    raise exception 'Du darfst keine Trainingsblock-Version anlegen.';
  end if;

  if p_reason not in ('created', 'saved', 'variant_created') then
    raise exception 'Unbekannter Versionsgrund.';
  end if;

  select jsonb_build_object(
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
        'exercise_id', item.exercise_id,
        'exercise_name', exercise.name,
        'exercise_is_active', exercise.is_active,
        'sort_order', item.sort_order,
        'note', item.note,
        'parameter_values', item.parameter_values
      ) order by item.sort_order)
      from public.training_block_items item
      join public.exercises exercise on exercise.id = item.exercise_id
      where item.block_id = block.id
    ), '[]'::jsonb)
  )
  into v_snapshot
  from public.training_blocks block
  where block.organization_id = p_organization_id
    and block.id = p_block_id;

  if v_snapshot is null then
    raise exception 'Der Trainingsblock wurde nicht gefunden.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('training_block_version:' || p_block_id::text, 0));

  select coalesce(max(version.version_number), 0) + 1
  into v_version
  from public.training_block_versions version
  where version.block_id = p_block_id;

  insert into public.training_block_versions (
    organization_id,
    block_id,
    version_number,
    reason,
    snapshot,
    created_by
  ) values (
    p_organization_id,
    p_block_id,
    v_version,
    p_reason,
    v_snapshot,
    v_current_user_id
  );

  return v_version;
end;
$$;

insert into public.training_block_versions (
  organization_id,
  block_id,
  version_number,
  reason,
  snapshot,
  created_by,
  created_at
)
select
  block.organization_id,
  block.id,
  1,
  'created',
  jsonb_build_object(
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
        'exercise_id', item.exercise_id,
        'exercise_name', exercise.name,
        'exercise_is_active', exercise.is_active,
        'sort_order', item.sort_order,
        'note', item.note,
        'parameter_values', item.parameter_values
      ) order by item.sort_order)
      from public.training_block_items item
      join public.exercises exercise on exercise.id = item.exercise_id
      where item.block_id = block.id
    ), '[]'::jsonb)
  ),
  block.created_by,
  block.created_at
from public.training_blocks block
where not exists (
  select 1 from public.training_block_versions version where version.block_id = block.id
);

create or replace function public.training_block_overview_v3(
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
  v_current_user_id uuid := (select auth.uid());
begin
  v_base := public.training_block_overview_v2(p_organization_id, p_include_inactive);

  return v_base || jsonb_build_object(
    'blocks', coalesce((
      select jsonb_agg(
        block_json || jsonb_build_object(
          'is_favorite', exists (
            select 1 from public.training_block_user_favorites favorite
            where favorite.block_id = block.id and favorite.user_id = v_current_user_id
          ),
          'variant_parent_id', block.variant_parent_id,
          'variant_root_id', block.variant_root_id,
          'variant_number', block.variant_number,
          'variant_parent_name', parent.name,
          'inactive_exercise_count', (
            select count(*) from public.training_block_items item
            join public.exercises exercise on exercise.id = item.exercise_id
            where item.block_id = block.id and not exercise.is_active
          ),
          'last_used_at', (
            select max(plan.training_date)
            from public.athlete_training_plan_sections section
            join public.athlete_training_plans plan on plan.id = section.plan_id
            where section.organization_id = p_organization_id
              and section.source_block_id = block.id
              and section.counts_as_block_usage
          ),
          'used_group_ids', coalesce((
            select jsonb_agg(group_id order by group_id)
            from (
              select distinct plan.group_id
              from public.athlete_training_plan_sections section
              join public.athlete_training_plans plan on plan.id = section.plan_id
              where section.organization_id = p_organization_id
                and section.source_block_id = block.id
                and section.counts_as_block_usage
                and plan.group_id is not null
            ) used_groups
          ), '[]'::jsonb),
          'versions', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', version.id,
              'version_number', version.version_number,
              'reason', version.reason,
              'snapshot', version.snapshot,
              'created_at', version.created_at
            ) order by version.version_number desc)
            from public.training_block_versions version
            where version.block_id = block.id
          ), '[]'::jsonb)
        )
        order by lower(block_json ->> 'name')
      )
      from jsonb_array_elements(coalesce(v_base -> 'blocks', '[]'::jsonb)) block_json
      join public.training_blocks block on block.id = (block_json ->> 'id')::uuid
      left join public.training_blocks parent on parent.id = block.variant_parent_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_training_block_v3(
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
  v_result jsonb;
  v_block_id uuid;
  v_version integer;
begin
  v_result := public.save_training_block_v2(
    p_organization_id,
    p_block_id,
    p_name,
    p_goal,
    p_description,
    p_estimated_minutes,
    p_is_active,
    p_group_ids,
    p_items,
    p_lock_token,
    p_expected_updated_at
  );

  v_block_id := (v_result ->> 'id')::uuid;
  v_version := public.capture_training_block_version(
    p_organization_id,
    v_block_id,
    case when p_block_id is null then 'created' else 'saved' end
  );

  return v_result || jsonb_build_object('version_number', v_version);
end;
$$;

create or replace function public.create_training_block_variant(
  p_organization_id uuid,
  p_block_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_source public.training_blocks%rowtype;
  v_root_id uuid;
  v_new_block_id uuid;
  v_variant_number integer;
  v_candidate_name text;
  v_suffix integer := 2;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'training_blocks',
    true
  ) then
    raise exception 'Du darfst keine Trainingsblock-Variante erstellen.';
  end if;

  select * into v_source
  from public.training_blocks block
  where block.organization_id = p_organization_id and block.id = p_block_id;

  if not found then
    raise exception 'Der Trainingsblock wurde nicht gefunden.';
  end if;

  v_root_id := coalesce(v_source.variant_root_id, v_source.id);
  perform pg_advisory_xact_lock(hashtextextended('training_block_variant:' || v_root_id::text, 0));

  select coalesce(max(block.variant_number), 1) + 1
  into v_variant_number
  from public.training_blocks block
  where block.organization_id = p_organization_id
    and (block.id = v_root_id or block.variant_root_id = v_root_id);

  v_candidate_name := left(v_source.name || ' – Variante ' || v_variant_number, 120);
  while exists (
    select 1 from public.training_blocks existing
    where existing.organization_id = p_organization_id
      and lower(existing.name) = lower(v_candidate_name)
  ) loop
    v_candidate_name := left(v_source.name, 100) || ' – Variante ' || v_variant_number || ' (' || v_suffix || ')';
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.training_blocks (
    organization_id,
    name,
    goal,
    description,
    estimated_minutes,
    is_active,
    created_by,
    variant_parent_id,
    variant_root_id,
    variant_number
  ) values (
    p_organization_id,
    v_candidate_name,
    v_source.goal,
    v_source.description,
    v_source.estimated_minutes,
    true,
    v_current_user_id,
    p_block_id,
    v_root_id,
    v_variant_number
  )
  returning id into v_new_block_id;

  insert into public.training_block_group_assignments (organization_id, block_id, group_id)
  select p_organization_id, v_new_block_id, assignment.group_id
  from public.training_block_group_assignments assignment
  where assignment.block_id = p_block_id;

  insert into public.training_block_items (
    organization_id, block_id, exercise_id, sort_order, note, parameter_values
  )
  select
    p_organization_id,
    v_new_block_id,
    item.exercise_id,
    item.sort_order,
    item.note,
    item.parameter_values
  from public.training_block_items item
  where item.block_id = p_block_id
  order by item.sort_order;

  perform public.capture_training_block_version(
    p_organization_id,
    v_new_block_id,
    'variant_created'
  );

  insert into public.audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_organization_id,
    v_current_user_id,
    'training_block_variant_created',
    'training_block',
    v_new_block_id::text,
    jsonb_build_object(
      'source_block_id', p_block_id,
      'variant_root_id', v_root_id,
      'variant_number', v_variant_number,
      'name', v_candidate_name
    )
  );

  return v_new_block_id;
end;
$$;

create or replace function public.set_training_block_favorite(
  p_organization_id uuid,
  p_block_id uuid,
  p_is_favorite boolean
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
    'training_blocks',
    false
  ) then
    raise exception 'Für Trainingsblöcke fehlen die erforderlichen Rechte.';
  end if;

  if not exists (
    select 1 from public.training_blocks block
    where block.organization_id = p_organization_id and block.id = p_block_id
  ) then
    raise exception 'Der Trainingsblock wurde nicht gefunden.';
  end if;

  if coalesce(p_is_favorite, false) then
    insert into public.training_block_user_favorites (
      organization_id, block_id, user_id
    ) values (
      p_organization_id, p_block_id, v_current_user_id
    ) on conflict (block_id, user_id) do nothing;
  else
    delete from public.training_block_user_favorites favorite
    where favorite.block_id = p_block_id and favorite.user_id = v_current_user_id;
  end if;
end;
$$;

revoke all on function public.seed_exercise_difficulties_for_organization() from public;
revoke all on function public.normalize_catalog_name(text) from public;
revoke all on function public.exercise_catalog_overview_v3(uuid, boolean) from public;
revoke all on function public.exercise_duplicate_candidates(uuid, uuid, text, integer) from public;
revoke all on function public.save_exercise_catalog_item_v4(
  uuid, uuid, text, text, text, text, text, text, text, text[], text,
  boolean, uuid[], jsonb, text, uuid[], uuid, timestamptz
) from public;
revoke all on function public.capture_training_block_version(uuid, uuid, text) from public;
revoke all on function public.training_block_overview_v3(uuid, boolean) from public;
revoke all on function public.save_training_block_v3(
  uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb, uuid, timestamptz
) from public;
revoke all on function public.create_training_block_variant(uuid, uuid) from public;
revoke all on function public.set_training_block_favorite(uuid, uuid, boolean) from public;

grant execute on function public.exercise_catalog_overview_v3(uuid, boolean) to authenticated;
grant execute on function public.exercise_duplicate_candidates(uuid, uuid, text, integer) to authenticated;
grant execute on function public.save_exercise_catalog_item_v4(
  uuid, uuid, text, text, text, text, text, text, text, text[], text,
  boolean, uuid[], jsonb, text, uuid[], uuid, timestamptz
) to authenticated;
grant execute on function public.training_block_overview_v3(uuid, boolean) to authenticated;
grant execute on function public.save_training_block_v3(
  uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb, uuid, timestamptz
) to authenticated;
grant execute on function public.create_training_block_variant(uuid, uuid) to authenticated;
grant execute on function public.set_training_block_favorite(uuid, uuid, boolean) to authenticated;

commit;
