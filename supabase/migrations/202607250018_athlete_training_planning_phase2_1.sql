-- ULC Linz App v13
-- Trainingsplanung Phase 2.1: eigenständige Trainingspläne pro Athlet und Tag,
-- Block-/Übungssnapshots und Kopieren auf Trainingskollegen.

begin;

update public.app_modules
set
  title = 'Trainingsplanung',
  description = 'Athletenpläne erstellen und auf Trainingskollegen kopieren',
  route = '/module/training_planning',
  icon = 'dumbbell',
  is_active = true
where key = 'training_planning';

create table if not exists public.athlete_training_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  athlete_id uuid not null,
  group_id uuid not null,
  training_date date not null,
  title text not null check (char_length(trim(title)) between 2 and 160),
  notes text check (notes is null or char_length(notes) <= 5000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  source_plan_id uuid references public.athlete_training_plans(id) on delete set null,
  copied_from_athlete_id uuid references public.athletes(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint athlete_training_plans_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete cascade,
  constraint athlete_training_plans_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete cascade
);

create unique index if not exists athlete_training_plans_day_unique_idx
  on public.athlete_training_plans (organization_id, group_id, athlete_id, training_date);
create index if not exists athlete_training_plans_day_group_idx
  on public.athlete_training_plans (organization_id, training_date, group_id, athlete_id);
create index if not exists athlete_training_plans_source_idx
  on public.athlete_training_plans (organization_id, source_plan_id);

create table if not exists public.athlete_training_plan_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.athlete_training_plans(id) on delete cascade,
  section_type text not null check (section_type in ('block', 'exercise')),
  source_block_id uuid references public.training_blocks(id) on delete set null,
  counts_as_block_usage boolean not null default true,
  name text not null check (char_length(trim(name)) between 2 and 160),
  goal text check (goal is null or char_length(goal) <= 500),
  description text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 0 and 1440),
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athlete_training_plan_sections_plan_idx
  on public.athlete_training_plan_sections (plan_id, sort_order);
create index if not exists athlete_training_plan_sections_block_idx
  on public.athlete_training_plan_sections (organization_id, source_block_id)
  where source_block_id is not null;

create table if not exists public.athlete_training_plan_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.athlete_training_plans(id) on delete cascade,
  section_id uuid not null references public.athlete_training_plan_sections(id) on delete cascade,
  source_exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null check (char_length(trim(exercise_name)) between 2 and 160),
  category_title text not null default '',
  note text,
  parameter_definitions jsonb not null default '[]'::jsonb,
  parameter_values jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(parameter_definitions) = 'array'),
  check (jsonb_typeof(parameter_values) = 'object')
);

create index if not exists athlete_training_plan_items_section_idx
  on public.athlete_training_plan_items (section_id, sort_order);
create index if not exists athlete_training_plan_items_exercise_idx
  on public.athlete_training_plan_items (organization_id, source_exercise_id)
  where source_exercise_id is not null;

drop trigger if exists athlete_training_plans_set_updated_at on public.athlete_training_plans;
create trigger athlete_training_plans_set_updated_at
before update on public.athlete_training_plans
for each row execute function public.set_updated_at();

drop trigger if exists athlete_training_plan_sections_set_updated_at on public.athlete_training_plan_sections;
create trigger athlete_training_plan_sections_set_updated_at
before update on public.athlete_training_plan_sections
for each row execute function public.set_updated_at();

drop trigger if exists athlete_training_plan_items_set_updated_at on public.athlete_training_plan_items;
create trigger athlete_training_plan_items_set_updated_at
before update on public.athlete_training_plan_items
for each row execute function public.set_updated_at();

alter table public.athlete_training_plans enable row level security;
alter table public.athlete_training_plan_sections enable row level security;
alter table public.athlete_training_plan_items enable row level security;

drop policy if exists athlete_training_plans_read on public.athlete_training_plans;
create policy athlete_training_plans_read
on public.athlete_training_plans
for select to authenticated
using (
  public.has_module_access(organization_id, 'training_planning', false)
  or public.has_module_access(organization_id, 'training_overview', false)
  or public.has_module_access(organization_id, 'training_documentation', false)
);

drop policy if exists athlete_training_plans_write on public.athlete_training_plans;
create policy athlete_training_plans_write
on public.athlete_training_plans
for all to authenticated
using (public.has_module_access(organization_id, 'training_planning', true))
with check (public.has_module_access(organization_id, 'training_planning', true));

drop policy if exists athlete_training_plan_sections_read on public.athlete_training_plan_sections;
create policy athlete_training_plan_sections_read
on public.athlete_training_plan_sections
for select to authenticated
using (
  public.has_module_access(organization_id, 'training_planning', false)
  or public.has_module_access(organization_id, 'training_overview', false)
  or public.has_module_access(organization_id, 'training_documentation', false)
);

drop policy if exists athlete_training_plan_sections_write on public.athlete_training_plan_sections;
create policy athlete_training_plan_sections_write
on public.athlete_training_plan_sections
for all to authenticated
using (public.has_module_access(organization_id, 'training_planning', true))
with check (public.has_module_access(organization_id, 'training_planning', true));

drop policy if exists athlete_training_plan_items_read on public.athlete_training_plan_items;
create policy athlete_training_plan_items_read
on public.athlete_training_plan_items
for select to authenticated
using (
  public.has_module_access(organization_id, 'training_planning', false)
  or public.has_module_access(organization_id, 'training_overview', false)
  or public.has_module_access(organization_id, 'training_documentation', false)
);

drop policy if exists athlete_training_plan_items_write on public.athlete_training_plan_items;
create policy athlete_training_plan_items_write
on public.athlete_training_plan_items
for all to authenticated
using (public.has_module_access(organization_id, 'training_planning', true))
with check (public.has_module_access(organization_id, 'training_planning', true));

revoke all on table public.athlete_training_plans from anon, authenticated;
revoke all on table public.athlete_training_plan_sections from anon, authenticated;
revoke all on table public.athlete_training_plan_items from anon, authenticated;

create or replace function public.training_planning_overview(
  p_organization_id uuid,
  p_training_date date,
  p_group_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.has_module_access(
    p_organization_id,
    'training_planning',
    false
  ) then
    raise exception 'Für die Trainingsplanung fehlen die erforderlichen Rechte.';
  end if;

  return jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', training_group.id,
        'name', training_group.name,
        'short_name', training_group.short_name,
        'is_performance_group', exists (
          select 1
          from public.performance_group_settings setting
          where setting.organization_id = p_organization_id
            and setting.group_id = training_group.id
        )
      ) order by
        exists (
          select 1
          from public.performance_group_settings setting
          where setting.organization_id = p_organization_id
            and setting.group_id = training_group.id
        ) desc,
        training_group.sort_order,
        lower(training_group.name))
      from public.training_groups training_group
      where training_group.organization_id = p_organization_id
        and training_group.is_active
    ), '[]'::jsonb),
    'athletes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', athlete.id,
        'first_name', athlete.first_name,
        'last_name', athlete.last_name,
        'group_ids', coalesce((
          select jsonb_agg(membership.group_id order by membership.group_id)
          from public.athlete_group_memberships membership
          join public.training_groups assigned_group
            on assigned_group.id = membership.group_id
           and assigned_group.organization_id = membership.organization_id
          where membership.organization_id = p_organization_id
            and membership.athlete_id = athlete.id
            and membership.ended_on is null
            and assigned_group.is_active
        ), '[]'::jsonb)
      ) order by lower(athlete.last_name), lower(athlete.first_name))
      from public.athletes athlete
      where athlete.organization_id = p_organization_id
        and athlete.is_active
        and (
          p_group_id is null
          or exists (
            select 1
            from public.athlete_group_memberships membership
            where membership.organization_id = p_organization_id
              and membership.athlete_id = athlete.id
              and membership.group_id = p_group_id
              and membership.ended_on is null
          )
        )
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', block.id,
        'name', block.name,
        'goal', block.goal,
        'description', block.description,
        'estimated_minutes', block.estimated_minutes,
        'group_ids', coalesce((
          select jsonb_agg(assignment.group_id order by assignment.group_id)
          from public.training_block_group_assignments assignment
          where assignment.block_id = block.id
        ), '[]'::jsonb),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exercise_id', exercise.id,
            'exercise_name', exercise.name,
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
        ), '[]'::jsonb)
      ) order by lower(block.name))
      from public.training_blocks block
      where block.organization_id = p_organization_id
        and block.is_active
        and (
          p_group_id is null
          or not exists (
            select 1 from public.training_block_group_assignments any_assignment
            where any_assignment.block_id = block.id
          )
          or exists (
            select 1 from public.training_block_group_assignments assignment
            where assignment.block_id = block.id
              and assignment.group_id = p_group_id
          )
        )
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', exercise.id,
        'name', exercise.name,
        'category_key', exercise.category_key,
        'category_title', coalesce(category_assignment.title, category.title),
        'subcategory', exercise.subcategory,
        'goal', exercise.goal,
        'description', exercise.description,
        'coaching_cues', exercise.coaching_cues,
        'common_mistakes', exercise.common_mistakes,
        'equipment', to_jsonb(exercise.equipment),
        'video_url', exercise.video_url,
        'group_ids', coalesce((
          select jsonb_agg(assignment.group_id order by assignment.group_id)
          from public.exercise_group_assignments assignment
          where assignment.exercise_id = exercise.id
        ), '[]'::jsonb),
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
      ) order by lower(exercise.name))
      from public.exercises exercise
      join public.exercise_categories category on category.key = exercise.category_key
      left join public.organization_exercise_categories category_assignment
        on category_assignment.organization_id = p_organization_id
       and category_assignment.category_key = exercise.category_key
      where exercise.organization_id = p_organization_id
        and exercise.is_active
        and (
          p_group_id is null
          or not exists (
            select 1 from public.exercise_group_assignments any_assignment
            where any_assignment.exercise_id = exercise.id
          )
          or exists (
            select 1 from public.exercise_group_assignments assignment
            where assignment.exercise_id = exercise.id
              and assignment.group_id = p_group_id
          )
        )
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', plan.id,
        'athlete_id', plan.athlete_id,
        'athlete_name', athlete.first_name || ' ' || athlete.last_name,
        'group_id', plan.group_id,
        'training_date', plan.training_date,
        'title', plan.title,
        'status', plan.status,
        'source_plan_id', plan.source_plan_id,
        'copied_from_athlete_id', plan.copied_from_athlete_id,
        'copied_from_athlete_name', case
          when source_athlete.id is null then null
          else source_athlete.first_name || ' ' || source_athlete.last_name
        end,
        'section_count', (
          select count(*) from public.athlete_training_plan_sections section
          where section.plan_id = plan.id
        ),
        'exercise_count', (
          select count(*) from public.athlete_training_plan_items item
          where item.plan_id = plan.id
        ),
        'total_minutes', coalesce((
          select sum(section.estimated_minutes)
          from public.athlete_training_plan_sections section
          where section.plan_id = plan.id
        ), 0),
        'updated_at', plan.updated_at
      ) order by lower(athlete.last_name), lower(athlete.first_name))
      from public.athlete_training_plans plan
      join public.athletes athlete on athlete.id = plan.athlete_id
      left join public.athletes source_athlete on source_athlete.id = plan.copied_from_athlete_id
      where plan.organization_id = p_organization_id
        and athlete.is_active
        and plan.training_date = p_training_date
        and (p_group_id is null or plan.group_id = p_group_id)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.training_plan_detail(
  p_organization_id uuid,
  p_plan_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null or not public.has_module_access(
    p_organization_id,
    'training_planning',
    false
  ) then
    raise exception 'Für den Trainingsplan fehlen die erforderlichen Rechte.';
  end if;

  select jsonb_build_object(
    'id', plan.id,
    'athlete_id', plan.athlete_id,
    'athlete_name', athlete.first_name || ' ' || athlete.last_name,
    'group_id', plan.group_id,
    'training_date', plan.training_date,
    'title', plan.title,
    'notes', plan.notes,
    'status', plan.status,
    'source_plan_id', plan.source_plan_id,
    'copied_from_athlete_id', plan.copied_from_athlete_id,
    'copied_from_athlete_name', case
      when source_athlete.id is null then null
      else source_athlete.first_name || ' ' || source_athlete.last_name
    end,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', section.id,
        'section_type', section.section_type,
        'source_block_id', section.source_block_id,
        'counts_as_block_usage', section.counts_as_block_usage,
        'name', section.name,
        'goal', section.goal,
        'description', section.description,
        'estimated_minutes', section.estimated_minutes,
        'sort_order', section.sort_order,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', item.id,
            'exercise_id', item.source_exercise_id,
            'exercise_name', item.exercise_name,
            'category_title', item.category_title,
            'note', item.note,
            'parameter_definitions', item.parameter_definitions,
            'parameter_values', item.parameter_values,
            'sort_order', item.sort_order
          ) order by item.sort_order)
          from public.athlete_training_plan_items item
          where item.section_id = section.id
        ), '[]'::jsonb)
      ) order by section.sort_order)
      from public.athlete_training_plan_sections section
      where section.plan_id = plan.id
    ), '[]'::jsonb),
    'created_at', plan.created_at,
    'updated_at', plan.updated_at
  )
  into v_result
  from public.athlete_training_plans plan
  join public.athletes athlete on athlete.id = plan.athlete_id
  left join public.athletes source_athlete on source_athlete.id = plan.copied_from_athlete_id
  where plan.id = p_plan_id
    and plan.organization_id = p_organization_id;

  if v_result is null then
    raise exception 'Der Trainingsplan wurde nicht gefunden.';
  end if;

  return v_result;
end;
$$;

create or replace function public.save_athlete_training_plan(
  p_organization_id uuid,
  p_plan_id uuid,
  p_athlete_id uuid,
  p_group_id uuid,
  p_training_date date,
  p_title text,
  p_notes text,
  p_sections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_plan_id uuid;
  v_plan_before jsonb;
  v_title text := trim(coalesce(p_title, ''));
  v_section jsonb;
  v_section_id uuid;
  v_section_type text;
  v_source_block_id uuid;
  v_estimated_minutes integer;
  v_item jsonb;
  v_exercise_id uuid;
  v_exercise_name text;
  v_category_title text;
  v_parameter_definitions jsonb;
  v_parameter_values jsonb;
  v_counts_as_usage boolean;
  v_section_ordinality bigint;
  v_item_ordinality bigint;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'training_planning',
    true
  ) then
    raise exception 'Du darfst Trainingspläne nicht bearbeiten.';
  end if;

  if p_training_date is null then
    raise exception 'Bitte ein Trainingsdatum auswählen.';
  end if;

  if not exists (
    select 1 from public.training_groups training_group
    where training_group.id = p_group_id
      and training_group.organization_id = p_organization_id
      and training_group.is_active
  ) then
    raise exception 'Die ausgewählte Trainingsgruppe ist ungültig oder inaktiv.';
  end if;

  if not exists (
    select 1
    from public.athletes athlete
    join public.athlete_group_memberships membership
      on membership.athlete_id = athlete.id
     and membership.organization_id = athlete.organization_id
     and membership.group_id = p_group_id
     and membership.ended_on is null
    where athlete.id = p_athlete_id
      and athlete.organization_id = p_organization_id
      and athlete.is_active
  ) then
    raise exception 'Der Athlet ist der ausgewählten Trainingsgruppe nicht aktiv zugeordnet.';
  end if;

  if jsonb_typeof(coalesce(p_sections, '[]'::jsonb)) <> 'array' then
    raise exception 'Die Planabschnitte besitzen ein ungültiges Format.';
  end if;

  if v_title = '' then
    v_title := 'Training ' || to_char(p_training_date, 'DD.MM.YYYY');
  end if;
  if char_length(v_title) < 2 or char_length(v_title) > 160 then
    raise exception 'Der Plantitel muss zwischen 2 und 160 Zeichen lang sein.';
  end if;

  if p_plan_id is null then
    if exists (
      select 1 from public.athlete_training_plans existing
      where existing.organization_id = p_organization_id
        and existing.group_id = p_group_id
        and existing.athlete_id = p_athlete_id
        and existing.training_date = p_training_date
    ) then
      raise exception 'Für diesen Athleten existiert an diesem Tag bereits ein Trainingsplan.';
    end if;

    insert into public.athlete_training_plans (
      organization_id,
      athlete_id,
      group_id,
      training_date,
      title,
      notes,
      status,
      created_by,
      updated_by
    ) values (
      p_organization_id,
      p_athlete_id,
      p_group_id,
      p_training_date,
      v_title,
      nullif(trim(coalesce(p_notes, '')), ''),
      'draft',
      v_current_user_id,
      v_current_user_id
    )
    returning id into v_plan_id;
  else
    select to_jsonb(existing), existing.id
    into v_plan_before, v_plan_id
    from public.athlete_training_plans existing
    where existing.id = p_plan_id
      and existing.organization_id = p_organization_id;

    if v_plan_id is null then
      raise exception 'Der Trainingsplan wurde nicht gefunden.';
    end if;

    if not exists (
      select 1 from public.athlete_training_plans existing
      where existing.id = v_plan_id
        and existing.athlete_id = p_athlete_id
        and existing.group_id = p_group_id
        and existing.training_date = p_training_date
    ) then
      raise exception 'Athlet, Gruppe und Datum eines bestehenden Plans können nicht geändert werden.';
    end if;

    update public.athlete_training_plans
    set
      title = v_title,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      updated_by = v_current_user_id
    where id = v_plan_id;
  end if;

  delete from public.athlete_training_plan_sections where plan_id = v_plan_id;

  for v_section, v_section_ordinality in
    select section_value, ordinality
    from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb))
      with ordinality as section_values(section_value, ordinality)
  loop
    v_section_type := v_section ->> 'section_type';
    if v_section_type is null or v_section_type not in ('block', 'exercise') then
      raise exception 'Ein Planabschnitt besitzt einen ungültigen Typ.';
    end if;

    begin
      v_source_block_id := nullif(v_section ->> 'source_block_id', '')::uuid;
      v_estimated_minutes := nullif(v_section ->> 'estimated_minutes', '')::integer;
    exception when invalid_text_representation then
      raise exception 'Blockreferenz oder Dauer eines Planabschnitts ist ungültig.';
    end;

    if v_estimated_minutes is not null and (v_estimated_minutes < 0 or v_estimated_minutes > 1440) then
      raise exception 'Die Dauer eines Planabschnitts muss zwischen 0 und 1440 Minuten liegen.';
    end if;

    if v_source_block_id is not null and not exists (
      select 1 from public.training_blocks block
      where block.id = v_source_block_id
        and block.organization_id = p_organization_id
    ) then
      raise exception 'Ein verwendeter Trainingsblock wurde nicht gefunden.';
    end if;

    v_counts_as_usage := coalesce((v_section ->> 'counts_as_block_usage')::boolean, true);

    insert into public.athlete_training_plan_sections (
      organization_id,
      plan_id,
      section_type,
      source_block_id,
      counts_as_block_usage,
      name,
      goal,
      description,
      estimated_minutes,
      sort_order
    ) values (
      p_organization_id,
      v_plan_id,
      v_section_type,
      v_source_block_id,
      case when v_source_block_id is null then false else v_counts_as_usage end,
      coalesce(nullif(trim(v_section ->> 'name'), ''), 'Planabschnitt'),
      nullif(trim(coalesce(v_section ->> 'goal', '')), ''),
      nullif(trim(coalesce(v_section ->> 'description', '')), ''),
      v_estimated_minutes,
      v_section_ordinality::integer
    )
    returning id into v_section_id;

    if jsonb_typeof(coalesce(v_section -> 'items', '[]'::jsonb)) <> 'array' then
      raise exception 'Die Übungen eines Planabschnitts besitzen ein ungültiges Format.';
    end if;

    for v_item, v_item_ordinality in
      select item_value, ordinality
      from jsonb_array_elements(coalesce(v_section -> 'items', '[]'::jsonb))
        with ordinality as item_values(item_value, ordinality)
    loop
      begin
        v_exercise_id := nullif(v_item ->> 'exercise_id', '')::uuid;
      exception when invalid_text_representation then
        raise exception 'Eine Übungsreferenz ist ungültig.';
      end;

      if v_exercise_id is null then
        raise exception 'Eine Übung besitzt keine gültige Referenz.';
      end if;

      select
        exercise.name,
        coalesce(category_assignment.title, category.title)
      into v_exercise_name, v_category_title
      from public.exercises exercise
      join public.exercise_categories category on category.key = exercise.category_key
      left join public.organization_exercise_categories category_assignment
        on category_assignment.organization_id = p_organization_id
       and category_assignment.category_key = exercise.category_key
      where exercise.id = v_exercise_id
        and exercise.organization_id = p_organization_id;

      if v_exercise_name is null then
        raise exception 'Eine Übung des Plans wurde nicht gefunden.';
      end if;

      v_parameter_definitions := coalesce(v_item -> 'parameter_definitions', '[]'::jsonb);
      v_parameter_values := coalesce(v_item -> 'parameter_values', '{}'::jsonb);
      if jsonb_typeof(v_parameter_definitions) <> 'array' then
        raise exception 'Die Parameterdefinitionen einer Übung sind ungültig.';
      end if;
      if jsonb_typeof(v_parameter_values) <> 'object' then
        raise exception 'Die Parameterwerte einer Übung sind ungültig.';
      end if;

      insert into public.athlete_training_plan_items (
        organization_id,
        plan_id,
        section_id,
        source_exercise_id,
        exercise_name,
        category_title,
        note,
        parameter_definitions,
        parameter_values,
        sort_order
      ) values (
        p_organization_id,
        v_plan_id,
        v_section_id,
        v_exercise_id,
        v_exercise_name,
        v_category_title,
        nullif(trim(coalesce(v_item ->> 'note', '')), ''),
        v_parameter_definitions,
        jsonb_strip_nulls(v_parameter_values),
        v_item_ordinality::integer
      );
    end loop;
  end loop;

  insert into public.training_block_usages (
    organization_id,
    block_id,
    source_type,
    source_id
  )
  select distinct
    p_organization_id,
    section.source_block_id,
    'training_plan',
    v_plan_id::text
  from public.athlete_training_plan_sections section
  where section.plan_id = v_plan_id
    and section.source_block_id is not null
    and section.counts_as_block_usage
  on conflict (block_id, source_type, source_id) do nothing;

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
    case when p_plan_id is null then 'training_plan_created' else 'training_plan_updated' end,
    'athlete_training_plan',
    v_plan_id::text,
    v_plan_before,
    (select to_jsonb(plan) from public.athlete_training_plans plan where plan.id = v_plan_id)
  );

  return v_plan_id;
end;
$$;

create or replace function public.copy_athlete_training_plan(
  p_organization_id uuid,
  p_source_plan_id uuid,
  p_target_athlete_ids uuid[],
  p_overwrite_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_source public.athlete_training_plans%rowtype;
  v_target_athlete_id uuid;
  v_target_plan_id uuid;
  v_existing_plan_id uuid;
  v_source_section record;
  v_new_section_id uuid;
  v_copied jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'training_planning',
    true
  ) then
    raise exception 'Du darfst Trainingspläne nicht kopieren.';
  end if;

  select * into v_source
  from public.athlete_training_plans plan
  where plan.id = p_source_plan_id
    and plan.organization_id = p_organization_id;

  if v_source.id is null then
    raise exception 'Der Ausgangsplan wurde nicht gefunden.';
  end if;

  foreach v_target_athlete_id in array coalesce(p_target_athlete_ids, '{}'::uuid[]) loop
    if v_target_athlete_id = v_source.athlete_id then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'athlete_id', v_target_athlete_id,
        'reason', 'source_athlete'
      ));
      continue;
    end if;

    if not exists (
      select 1
      from public.athletes athlete
      join public.athlete_group_memberships membership
        on membership.athlete_id = athlete.id
       and membership.organization_id = athlete.organization_id
       and membership.group_id = v_source.group_id
       and membership.ended_on is null
      where athlete.id = v_target_athlete_id
        and athlete.organization_id = p_organization_id
        and athlete.is_active
    ) then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'athlete_id', v_target_athlete_id,
        'reason', 'not_in_group'
      ));
      continue;
    end if;

    select plan.id into v_existing_plan_id
    from public.athlete_training_plans plan
    where plan.organization_id = p_organization_id
      and plan.group_id = v_source.group_id
      and plan.athlete_id = v_target_athlete_id
      and plan.training_date = v_source.training_date;

    if v_existing_plan_id is not null and not coalesce(p_overwrite_existing, false) then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'athlete_id', v_target_athlete_id,
        'plan_id', v_existing_plan_id,
        'reason', 'existing_plan'
      ));
      continue;
    end if;

    if v_existing_plan_id is null then
      insert into public.athlete_training_plans (
        organization_id,
        athlete_id,
        group_id,
        training_date,
        title,
        notes,
        status,
        source_plan_id,
        copied_from_athlete_id,
        created_by,
        updated_by
      ) values (
        p_organization_id,
        v_target_athlete_id,
        v_source.group_id,
        v_source.training_date,
        v_source.title,
        v_source.notes,
        'draft',
        v_source.id,
        v_source.athlete_id,
        v_current_user_id,
        v_current_user_id
      ) returning id into v_target_plan_id;
    else
      v_target_plan_id := v_existing_plan_id;
      update public.athlete_training_plans
      set
        title = v_source.title,
        notes = v_source.notes,
        status = 'draft',
        source_plan_id = v_source.id,
        copied_from_athlete_id = v_source.athlete_id,
        updated_by = v_current_user_id
      where id = v_target_plan_id;
      delete from public.athlete_training_plan_sections where plan_id = v_target_plan_id;
    end if;

    for v_source_section in
      select *
      from public.athlete_training_plan_sections section
      where section.plan_id = v_source.id
      order by section.sort_order
    loop
      insert into public.athlete_training_plan_sections (
        organization_id,
        plan_id,
        section_type,
        source_block_id,
        counts_as_block_usage,
        name,
        goal,
        description,
        estimated_minutes,
        sort_order
      ) values (
        p_organization_id,
        v_target_plan_id,
        v_source_section.section_type,
        v_source_section.source_block_id,
        false,
        v_source_section.name,
        v_source_section.goal,
        v_source_section.description,
        v_source_section.estimated_minutes,
        v_source_section.sort_order
      ) returning id into v_new_section_id;

      insert into public.athlete_training_plan_items (
        organization_id,
        plan_id,
        section_id,
        source_exercise_id,
        exercise_name,
        category_title,
        note,
        parameter_definitions,
        parameter_values,
        sort_order
      )
      select
        p_organization_id,
        v_target_plan_id,
        v_new_section_id,
        item.source_exercise_id,
        item.exercise_name,
        item.category_title,
        item.note,
        item.parameter_definitions,
        item.parameter_values,
        item.sort_order
      from public.athlete_training_plan_items item
      where item.section_id = v_source_section.id
      order by item.sort_order;
    end loop;

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
      case when v_existing_plan_id is null then 'training_plan_copied' else 'training_plan_overwritten_by_copy' end,
      'athlete_training_plan',
      v_target_plan_id::text,
      null,
      jsonb_build_object('source_plan_id', v_source.id, 'source_athlete_id', v_source.athlete_id)
    );

    v_copied := v_copied || jsonb_build_array(jsonb_build_object(
      'athlete_id', v_target_athlete_id,
      'plan_id', v_target_plan_id,
      'overwritten', v_existing_plan_id is not null
    ));

    v_existing_plan_id := null;
  end loop;

  return jsonb_build_object(
    'copied', v_copied,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.training_planning_overview(uuid, date, uuid) from public;
revoke all on function public.training_plan_detail(uuid, uuid) from public;
revoke all on function public.save_athlete_training_plan(uuid, uuid, uuid, uuid, date, text, text, jsonb) from public;
revoke all on function public.copy_athlete_training_plan(uuid, uuid, uuid[], boolean) from public;

grant execute on function public.training_planning_overview(uuid, date, uuid) to authenticated;
grant execute on function public.training_plan_detail(uuid, uuid) to authenticated;
grant execute on function public.save_athlete_training_plan(uuid, uuid, uuid, uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.copy_athlete_training_plan(uuid, uuid, uuid[], boolean) to authenticated;

commit;
