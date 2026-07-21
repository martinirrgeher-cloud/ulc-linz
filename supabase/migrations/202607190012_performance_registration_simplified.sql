-- ULC Linz App – Leistungsgruppen Phase 1.1
-- Vereinfachte Athletenanmeldung, Gruppenvertretung und kompakte Wochenübersicht.

begin;

-- Vertretung innerhalb derselben Leistungsgruppe nachvollziehbar kennzeichnen.
alter table public.performance_athlete_availability
  drop constraint if exists performance_athlete_availability_source_check;

alter table public.performance_athlete_availability
  add constraint performance_athlete_availability_source_check
  check (source in ('self', 'trainer', 'proxy', 'default', 'copy'));

create or replace function public.performance_group_week_overview(
  p_organization_id uuid,
  p_group_id uuid,
  p_week_start date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_current_role public.app_role;
  v_current_athlete_id uuid;
  v_current_trainer_id uuid;
  v_can_manage boolean;
  v_can_view_group boolean;
  v_normalized_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  v_normalized_week_end date := v_normalized_week_start + 6;
  v_target_group public.training_groups%rowtype;
  v_target_settings public.performance_group_settings%rowtype;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Leistungsgruppen fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into v_target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  select settings.*
  into v_target_settings
  from public.performance_group_settings settings
  where settings.organization_id = p_organization_id
    and settings.group_id = p_group_id;

  if v_target_group.id is null or v_target_settings.group_id is null then
    raise exception 'Die Leistungsgruppe wurde nicht gefunden oder ist nicht aktiv.';
  end if;

  v_current_role := public.current_organization_role(p_organization_id);
  v_can_manage := public.can_manage_performance_registration(p_organization_id);

  select athlete.id
  into v_current_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_current_user_id
    and athlete.is_active
  limit 1;

  select trainer.id
  into v_current_trainer_id
  from public.trainers trainer
  where trainer.organization_id = p_organization_id
    and trainer.linked_user_id = v_current_user_id
    and trainer.is_active
  limit 1;

  v_can_view_group := v_can_manage
    or exists (
      select 1
      from public.athlete_group_memberships membership
      where membership.organization_id = p_organization_id
        and membership.group_id = p_group_id
        and membership.athlete_id = v_current_athlete_id
        and membership.started_on <= v_normalized_week_end
        and (membership.ended_on is null or membership.ended_on >= v_normalized_week_start)
    )
    or exists (
      select 1
      from public.trainer_group_assignments assignment
      where assignment.organization_id = p_organization_id
        and assignment.group_id = p_group_id
        and assignment.trainer_id = v_current_trainer_id
    );

  if not v_can_view_group then
    raise exception 'Du bist dieser Leistungsgruppe nicht zugeordnet.';
  end if;

  return jsonb_build_object(
    'week_start', v_normalized_week_start,
    'week_end', v_normalized_week_end,
    'group', jsonb_build_object(
      'id', v_target_group.id,
      'name', v_target_group.name,
      'short_name', v_target_group.short_name,
      'regular_weekdays', to_jsonb(v_target_group.regular_weekdays),
      'deadline_weekday', v_target_settings.registration_deadline_weekday,
      'deadline_time', to_char(v_target_settings.registration_deadline_time, 'HH24:MI'),
      'weeks_ahead', v_target_settings.weeks_ahead,
      'allow_late_registration', v_target_settings.allow_late_registration
    ),
    'dates', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', training_date,
            'weekday', weekday,
            'deadline_at', public.performance_registration_deadline(
              p_organization_id,
              p_group_id,
              training_date
            )
          )
          order by training_date
        )
        from (
          select
            v_normalized_week_start + (weekday_value - 1) as training_date,
            weekday_value as weekday
          from unnest(v_target_group.regular_weekdays) weekday_value
        ) training_dates
      ),
      '[]'::jsonb
    ),
    'athletes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', athlete.id,
            'first_name', athlete.first_name,
            'last_name', athlete.last_name,
            'birth_year', athlete.birth_year,
            'availability', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'date', dates.training_date,
                    'status', coalesce(availability.status::text, 'open'),
                    'available_from', null,
                    'available_until', null,
                    'comment', availability.comment,
                    'source', availability.source,
                    'updated_at', availability.updated_at,
                    'is_late', availability.updated_at > public.performance_registration_deadline(
                      p_organization_id,
                      p_group_id,
                      dates.training_date
                    )
                  )
                  order by dates.training_date
                )
                from (
                  select v_normalized_week_start + (weekday_value - 1) as training_date
                  from unnest(v_target_group.regular_weekdays) weekday_value
                ) dates
                left join public.performance_athlete_availability availability
                  on availability.organization_id = p_organization_id
                 and availability.group_id = p_group_id
                 and availability.athlete_id = athlete.id
                 and availability.training_date = dates.training_date
              ),
              '[]'::jsonb
            ),
            'defaults', '[]'::jsonb
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
              and membership.group_id = p_group_id
              and membership.athlete_id = athlete.id
              and membership.started_on <= v_normalized_week_end
              and (membership.ended_on is null or membership.ended_on >= v_normalized_week_start)
          )
      ),
      '[]'::jsonb
    ),
    'trainers', '[]'::jsonb
  );
end;
$$;

create or replace function public.save_performance_athlete_availability(
  p_organization_id uuid,
  p_group_id uuid,
  p_athlete_id uuid,
  p_training_date date,
  p_status text,
  p_available_from time default null,
  p_available_until time default null,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
  v_current_athlete_id uuid;
  v_is_self boolean;
  v_is_group_peer boolean;
  v_can_manage boolean;
  v_source text;
  v_target_group public.training_groups%rowtype;
  v_settings public.performance_group_settings%rowtype;
  v_normalized_status text := lower(trim(coalesce(p_status, 'open')));
  v_normalized_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_deadline_at timestamptz;
  v_saved_row public.performance_athlete_availability%rowtype;
begin
  if v_current_user_id is null or not public.has_module_access(
    p_organization_id,
    'performance_registration',
    false
  ) then
    raise exception 'Für die Trainingsanmeldung fehlen die erforderlichen Rechte.';
  end if;

  select training_group.*
  into v_target_group
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.id = p_group_id
    and training_group.is_active;

  select performance_settings.*
  into v_settings
  from public.performance_group_settings performance_settings
  where performance_settings.organization_id = p_organization_id
    and performance_settings.group_id = p_group_id;

  if v_target_group.id is null or v_settings.group_id is null then
    raise exception 'Die Leistungsgruppe wurde nicht gefunden.';
  end if;

  if extract(isodow from p_training_date)::smallint <> all(v_target_group.regular_weekdays) then
    raise exception 'Das ausgewählte Datum ist kein regulärer Trainingstag dieser Gruppe.';
  end if;

  if not exists (
    select 1
    from public.athletes athlete
    join public.athlete_group_memberships membership
      on membership.organization_id = athlete.organization_id
     and membership.athlete_id = athlete.id
    where athlete.organization_id = p_organization_id
      and athlete.id = p_athlete_id
      and athlete.is_active
      and membership.group_id = p_group_id
      and membership.started_on <= p_training_date
      and (membership.ended_on is null or membership.ended_on >= p_training_date)
  ) then
    raise exception 'Der Athlet ist diesem Trainingstag nicht zugeordnet.';
  end if;

  select athlete.id
  into v_current_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_current_user_id
    and athlete.is_active
  limit 1;

  v_is_self := v_current_athlete_id = p_athlete_id;
  v_can_manage := public.can_manage_performance_registration(p_organization_id);
  v_is_group_peer := v_current_athlete_id is not null and exists (
    select 1
    from public.athlete_group_memberships membership
    where membership.organization_id = p_organization_id
      and membership.group_id = p_group_id
      and membership.athlete_id = v_current_athlete_id
      and membership.started_on <= p_training_date
      and (membership.ended_on is null or membership.ended_on >= p_training_date)
  );

  if not v_is_self and not v_can_manage and not v_is_group_peer then
    raise exception 'Diese Trainingsanmeldung darf nicht bearbeitet werden.';
  end if;

  v_deadline_at := public.performance_registration_deadline(
    p_organization_id,
    p_group_id,
    p_training_date
  );

  if not v_can_manage
     and not v_settings.allow_late_registration
     and now() > v_deadline_at then
    raise exception 'Der Anmeldeschluss für diese Trainingswoche ist bereits vorbei.';
  end if;

  v_source := case
    when v_is_self then 'self'
    when v_can_manage then 'trainer'
    else 'proxy'
  end;

  if v_normalized_status = 'open' then
    delete from public.performance_athlete_availability
    where organization_id = p_organization_id
      and group_id = p_group_id
      and athlete_id = p_athlete_id
      and training_date = p_training_date;

    return jsonb_build_object(
      'date', p_training_date,
      'status', 'open',
      'available_from', null,
      'available_until', null,
      'comment', null,
      'source', v_source,
      'updated_at', now(),
      'is_late', now() > v_deadline_at
    );
  end if;

  if v_normalized_status not in ('coming', 'maybe', 'unavailable') then
    raise exception 'Der ausgewählte Anmeldestatus ist ungültig.';
  end if;

  insert into public.performance_athlete_availability (
    organization_id,
    group_id,
    athlete_id,
    training_date,
    status,
    available_from,
    available_until,
    comment,
    source,
    updated_by
  ) values (
    p_organization_id,
    p_group_id,
    p_athlete_id,
    p_training_date,
    v_normalized_status::public.performance_availability_status,
    null,
    null,
    v_normalized_comment,
    v_source,
    v_current_user_id
  )
  on conflict (group_id, athlete_id, training_date) do update set
    status = excluded.status,
    available_from = null,
    available_until = null,
    comment = excluded.comment,
    source = excluded.source,
    updated_by = excluded.updated_by
  returning * into v_saved_row;

  return jsonb_build_object(
    'date', v_saved_row.training_date,
    'status', v_saved_row.status,
    'available_from', null,
    'available_until', null,
    'comment', v_saved_row.comment,
    'source', v_saved_row.source,
    'updated_at', v_saved_row.updated_at,
    'is_late', v_saved_row.updated_at > v_deadline_at
  );
end;
$$;

revoke all on function public.performance_group_week_overview(uuid, uuid, date) from public;
revoke all on function public.save_performance_athlete_availability(uuid, uuid, uuid, date, text, time, time, text) from public;

grant execute on function public.performance_group_week_overview(uuid, uuid, date) to authenticated;
grant execute on function public.save_performance_athlete_availability(uuid, uuid, uuid, date, text, time, time, text) to authenticated;

commit;
