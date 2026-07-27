-- ULC Linz App v15
-- Wochenübersicht für Trainingsanmeldung und Athletenpläne.

begin;

update public.app_modules
set
  title = 'Trainingsplan-Übersicht',
  description = 'Anmeldestatus, Pläne und Dauer wochenweise',
  route = '/module/training_overview',
  icon = 'list-checks',
  is_active = true
where key = 'training_overview';

create or replace function public.training_plan_week_overview(
  p_organization_id uuid,
  p_week_start date,
  p_group_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  v_week_end date := v_week_start + 6;
  v_group_id uuid;
  v_group public.training_groups%rowtype;
begin
  if (select auth.uid()) is null or not (
    public.has_module_access(p_organization_id, 'training_overview', false)
    or public.has_module_access(p_organization_id, 'training_planning', false)
  ) then
    raise exception 'Für die Trainingsplan-Übersicht fehlen die erforderlichen Rechte.';
  end if;

  if p_group_id is not null then
    select training_group.id
    into v_group_id
    from public.training_groups training_group
    join public.performance_group_settings settings
      on settings.organization_id = training_group.organization_id
     and settings.group_id = training_group.id
    where training_group.organization_id = p_organization_id
      and training_group.id = p_group_id
      and training_group.is_active;

    if v_group_id is null then
      raise exception 'Die ausgewählte Leistungsgruppe wurde nicht gefunden.';
    end if;
  else
    select training_group.id
    into v_group_id
    from public.training_groups training_group
    join public.performance_group_settings settings
      on settings.organization_id = training_group.organization_id
     and settings.group_id = training_group.id
    where training_group.organization_id = p_organization_id
      and training_group.is_active
    order by training_group.sort_order, lower(training_group.name)
    limit 1;
  end if;

  if v_group_id is null then
    return jsonb_build_object(
      'week_start', v_week_start,
      'week_end', v_week_end,
      'selected_group_id', null,
      'groups', '[]'::jsonb,
      'dates', '[]'::jsonb,
      'athletes', '[]'::jsonb,
      'plans', '[]'::jsonb
    );
  end if;

  select training_group.*
  into v_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = v_group_id;

  return jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'selected_group_id', v_group_id,
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', training_group.id,
          'name', training_group.name,
          'short_name', training_group.short_name,
          'regular_weekdays', to_jsonb(training_group.regular_weekdays)
        )
        order by training_group.sort_order, lower(training_group.name)
      )
      from public.training_groups training_group
      join public.performance_group_settings settings
        on settings.organization_id = training_group.organization_id
       and settings.group_id = training_group.id
      where training_group.organization_id = p_organization_id
        and training_group.is_active
    ), '[]'::jsonb),
    'dates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', v_week_start + (weekday_value::integer - 1),
          'weekday', weekday_value
        )
        order by weekday_value
      )
      from unnest(v_group.regular_weekdays) weekday_value
    ), '[]'::jsonb),
    'athletes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', athlete.id,
          'first_name', athlete.first_name,
          'last_name', athlete.last_name,
          'registrations', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'date', training_date.training_date,
                'status', coalesce(availability.status::text, 'open'),
                'comment', availability.comment,
                'is_late', availability.updated_at is not null
                  and availability.updated_at > public.performance_registration_deadline(
                    p_organization_id,
                    v_group_id,
                    training_date.training_date
                  )
              )
              order by training_date.training_date
            )
            from (
              select v_week_start + (weekday_value::integer - 1) as training_date
              from unnest(v_group.regular_weekdays) weekday_value
            ) training_date
            left join public.performance_athlete_availability availability
              on availability.organization_id = p_organization_id
             and availability.group_id = v_group_id
             and availability.athlete_id = athlete.id
             and availability.training_date = training_date.training_date
          ), '[]'::jsonb)
        )
        order by lower(athlete.last_name), lower(athlete.first_name)
      )
      from public.athletes athlete
      where athlete.organization_id = p_organization_id
        and athlete.is_active
        and exists (
          select 1
          from public.athlete_group_memberships membership
          where membership.organization_id = p_organization_id
            and membership.group_id = v_group_id
            and membership.athlete_id = athlete.id
            and membership.started_on <= v_week_end
            and (membership.ended_on is null or membership.ended_on >= v_week_start)
        )
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', plan.id,
          'athlete_id', plan.athlete_id,
          'training_date', plan.training_date,
          'title', plan.title,
          'status', plan.status,
          'exercise_count', (
            select count(*)
            from public.athlete_training_plan_items item
            where item.plan_id = plan.id
          ),
          'total_minutes', (
            select coalesce(sum(section.estimated_minutes), 0)
            from public.athlete_training_plan_sections section
            where section.plan_id = plan.id
          )
        )
        order by plan.training_date, plan.athlete_id
      )
      from public.athlete_training_plans plan
      where plan.organization_id = p_organization_id
        and plan.group_id = v_group_id
        and plan.training_date between v_week_start and v_week_end
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.training_plan_week_overview(uuid, date, uuid) from public;
grant execute on function public.training_plan_week_overview(uuid, date, uuid) to authenticated;

commit;
