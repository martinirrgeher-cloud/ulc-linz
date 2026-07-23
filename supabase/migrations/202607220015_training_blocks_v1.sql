-- ULC Linz App – Trainingsblöcke V1
-- Wiederverwendbare Übungsfolgen mit Gruppenzuordnung und überschreibbaren Parametern.

begin;

update public.app_modules
set
  title = 'Trainingsblöcke',
  description = 'Wiederverwendbare Übungsfolgen verwalten',
  route = '/module/training_blocks',
  icon = 'clipboard-check',
  sort_order = 80,
  is_active = true
where key = 'training_blocks';

create table if not exists public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  goal text check (goal is null or char_length(trim(goal)) <= 240),
  description text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 600),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists training_blocks_org_name_unique_idx
  on public.training_blocks (organization_id, lower(name));
create index if not exists training_blocks_org_active_name_idx
  on public.training_blocks (organization_id, is_active, lower(name));

create table if not exists public.training_block_group_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (block_id, group_id)
);

create index if not exists training_block_group_assignments_group_idx
  on public.training_block_group_assignments (organization_id, group_id);

create table if not exists public.training_block_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null check (sort_order > 0),
  note text,
  parameter_values jsonb not null default '{}'::jsonb check (jsonb_typeof(parameter_values) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (block_id, sort_order)
);

create index if not exists training_block_items_block_idx
  on public.training_block_items (block_id, sort_order);
create index if not exists training_block_items_exercise_idx
  on public.training_block_items (organization_id, exercise_id);

drop trigger if exists training_blocks_set_updated_at on public.training_blocks;
create trigger training_blocks_set_updated_at
before update on public.training_blocks
for each row execute function public.set_updated_at();

drop trigger if exists training_block_items_set_updated_at on public.training_block_items;
create trigger training_block_items_set_updated_at
before update on public.training_block_items
for each row execute function public.set_updated_at();

alter table public.training_blocks enable row level security;
alter table public.training_block_group_assignments enable row level security;
alter table public.training_block_items enable row level security;

drop policy if exists training_blocks_read on public.training_blocks;
create policy training_blocks_read
on public.training_blocks
for select
to authenticated
using (public.has_module_access(organization_id, 'training_blocks', false));

drop policy if exists training_blocks_write on public.training_blocks;
create policy training_blocks_write
on public.training_blocks
for all
to authenticated
using (public.has_module_access(organization_id, 'training_blocks', true))
with check (public.has_module_access(organization_id, 'training_blocks', true));

drop policy if exists training_block_groups_read on public.training_block_group_assignments;
create policy training_block_groups_read
on public.training_block_group_assignments
for select
to authenticated
using (public.has_module_access(organization_id, 'training_blocks', false));

drop policy if exists training_block_groups_write on public.training_block_group_assignments;
create policy training_block_groups_write
on public.training_block_group_assignments
for all
to authenticated
using (public.has_module_access(organization_id, 'training_blocks', true))
with check (public.has_module_access(organization_id, 'training_blocks', true));

drop policy if exists training_block_items_read on public.training_block_items;
create policy training_block_items_read
on public.training_block_items
for select
to authenticated
using (public.has_module_access(organization_id, 'training_blocks', false));

drop policy if exists training_block_items_write on public.training_block_items;
create policy training_block_items_write
on public.training_block_items
for all
to authenticated
using (public.has_module_access(organization_id, 'training_blocks', true))
with check (public.has_module_access(organization_id, 'training_blocks', true));

revoke all on table public.training_blocks from anon, authenticated;
revoke all on table public.training_block_group_assignments from anon, authenticated;
revoke all on table public.training_block_items from anon, authenticated;

create or replace function public.training_block_overview(
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
    'training_blocks',
    false
  ) then
    raise exception 'Für Trainingsblöcke fehlen die erforderlichen Rechte.';
  end if;

  return jsonb_build_object(
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
          and exists (
            select 1
            from public.performance_group_settings performance_settings
            where performance_settings.organization_id = p_organization_id
              and performance_settings.group_id = training_group.id
          )
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
            'is_active', exercise.is_active,
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
            )
          )
          order by lower(exercise.name)
        )
        from public.exercises exercise
        join public.exercise_categories category on category.key = exercise.category_key
        where exercise.organization_id = p_organization_id
      ),
      '[]'::jsonb
    ),
    'blocks', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', block.id,
            'name', block.name,
            'goal', block.goal,
            'description', block.description,
            'estimated_minutes', block.estimated_minutes,
            'is_active', block.is_active,
            'group_ids', coalesce(
              (
                select jsonb_agg(assignment.group_id order by assignment.group_id)
                from public.training_block_group_assignments assignment
                where assignment.block_id = block.id
              ),
              '[]'::jsonb
            ),
            'items', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', item.id,
                    'exercise_id', exercise.id,
                    'exercise_name', exercise.name,
                    'exercise_is_active', exercise.is_active,
                    'category_title', category.title,
                    'sort_order', item.sort_order,
                    'note', item.note,
                    'parameter_values', item.parameter_values,
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
                    )
                  )
                  order by item.sort_order
                )
                from public.training_block_items item
                join public.exercises exercise on exercise.id = item.exercise_id
                join public.exercise_categories category on category.key = exercise.category_key
                where item.block_id = block.id
              ),
              '[]'::jsonb
            ),
            'created_at', block.created_at,
            'updated_at', block.updated_at
          )
          order by lower(block.name)
        )
        from public.training_blocks block
        where block.organization_id = p_organization_id
          and (p_include_inactive or block.is_active)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.save_training_block(
  p_organization_id uuid,
  p_block_id uuid default null,
  p_name text default null,
  p_goal text default null,
  p_description text default null,
  p_estimated_minutes integer default null,
  p_is_active boolean default true,
  p_group_ids uuid[] default '{}',
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_block_id uuid := p_block_id;
  v_name text := trim(coalesce(p_name, ''));
  v_before jsonb;
  v_after jsonb;
  v_item jsonb;
  v_item_exercise_id uuid;
  v_parameter_key text;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'training_blocks',
    true
  ) then
    raise exception 'Du darfst Trainingsblöcke nicht bearbeiten.';
  end if;

  if char_length(v_name) < 2 then
    raise exception 'Der Name des Trainingsblocks ist zu kurz.';
  end if;

  if p_estimated_minutes is not null and (p_estimated_minutes < 1 or p_estimated_minutes > 600) then
    raise exception 'Die geschätzte Dauer muss zwischen 1 und 600 Minuten liegen.';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Die Übungen besitzen ein ungültiges Format.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Ein Trainingsblock muss mindestens eine Übung enthalten.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 100 then
    raise exception 'Ein Trainingsblock darf höchstens 100 Übungen enthalten.';
  end if;

  if exists (
    select 1
    from public.training_blocks existing
    where existing.organization_id = p_organization_id
      and lower(existing.name) = lower(v_name)
      and (v_block_id is null or existing.id <> v_block_id)
  ) then
    raise exception 'Ein Trainingsblock mit diesem Namen existiert bereits.';
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
        and exists (
          select 1
          from public.performance_group_settings performance_settings
          where performance_settings.organization_id = p_organization_id
            and performance_settings.group_id = training_group.id
        )
    )
  ) then
    raise exception 'Mindestens eine ausgewählte Trainingsgruppe ist ungültig oder inaktiv.';
  end if;

  for v_item in
    select element
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as items(element)
  loop
    begin
      v_item_exercise_id := (v_item ->> 'exercise_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Eine ausgewählte Übung besitzt eine ungültige Kennung.';
    end;

    if not exists (
      select 1
      from public.exercises exercise
      where exercise.id = v_item_exercise_id
        and exercise.organization_id = p_organization_id
    ) then
      raise exception 'Mindestens eine ausgewählte Übung wurde nicht gefunden.';
    end if;

    if jsonb_typeof(coalesce(v_item -> 'parameter_values', '{}'::jsonb)) <> 'object' then
      raise exception 'Die Parameterwerte einer Übung besitzen ein ungültiges Format.';
    end if;

    for v_parameter_key in
      select key
      from jsonb_object_keys(coalesce(v_item -> 'parameter_values', '{}'::jsonb)) as parameter_keys(key)
    loop
      if not exists (
        select 1
        from public.exercise_parameter_definitions parameter
        where parameter.exercise_id = v_item_exercise_id
          and parameter.parameter_key = v_parameter_key
      ) then
        raise exception 'Der Parameter % gehört nicht zur ausgewählten Übung.', v_parameter_key;
      end if;
    end loop;
  end loop;

  if v_block_id is null then
    insert into public.training_blocks (
      organization_id, name, goal, description, estimated_minutes, is_active, created_by
    ) values (
      p_organization_id,
      v_name,
      nullif(trim(coalesce(p_goal, '')), ''),
      nullif(trim(coalesce(p_description, '')), ''),
      p_estimated_minutes,
      coalesce(p_is_active, true),
      v_current_user_id
    )
    returning id into v_block_id;
  else
    select jsonb_build_object(
      'block', to_jsonb(existing),
      'group_ids', coalesce(
        (
          select jsonb_agg(assignment.group_id order by assignment.group_id)
          from public.training_block_group_assignments assignment
          where assignment.block_id = existing.id
        ),
        '[]'::jsonb
      ),
      'items', coalesce(
        (
          select jsonb_agg(to_jsonb(item) order by item.sort_order)
          from public.training_block_items item
          where item.block_id = existing.id
        ),
        '[]'::jsonb
      )
    )
    into v_before
    from public.training_blocks existing
    where existing.id = v_block_id
      and existing.organization_id = p_organization_id;

    if v_before is null then
      raise exception 'Der Trainingsblock wurde nicht gefunden.';
    end if;

    update public.training_blocks
    set
      name = v_name,
      goal = nullif(trim(coalesce(p_goal, '')), ''),
      description = nullif(trim(coalesce(p_description, '')), ''),
      estimated_minutes = p_estimated_minutes,
      is_active = coalesce(p_is_active, true)
    where id = v_block_id
      and organization_id = p_organization_id;
  end if;

  delete from public.training_block_group_assignments where block_id = v_block_id;
  insert into public.training_block_group_assignments (organization_id, block_id, group_id)
  select distinct p_organization_id, v_block_id, requested_group_id
  from unnest(coalesce(p_group_ids, '{}')) as requested_groups(requested_group_id);

  delete from public.training_block_items where block_id = v_block_id;
  insert into public.training_block_items (
    organization_id, block_id, exercise_id, sort_order, note, parameter_values
  )
  select
    p_organization_id,
    v_block_id,
    (item ->> 'exercise_id')::uuid,
    item_ordinality::integer,
    nullif(trim(coalesce(item ->> 'note', '')), ''),
    jsonb_strip_nulls(coalesce(item -> 'parameter_values', '{}'::jsonb))
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    with ordinality as item_values(item, item_ordinality);

  select jsonb_build_object(
    'block', to_jsonb(block),
    'group_ids', coalesce(
      (
        select jsonb_agg(assignment.group_id order by assignment.group_id)
        from public.training_block_group_assignments assignment
        where assignment.block_id = block.id
      ),
      '[]'::jsonb
    ),
    'items', coalesce(
      (
        select jsonb_agg(to_jsonb(item) order by item.sort_order)
        from public.training_block_items item
        where item.block_id = block.id
      ),
      '[]'::jsonb
    )
  )
  into v_after
  from public.training_blocks block
  where block.id = v_block_id;

  insert into public.audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_organization_id,
    v_current_user_id,
    case when p_block_id is null then 'training_block_created' else 'training_block_updated' end,
    'training_block',
    v_block_id::text,
    v_before,
    v_after
  );

  return v_block_id;
end;
$$;

create or replace function public.duplicate_training_block(
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
  v_new_block_id uuid;
  v_base_name text;
  v_candidate_name text;
  v_suffix integer := 2;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'training_blocks',
    true
  ) then
    raise exception 'Du darfst Trainingsblöcke nicht duplizieren.';
  end if;

  select * into v_source
  from public.training_blocks block
  where block.id = p_block_id
    and block.organization_id = p_organization_id;

  if not found then
    raise exception 'Der Trainingsblock wurde nicht gefunden.';
  end if;

  v_base_name := left(v_source.name || ' – Kopie', 120);
  v_candidate_name := v_base_name;

  while exists (
    select 1
    from public.training_blocks existing
    where existing.organization_id = p_organization_id
      and lower(existing.name) = lower(v_candidate_name)
  ) loop
    v_candidate_name := left(v_base_name, greatest(2, 116 - char_length(v_suffix::text))) || ' (' || v_suffix || ')';
    v_suffix := v_suffix + 1;
  end loop;

  insert into public.training_blocks (
    organization_id, name, goal, description, estimated_minutes, is_active, created_by
  ) values (
    p_organization_id,
    v_candidate_name,
    v_source.goal,
    v_source.description,
    v_source.estimated_minutes,
    true,
    v_current_user_id
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

  insert into public.audit_log (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_organization_id,
    v_current_user_id,
    'training_block_duplicated',
    'training_block',
    v_new_block_id::text,
    jsonb_build_object('source_block_id', p_block_id, 'name', v_candidate_name)
  );

  return v_new_block_id;
end;
$$;

revoke all on function public.training_block_overview(uuid, boolean) from public;
revoke all on function public.save_training_block(
  uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb
) from public;
revoke all on function public.duplicate_training_block(uuid, uuid) from public;

grant execute on function public.training_block_overview(uuid, boolean) to authenticated;
grant execute on function public.save_training_block(
  uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb
) to authenticated;
grant execute on function public.duplicate_training_block(uuid, uuid) to authenticated;

commit;
