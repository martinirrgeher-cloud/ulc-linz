-- ULC Linz App v16 -> v18
-- Enthält die mobilen Verbesserungen aus v17 sowie den Excel-Import für Übungen und Athleten.

begin;

insert into public.app_modules (
  key,
  title,
  description,
  route,
  icon,
  sort_order,
  is_active
) values (
  'data_import',
  'Datenimport',
  'Übungen und Athleten aus Excel übernehmen',
  '/module/data_import',
  'file-spreadsheet',
  97,
  true
)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  route = excluded.route,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- Bestehende Rechte werden sicher übernommen. Der Import selbst prüft zusätzlich,
-- ob Übungen beziehungsweise Athleten tatsächlich bearbeitet werden dürfen.
with import_permissions as (
  select
    membership.id as membership_id,
    true as can_view,
    (
      membership.role = 'admin'
      or coalesce(bool_or(
        permission.module_key in ('exercise_catalog', 'athletes')
        and permission.can_edit
      ), false)
    ) as can_edit
  from public.organization_members membership
  left join public.member_module_permissions permission
    on permission.membership_id = membership.id
   and permission.module_key in ('exercise_catalog', 'athletes')
  where membership.status = 'active'
    and (
      membership.role = 'admin'
      or permission.can_view
    )
  group by membership.id, membership.role
)
insert into public.member_module_permissions (
  membership_id,
  module_key,
  can_view,
  can_edit
)
select
  import_permission.membership_id,
  'data_import',
  import_permission.can_view,
  import_permission.can_edit
from import_permissions import_permission
on conflict (membership_id, module_key) do update set
  can_view = excluded.can_view,
  can_edit = excluded.can_edit,
  updated_at = now();

create or replace function public.training_documentation_detail(
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
  v_user_id uuid := (select auth.uid());
  v_role public.app_role;
  v_own_athlete_id uuid;
  v_plan public.athlete_training_plans%rowtype;
  v_can_edit boolean := false;
  v_can_review boolean := false;
  v_result jsonb;
begin
  select membership.role
  into v_role
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = v_user_id
    and membership.status = 'active'
  limit 1;

  if v_user_id is null
     or v_role is null
     or not public.has_module_access(p_organization_id, 'training_documentation', false) then
    raise exception 'Für die Trainingsdokumentation fehlen die erforderlichen Rechte.';
  end if;

  select plan.*
  into v_plan
  from public.athlete_training_plans plan
  where plan.id = p_plan_id
    and plan.organization_id = p_organization_id;

  if v_plan.id is null then
    raise exception 'Der Trainingsplan wurde nicht gefunden.';
  end if;

  select athlete.id
  into v_own_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_user_id
    and athlete.is_active
  limit 1;

  if v_role not in ('admin', 'trainer') and v_plan.athlete_id is distinct from v_own_athlete_id then
    raise exception 'Du darfst nur deine eigene Trainingsdokumentation öffnen.';
  end if;

  v_can_edit := public.has_module_access(p_organization_id, 'training_documentation', true)
    and (v_role in ('admin', 'trainer') or v_plan.athlete_id = v_own_athlete_id);
  v_can_review := public.has_module_access(p_organization_id, 'training_documentation', true)
    and v_role in ('admin', 'trainer');

  select jsonb_build_object(
    'preview', jsonb_build_object(
      'plan_id', plan.id,
      'athlete_id', plan.athlete_id,
      'athlete_name', athlete.first_name || ' ' || athlete.last_name,
      'group_id', plan.group_id,
      'group_name', training_group.name,
      'training_date', plan.training_date,
      'title', plan.title,
      'notes', plan.notes,
      'planned_minutes', coalesce((
        select sum(section.estimated_minutes)
        from public.athlete_training_plan_sections section
        where section.plan_id = plan.id
      ), 0),
      'exercise_count', (
        select count(*)
        from public.athlete_training_plan_items item
        where item.plan_id = plan.id
      ),
      'can_edit', v_can_edit,
      'can_review', v_can_review,
      'sections', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', section.id,
            'name', section.name,
            'description', section.description,
            'estimated_minutes', section.estimated_minutes,
            'items', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', item.id,
                  'source_exercise_id', item.source_exercise_id,
                  'exercise_name', item.exercise_name,
                  'category_title', item.category_title,
                  'exercise_goal', exercise.goal,
                  'exercise_description', exercise.description,
                  'exercise_coaching_cues', exercise.coaching_cues,
                  'exercise_common_mistakes', exercise.common_mistakes,
                  'exercise_equipment', to_jsonb(coalesce(exercise.equipment, '{}'::text[])),
                  'note', item.note,
                  'parameter_definitions', item.parameter_definitions,
                  'parameter_values', item.parameter_values,
                  'exercise_video_url', exercise.video_url,
                  'exercise_video_storage_path', primary_video.storage_path
                )
                order by item.sort_order
              )
              from public.athlete_training_plan_items item
              left join public.exercises exercise
                on exercise.id = item.source_exercise_id
               and exercise.organization_id = item.organization_id
              left join lateral (
                select video.storage_path
                from public.exercise_videos video
                where video.organization_id = item.organization_id
                  and video.exercise_id = item.source_exercise_id
                order by video.is_primary desc, video.created_at
                limit 1
              ) primary_video on true
              where item.section_id = section.id
            ), '[]'::jsonb)
          )
          order by section.sort_order
        )
        from public.athlete_training_plan_sections section
        where section.plan_id = plan.id
      ), '[]'::jsonb)
    ),
    'session', (
      select jsonb_build_object(
        'id', session.id,
        'athlete_name', session.athlete_name_snapshot,
        'group_name', session.group_name_snapshot,
        'plan_title', session.plan_title_snapshot,
        'plan_notes', session.plan_notes_snapshot,
        'status', session.status,
        'started_at', session.started_at,
        'completed_at', session.completed_at,
        'planned_minutes', session.planned_minutes_snapshot,
        'actual_minutes', session.actual_minutes,
        'overall_rpe', session.overall_rpe,
        'overall_rating', session.overall_rating,
        'overall_comment', session.overall_comment,
        'pain_level', session.pain_level,
        'pain_comment', session.pain_comment,
        'trainer_feedback', session.trainer_feedback,
        'trainer_reviewed_at', session.trainer_reviewed_at,
        'edited_after_completion', session.edited_after_completion,
        'updated_at', session.updated_at,
        'sections', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', session_section.id,
              'name', session_section.name,
              'description', session_section.description,
              'estimated_minutes', session_section.estimated_minutes,
              'items', coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id', session_item.id,
                    'source_plan_item_id', session_item.source_plan_item_id,
                    'source_exercise_id', session_item.source_exercise_id,
                    'exercise_name', session_item.exercise_name,
                    'category_title', session_item.category_title,
                    'exercise_goal', exercise.goal,
                    'exercise_description', exercise.description,
                    'exercise_coaching_cues', exercise.coaching_cues,
                    'exercise_common_mistakes', exercise.common_mistakes,
                    'exercise_equipment', to_jsonb(coalesce(exercise.equipment, '{}'::text[])),
                    'planned_note', session_item.planned_note,
                    'parameter_definitions', session_item.parameter_definitions,
                    'planned_values', session_item.planned_values,
                    'actual_values', session_item.actual_values,
                    'status', session_item.status,
                    'rating', session_item.rating,
                    'rpe', session_item.rpe,
                    'comment', session_item.comment,
                    'pain_level', session_item.pain_level,
                    'pain_comment', session_item.pain_comment,
                    'trainer_comment', session_item.trainer_comment,
                    'exercise_video_url', session_item.exercise_video_url,
                    'exercise_video_storage_path', session_item.exercise_video_storage_path,
                    'sets', coalesce((
                      select jsonb_agg(
                        jsonb_build_object(
                          'id', session_set.id,
                          'set_number', session_set.set_number,
                          'planned_values', session_set.planned_values,
                          'actual_values', session_set.actual_values,
                          'status', session_set.status,
                          'comment', session_set.comment
                        )
                        order by session_set.set_number
                      )
                      from public.athlete_training_session_sets session_set
                      where session_set.item_id = session_item.id
                    ), '[]'::jsonb),
                    'media', coalesce((
                      select jsonb_agg(
                        jsonb_build_object(
                          'id', medium.id,
                          'title', medium.title,
                          'storage_path', medium.storage_path,
                          'mime_type', medium.mime_type,
                          'file_size', medium.file_size,
                          'created_at', medium.created_at
                        )
                        order by medium.created_at
                      )
                      from public.athlete_training_session_media medium
                      where medium.item_id = session_item.id
                    ), '[]'::jsonb)
                  )
                  order by session_item.sort_order
                )
                from public.athlete_training_session_items session_item
                left join public.exercises exercise
                  on exercise.id = session_item.source_exercise_id
                 and exercise.organization_id = session_item.organization_id
                where session_item.section_id = session_section.id
              ), '[]'::jsonb)
            )
            order by session_section.sort_order
          )
          from public.athlete_training_session_sections session_section
          where session_section.session_id = session.id
        ), '[]'::jsonb)
      )
      from public.athlete_training_sessions session
      where session.plan_id = plan.id
        and session.organization_id = plan.organization_id
    )
  )
  into v_result
  from public.athlete_training_plans plan
  join public.athletes athlete
    on athlete.id = plan.athlete_id
   and athlete.organization_id = plan.organization_id
  join public.training_groups training_group
    on training_group.id = plan.group_id
   and training_group.organization_id = plan.organization_id
  where plan.id = p_plan_id
    and plan.organization_id = p_organization_id;

  return v_result;
end;
$$;

revoke all on function public.training_documentation_detail(uuid, uuid) from public;
grant execute on function public.training_documentation_detail(uuid, uuid) to authenticated;


commit;
