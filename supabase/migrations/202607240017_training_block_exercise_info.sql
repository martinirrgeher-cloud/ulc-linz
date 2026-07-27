-- ULC Linz App v12
-- Erweiterte Übungsinformationen in Trainingsblöcken und lesbarer Videozugriff.

begin;

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

create or replace function public.training_block_exercise_video_overview(
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
    'training_blocks',
    false
  ) then
    raise exception 'Für die Übungsvideos in Trainingsblöcken fehlen die erforderlichen Rechte.';
  end if;

  if not exists (
    select 1
    from public.exercises exercise
    where exercise.id = p_exercise_id
      and exercise.organization_id = p_organization_id
  ) then
    raise exception 'Die Übung wurde nicht gefunden.';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', video.id,
          'exercise_id', video.exercise_id,
          'title', video.title,
          'storage_path', video.storage_path,
          'mime_type', video.mime_type,
          'file_size', video.file_size,
          'is_primary', video.is_primary,
          'created_at', video.created_at
        )
        order by video.is_primary desc, video.created_at, lower(video.title)
      )
      from public.exercise_videos video
      where video.organization_id = p_organization_id
        and video.exercise_id = p_exercise_id
    ),
    '[]'::jsonb
  );
end;
$$;

-- Trainingsblock-Berechtigte dürfen private Übungsvideos lesen,
-- bearbeiten oder löschen dürfen sie weiterhin nur über den Übungskatalog.
drop policy if exists exercise_videos_storage_select on storage.objects;
create policy exercise_videos_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-videos'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (
    public.has_module_access(
      split_part(name, '/', 1)::uuid,
      'exercise_catalog',
      false
    )
    or public.has_module_access(
      split_part(name, '/', 1)::uuid,
      'training_blocks',
      false
    )
  )
);

revoke all on function public.training_block_exercise_video_overview(uuid, uuid) from public;
grant execute on function public.training_block_exercise_video_overview(uuid, uuid) to authenticated;

commit;
