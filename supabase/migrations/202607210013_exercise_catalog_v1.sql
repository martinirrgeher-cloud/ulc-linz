-- ULC Linz App – Übungskatalog V1
-- Strukturierte Übungen, flexible Planungsparameter, Gruppeneignung und persönliche Favoriten.

begin;

-- Die bisher getrennten Module Übungskatalog und Übungspflege werden zusammengeführt.
insert into public.member_module_permissions (
  membership_id,
  module_key,
  can_view,
  can_edit
)
select
  permission.membership_id,
  'exercise_catalog',
  bool_or(permission.can_view or permission.can_edit),
  bool_or(permission.can_edit)
from public.member_module_permissions permission
where permission.module_key in ('exercise_catalog', 'exercise_management')
group by permission.membership_id
on conflict (membership_id, module_key) do update
set
  can_view = excluded.can_view,
  can_edit = excluded.can_edit,
  updated_at = now();

update public.app_modules
set
  title = 'Übungskatalog',
  description = 'Übungen strukturiert erfassen und verwenden',
  route = '/module/exercise_catalog',
  icon = 'book-open',
  sort_order = 40,
  is_active = true
where key = 'exercise_catalog';

update public.app_modules
set is_active = false
where key = 'exercise_management';

create table if not exists public.exercise_categories (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  title text not null check (char_length(trim(title)) between 2 and 80),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.exercise_categories (key, title, sort_order) values
  ('warmup', 'Aufwärmen & Lauf-ABC', 10),
  ('acceleration', 'Beschleunigung', 20),
  ('max_velocity', 'Maximalgeschwindigkeit', 30),
  ('speed_endurance', 'Schnelligkeitsausdauer', 40),
  ('start_reaction', 'Start & Reaktion', 50),
  ('technique', 'Technik', 60),
  ('plyometrics', 'Plyometrie', 70),
  ('strength', 'Kraft', 80),
  ('stability', 'Stabilisation', 90),
  ('regeneration', 'Regeneration', 100),
  ('other', 'Sonstiges', 999)
on conflict (key) do update
set
  title = excluded.title,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  category_key text not null references public.exercise_categories(key),
  subcategory text check (subcategory is null or char_length(trim(subcategory)) <= 100),
  goal text check (goal is null or char_length(trim(goal)) <= 240),
  description text,
  coaching_cues text,
  common_mistakes text,
  equipment text[] not null default '{}',
  video_url text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercises_org_name_unique_idx
  on public.exercises (organization_id, lower(name));
create index if not exists exercises_org_category_idx
  on public.exercises (organization_id, category_key, is_active);
create index if not exists exercises_org_active_name_idx
  on public.exercises (organization_id, is_active, lower(name));

create table if not exists public.exercise_parameter_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  parameter_key text not null check (parameter_key in (
    'sets',
    'repetitions',
    'distance_m',
    'weight_kg',
    'duration_s',
    'target_time_s',
    'intensity_percent',
    'rest_s',
    'series_rest_s',
    'approach_distance_m',
    'flying_distance_m',
    'contacts',
    'resistance_kg',
    'height_cm',
    'tempo_text',
    'surface_text',
    'start_position_text',
    'note_text'
  )),
  label text not null check (char_length(trim(label)) between 1 and 80),
  unit text not null default '' check (char_length(unit) <= 20),
  input_type text not null check (input_type in ('number', 'text')),
  default_value text,
  min_value numeric,
  max_value numeric,
  step_value numeric,
  is_required boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, parameter_key),
  check (min_value is null or max_value is null or min_value <= max_value),
  check (step_value is null or step_value > 0)
);

create index if not exists exercise_parameter_definitions_exercise_idx
  on public.exercise_parameter_definitions (exercise_id, sort_order);

create table if not exists public.exercise_group_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, group_id)
);

create index if not exists exercise_group_assignments_group_idx
  on public.exercise_group_assignments (organization_id, group_id);

create table if not exists public.exercise_user_favorites (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, user_id)
);

create index if not exists exercise_user_favorites_user_idx
  on public.exercise_user_favorites (organization_id, user_id);

-- Zeitstempel wie im restlichen Projekt automatisch aktualisieren.
drop trigger if exists exercise_categories_set_updated_at on public.exercise_categories;
create trigger exercise_categories_set_updated_at
before update on public.exercise_categories
for each row execute function public.set_updated_at();

drop trigger if exists exercises_set_updated_at on public.exercises;
create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

drop trigger if exists exercise_parameter_definitions_set_updated_at on public.exercise_parameter_definitions;
create trigger exercise_parameter_definitions_set_updated_at
before update on public.exercise_parameter_definitions
for each row execute function public.set_updated_at();

alter table public.exercise_categories enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_parameter_definitions enable row level security;
alter table public.exercise_group_assignments enable row level security;
alter table public.exercise_user_favorites enable row level security;

drop policy if exists exercise_categories_read on public.exercise_categories;
create policy exercise_categories_read
on public.exercise_categories
for select
to authenticated
using (is_active);

drop policy if exists exercises_read on public.exercises;
create policy exercises_read
on public.exercises
for select
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', false));

drop policy if exists exercises_write on public.exercises;
create policy exercises_write
on public.exercises
for all
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', true))
with check (public.has_module_access(organization_id, 'exercise_catalog', true));

drop policy if exists exercise_parameters_read on public.exercise_parameter_definitions;
create policy exercise_parameters_read
on public.exercise_parameter_definitions
for select
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', false));

drop policy if exists exercise_parameters_write on public.exercise_parameter_definitions;
create policy exercise_parameters_write
on public.exercise_parameter_definitions
for all
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', true))
with check (public.has_module_access(organization_id, 'exercise_catalog', true));

drop policy if exists exercise_groups_read on public.exercise_group_assignments;
create policy exercise_groups_read
on public.exercise_group_assignments
for select
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', false));

drop policy if exists exercise_groups_write on public.exercise_group_assignments;
create policy exercise_groups_write
on public.exercise_group_assignments
for all
to authenticated
using (public.has_module_access(organization_id, 'exercise_catalog', true))
with check (public.has_module_access(organization_id, 'exercise_catalog', true));

drop policy if exists exercise_favorites_own on public.exercise_user_favorites;
create policy exercise_favorites_own
on public.exercise_user_favorites
for all
to authenticated
using (
  user_id = (select auth.uid())
  and public.has_module_access(organization_id, 'exercise_catalog', false)
)
with check (
  user_id = (select auth.uid())
  and public.has_module_access(organization_id, 'exercise_catalog', false)
);

-- Der Browser arbeitet ausschließlich über die folgenden RPC-Funktionen.
-- Dadurch können Tabellen nicht an den geprüften Organisations- und Modulrechten vorbei verändert werden.
revoke all on table public.exercise_categories from anon, authenticated;
revoke all on table public.exercises from anon, authenticated;
revoke all on table public.exercise_parameter_definitions from anon, authenticated;
revoke all on table public.exercise_group_assignments from anon, authenticated;
revoke all on table public.exercise_user_favorites from anon, authenticated;

create or replace function public.exercise_catalog_overview(
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
  v_current_user_id uuid := (select auth.uid());
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'exercise_catalog',
    false
  ) then
    raise exception 'Für den Übungskatalog fehlen die erforderlichen Rechte.';
  end if;

  return jsonb_build_object(
    'categories', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', category.key,
            'title', category.title,
            'sort_order', category.sort_order
          )
          order by category.sort_order, category.title
        )
        from public.exercise_categories category
        where category.is_active
      ),
      '[]'::jsonb
    ),
    'groups', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', training_group.id,
            'name', training_group.name,
            'short_name', training_group.short_name
          )
          order by training_group.sort_order, lower(training_group.name)
        )
        from public.training_groups training_group
        where training_group.organization_id = p_organization_id
          and training_group.is_active
      ),
      '[]'::jsonb
    ),
    'exercises', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', exercise.id,
            'name', exercise.name,
            'category_key', exercise.category_key,
            'category_title', category.title,
            'subcategory', exercise.subcategory,
            'goal', exercise.goal,
            'description', exercise.description,
            'coaching_cues', exercise.coaching_cues,
            'common_mistakes', exercise.common_mistakes,
            'equipment', to_jsonb(exercise.equipment),
            'video_url', exercise.video_url,
            'is_active', exercise.is_active,
            'is_favorite', exists (
              select 1
              from public.exercise_user_favorites favorite
              where favorite.exercise_id = exercise.id
                and favorite.user_id = v_current_user_id
            ),
            'group_ids', coalesce(
              (
                select jsonb_agg(assignment.group_id order by assignment.group_id)
                from public.exercise_group_assignments assignment
                where assignment.exercise_id = exercise.id
              ),
              '[]'::jsonb
            ),
            'parameters', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
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
                  )
                  order by parameter.sort_order, parameter.label
                )
                from public.exercise_parameter_definitions parameter
                where parameter.exercise_id = exercise.id
              ),
              '[]'::jsonb
            ),
            'created_at', exercise.created_at,
            'updated_at', exercise.updated_at
          )
          order by lower(exercise.name)
        )
        from public.exercises exercise
        join public.exercise_categories category
          on category.key = exercise.category_key
        where exercise.organization_id = p_organization_id
          and (p_include_inactive or exercise.is_active)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.save_exercise_catalog_item(
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
  v_exercise_id uuid := p_exercise_id;
  v_name text := trim(coalesce(p_name, ''));
  v_category_key text := trim(coalesce(p_category_key, ''));
  v_before jsonb;
  v_after jsonb;
  v_parameter jsonb;
  v_parameter_key text;
  v_input_type text;
  v_min numeric;
  v_max numeric;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'exercise_catalog',
    true
  ) then
    raise exception 'Du darfst den Übungskatalog nicht bearbeiten.';
  end if;

  if char_length(v_name) < 2 then
    raise exception 'Der Übungsname ist zu kurz.';
  end if;

  if not exists (
    select 1
    from public.exercise_categories category
    where category.key = v_category_key
      and category.is_active
  ) then
    raise exception 'Die ausgewählte Übungskategorie ist ungültig.';
  end if;

  if p_video_url is not null and trim(p_video_url) <> '' and trim(p_video_url) !~* '^https?://' then
    raise exception 'Der Video- oder Weblink muss mit http:// oder https:// beginnen.';
  end if;

  if jsonb_typeof(coalesce(p_parameters, '[]'::jsonb)) <> 'array' then
    raise exception 'Die Planungsparameter besitzen ein ungültiges Format.';
  end if;

  if exists (
    select 1
    from public.exercises existing
    where existing.organization_id = p_organization_id
      and lower(existing.name) = lower(v_name)
      and (v_exercise_id is null or existing.id <> v_exercise_id)
  ) then
    raise exception 'Eine Übung mit diesem Namen existiert bereits.';
  end if;

  if coalesce(array_length(p_group_ids, 1), 0) > 0 and exists (
    select 1
    from unnest(p_group_ids) as requested_groups(requested_group_id)
    where not exists (
      select 1
      from public.training_groups training_group
      where training_group.id = requested_groups.requested_group_id
        and training_group.organization_id = p_organization_id
        and training_group.is_active
    )
  ) then
    raise exception 'Mindestens eine ausgewählte Trainingsgruppe ist ungültig oder inaktiv.';
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
    select element
    from jsonb_array_elements(coalesce(p_parameters, '[]'::jsonb)) as items(element)
  loop
    v_parameter_key := v_parameter ->> 'parameter_key';
    v_input_type := v_parameter ->> 'input_type';

    if v_parameter_key is null or v_parameter_key not in (
      'sets', 'repetitions', 'distance_m', 'weight_kg', 'duration_s',
      'target_time_s', 'intensity_percent', 'rest_s', 'series_rest_s',
      'approach_distance_m', 'flying_distance_m', 'contacts', 'resistance_kg',
      'height_cm', 'tempo_text', 'surface_text', 'start_position_text', 'note_text'
    ) then
      raise exception 'Unbekannter Planungsparameter: %', coalesce(v_parameter_key, 'leer');
    end if;

    if v_input_type not in ('number', 'text') then
      raise exception 'Ungültiger Eingabetyp für den Parameter %.', v_parameter_key;
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

  if v_exercise_id is null then
    insert into public.exercises (
      organization_id,
      name,
      category_key,
      subcategory,
      goal,
      description,
      coaching_cues,
      common_mistakes,
      equipment,
      video_url,
      is_active,
      created_by
    ) values (
      p_organization_id,
      v_name,
      v_category_key,
      nullif(trim(coalesce(p_subcategory, '')), ''),
      nullif(trim(coalesce(p_goal, '')), ''),
      nullif(trim(coalesce(p_description, '')), ''),
      nullif(trim(coalesce(p_coaching_cues, '')), ''),
      nullif(trim(coalesce(p_common_mistakes, '')), ''),
      coalesce(p_equipment, '{}'),
      nullif(trim(coalesce(p_video_url, '')), ''),
      coalesce(p_is_active, true),
      v_current_user_id
    )
    returning id into v_exercise_id;
  else
    select to_jsonb(existing)
    into v_before
    from public.exercises existing
    where existing.id = v_exercise_id
      and existing.organization_id = p_organization_id;

    if v_before is null then
      raise exception 'Die Übung wurde nicht gefunden.';
    end if;

    update public.exercises
    set
      name = v_name,
      category_key = v_category_key,
      subcategory = nullif(trim(coalesce(p_subcategory, '')), ''),
      goal = nullif(trim(coalesce(p_goal, '')), ''),
      description = nullif(trim(coalesce(p_description, '')), ''),
      coaching_cues = nullif(trim(coalesce(p_coaching_cues, '')), ''),
      common_mistakes = nullif(trim(coalesce(p_common_mistakes, '')), ''),
      equipment = coalesce(p_equipment, '{}'),
      video_url = nullif(trim(coalesce(p_video_url, '')), ''),
      is_active = coalesce(p_is_active, true)
    where id = v_exercise_id
      and organization_id = p_organization_id;
  end if;

  delete from public.exercise_parameter_definitions
  where exercise_id = v_exercise_id;

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
    with ordinality as parameter_values(parameter, parameter_ordinality);

  delete from public.exercise_group_assignments
  where exercise_id = v_exercise_id;

  insert into public.exercise_group_assignments (
    organization_id,
    exercise_id,
    group_id
  )
  select distinct
    p_organization_id,
    v_exercise_id,
    requested_groups.requested_group_id
  from unnest(coalesce(p_group_ids, '{}')) as requested_groups(requested_group_id);

  select jsonb_build_object(
    'exercise', to_jsonb(exercise),
    'group_ids', coalesce(
      (
        select jsonb_agg(assignment.group_id order by assignment.group_id)
        from public.exercise_group_assignments assignment
        where assignment.exercise_id = v_exercise_id
      ),
      '[]'::jsonb
    ),
    'parameters', coalesce(
      (
        select jsonb_agg(to_jsonb(parameter) order by parameter.sort_order)
        from public.exercise_parameter_definitions parameter
        where parameter.exercise_id = v_exercise_id
      ),
      '[]'::jsonb
    )
  )
  into v_after
  from public.exercises exercise
  where exercise.id = v_exercise_id;

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
    v_current_user_id,
    case when p_exercise_id is null then 'exercise_created' else 'exercise_updated' end,
    'exercise',
    v_exercise_id::text,
    v_before,
    v_after
  );

  return v_exercise_id;
end;
$$;

create or replace function public.set_exercise_favorite(
  p_organization_id uuid,
  p_exercise_id uuid,
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
    'exercise_catalog',
    false
  ) then
    raise exception 'Für den Übungskatalog fehlen die erforderlichen Rechte.';
  end if;

  if not exists (
    select 1
    from public.exercises exercise
    where exercise.id = p_exercise_id
      and exercise.organization_id = p_organization_id
  ) then
    raise exception 'Die Übung wurde nicht gefunden.';
  end if;

  if coalesce(p_is_favorite, false) then
    insert into public.exercise_user_favorites (
      organization_id,
      exercise_id,
      user_id
    ) values (
      p_organization_id,
      p_exercise_id,
      v_current_user_id
    )
    on conflict (exercise_id, user_id) do nothing;
  else
    delete from public.exercise_user_favorites
    where exercise_id = p_exercise_id
      and user_id = v_current_user_id;
  end if;
end;
$$;

revoke all on function public.exercise_catalog_overview(uuid, boolean) from public;
revoke all on function public.save_exercise_catalog_item(
  uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb
) from public;
revoke all on function public.set_exercise_favorite(uuid, uuid, boolean) from public;

grant execute on function public.exercise_catalog_overview(uuid, boolean) to authenticated;
grant execute on function public.save_exercise_catalog_item(
  uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb
) to authenticated;
grant execute on function public.set_exercise_favorite(uuid, uuid, boolean) to authenticated;

commit;
