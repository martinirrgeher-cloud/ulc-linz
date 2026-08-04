-- P2a: schlanke Lesemodelle fuer Uebungskatalog und Trainingsbloecke.
-- Verwendungsdetails und Blockversionen werden erst bei Bedarf geladen.

begin;

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

create or replace function public.exercise_usage_overview(
  p_organization_id uuid,
  p_exercise_id uuid
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
    'exercise_catalog',
    false
  ) then
    raise exception 'Fuer den Uebungskatalog fehlen die erforderlichen Rechte.';
  end if;

  if not exists (
    select 1
    from public.exercises exercise
    where exercise.organization_id = p_organization_id
      and exercise.id = p_exercise_id
  ) then
    raise exception 'Die Uebung wurde nicht gefunden.';
  end if;

  return jsonb_build_object(
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
          and item.exercise_id = p_exercise_id
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
            and item.source_exercise_id = p_exercise_id
        ) candidate
        order by candidate.plan_id, candidate.via_block_name nulls first
      ) usage
    ), '[]'::jsonb),
    'last_used_at', (
      select max(plan.training_date)
      from public.athlete_training_plan_items item
      join public.athlete_training_plans plan on plan.id = item.plan_id
      where item.organization_id = p_organization_id
        and item.source_exercise_id = p_exercise_id
    )
  );
end;
$$;

create or replace function public.training_block_overview_v4(
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
            where favorite.block_id = block.id
              and favorite.user_id = v_current_user_id
          ),
          'variant_parent_id', block.variant_parent_id,
          'variant_root_id', block.variant_root_id,
          'variant_number', block.variant_number,
          'variant_parent_name', parent.name,
          'inactive_exercise_count', (
            select count(*)
            from public.training_block_items item
            join public.exercises exercise on exercise.id = item.exercise_id
            where item.block_id = block.id
              and not exercise.is_active
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
          'version_count', (
            select count(*)
            from public.training_block_versions version
            where version.block_id = block.id
          ),
          'latest_version', (
            select jsonb_build_object(
              'id', version.id,
              'version_number', version.version_number,
              'reason', version.reason,
              'created_at', version.created_at
            )
            from public.training_block_versions version
            where version.block_id = block.id
            order by version.version_number desc
            limit 1
          )
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

create or replace function public.training_block_versions_overview(
  p_organization_id uuid,
  p_block_id uuid
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
    'training_blocks',
    false
  ) then
    raise exception 'Fuer Trainingsbloecke fehlen die erforderlichen Rechte.';
  end if;

  if not exists (
    select 1
    from public.training_blocks block
    where block.organization_id = p_organization_id
      and block.id = p_block_id
  ) then
    raise exception 'Der Trainingsblock wurde nicht gefunden.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', version.id,
      'version_number', version.version_number,
      'reason', version.reason,
      'snapshot', version.snapshot,
      'created_at', version.created_at
    ) order by version.version_number desc)
    from public.training_block_versions version
    where version.organization_id = p_organization_id
      and version.block_id = p_block_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.exercise_catalog_overview_v4(uuid, boolean) from public;
revoke all on function public.exercise_usage_overview(uuid, uuid) from public;
revoke all on function public.training_block_overview_v4(uuid, boolean) from public;
revoke all on function public.training_block_versions_overview(uuid, uuid) from public;

grant execute on function public.exercise_catalog_overview_v4(uuid, boolean) to authenticated;
grant execute on function public.exercise_usage_overview(uuid, uuid) to authenticated;
grant execute on function public.training_block_overview_v4(uuid, boolean) to authenticated;
grant execute on function public.training_block_versions_overview(uuid, uuid) to authenticated;

commit;
