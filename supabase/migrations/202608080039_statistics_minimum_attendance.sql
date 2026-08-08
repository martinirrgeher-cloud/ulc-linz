-- Ergänzt den periodischen Minimalwert der anwesenden Kinder in den Statistik-RPCs.

create or replace function public.kindertraining_statistics_overview(
  p_organization_id uuid,
  p_from_date date default null,
  p_to_date date default null,
  p_session_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  default_from_date date;
  effective_from_date date;
  effective_to_date date := coalesce(p_to_date, current_date);
  effective_limit integer := greatest(1, least(coalesce(p_session_limit, 10), 500));
  target_group_id uuid;
  sessions_data jsonb;
  athletes_data jsonb;
  trainers_data jsonb;
  monthly_data jsonb;
  summary_data jsonb;
begin
  if not public.can_read_kindertraining_statistics(p_organization_id) then
    raise exception 'Für die Kindertraining-Statistik fehlen die erforderlichen Rechte.';
  end if;

  select coalesce(
    settings.kindertraining_default_from,
    date_trunc('year', current_date)::date
  )
  into default_from_date
  from (select 1) seed
  left join public.organization_statistics_settings settings
    on settings.organization_id = p_organization_id;

  effective_from_date := coalesce(p_from_date, default_from_date);

  if effective_from_date > effective_to_date then
    raise exception 'Das Von-Datum darf nicht nach dem Bis-Datum liegen.';
  end if;

  select training_group.id
  into target_group_id
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.module_key = 'kindertraining';

  if target_group_id is null then
    return jsonb_build_object(
      'default_from_date', default_from_date,
      'from_date', effective_from_date,
      'to_date', effective_to_date,
      'summary', jsonb_build_object(),
      'sessions', '[]'::jsonb,
      'athletes', '[]'::jsonb,
      'trainers', '[]'::jsonb,
      'monthly', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(row_data order by session_date desc), '[]'::jsonb)
  into sessions_data
  from (
    select
      training_session.session_date,
      jsonb_build_object(
        'id', training_session.id,
        'session_date', training_session.session_date,
        'state', training_session.state,
        'is_special', training_session.is_special,
        'environment', training_session.environment,
        'note', coalesce(training_session.note, ''),
        'present_count', count(attendance.id) filter (where attendance.status = 'present'),
        'participant_count', count(attendance.id),
        'present_athletes', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', athlete.id,
              'name', concat_ws(' ', athlete.first_name, athlete.last_name)
            )
            order by lower(athlete.first_name), lower(athlete.last_name)
          ) filter (where attendance.status = 'present'),
          '[]'::jsonb
        ),
        'trainers', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', trainer.id,
                'name', concat_ws(' ', trainer.first_name, trainer.last_name)
              )
              order by lower(trainer.last_name), lower(trainer.first_name)
            )
            from public.training_session_trainers session_trainer
            join public.trainers trainer
              on trainer.id = session_trainer.trainer_id
             and trainer.organization_id = session_trainer.organization_id
            where session_trainer.organization_id = p_organization_id
              and session_trainer.session_id = training_session.id
          ),
          '[]'::jsonb
        )
      ) as row_data
    from public.training_sessions training_session
    left join public.training_attendance attendance
      on attendance.organization_id = training_session.organization_id
     and attendance.session_id = training_session.id
    left join public.athletes athlete
      on athlete.id = attendance.athlete_id
     and athlete.organization_id = attendance.organization_id
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group_id
      and training_session.deleted_at is null
      and training_session.session_date between effective_from_date and effective_to_date
    group by training_session.id
    order by training_session.session_date desc
    limit effective_limit
  ) session_rows;

  select coalesce(jsonb_agg(row_data order by present_count desc, last_name, first_name), '[]'::jsonb)
  into athletes_data
  from (
    select
      athlete.first_name,
      athlete.last_name,
      jsonb_build_object(
        'id', athlete.id,
        'first_name', athlete.first_name,
        'last_name', athlete.last_name,
        'birth_year', athlete.birth_year,
        'is_active', athlete.is_active,
        'possible_count', count(attendance.id) filter (where training_session.state = 'scheduled'),
        'present_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'present'
        ),
        'excused_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'excused'
        ),
        'absent_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'absent'
        ),
        'open_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'open'
        ),
        'attendance_rate', case
          when count(attendance.id) filter (where training_session.state = 'scheduled') = 0 then 0
          else round(
            100.0 * count(attendance.id) filter (
              where training_session.state = 'scheduled' and attendance.status = 'present'
            ) / count(attendance.id) filter (where training_session.state = 'scheduled'),
            1
          )
        end
      ) as row_data,
      count(attendance.id) filter (
        where training_session.state = 'scheduled' and attendance.status = 'present'
      ) as present_count
    from public.athletes athlete
    left join public.training_attendance attendance
      on attendance.organization_id = athlete.organization_id
     and attendance.athlete_id = athlete.id
    left join public.training_sessions training_session
      on training_session.id = attendance.session_id
     and training_session.organization_id = attendance.organization_id
     and training_session.group_id = target_group_id
     and training_session.deleted_at is null
     and training_session.session_date between effective_from_date and effective_to_date
    where athlete.organization_id = p_organization_id
      and (
        exists (
          select 1
          from public.athlete_group_memberships membership
          where membership.organization_id = p_organization_id
            and membership.group_id = target_group_id
            and membership.athlete_id = athlete.id
        )
        or training_session.id is not null
      )
    group by athlete.id
  ) athlete_rows;

  select coalesce(jsonb_agg(row_data order by session_count desc, last_name, first_name), '[]'::jsonb)
  into trainers_data
  from (
    select
      trainer.first_name,
      trainer.last_name,
      count(distinct training_session.id) as session_count,
      jsonb_build_object(
        'id', trainer.id,
        'first_name', trainer.first_name,
        'last_name', trainer.last_name,
        'is_active', trainer.is_active,
        'session_count', count(distinct training_session.id)
      ) as row_data
    from public.trainers trainer
    left join public.training_session_trainers session_trainer
      on session_trainer.organization_id = trainer.organization_id
     and session_trainer.trainer_id = trainer.id
    left join public.training_sessions training_session
      on training_session.id = session_trainer.session_id
     and training_session.organization_id = session_trainer.organization_id
     and training_session.group_id = target_group_id
     and training_session.deleted_at is null
     and training_session.state = 'scheduled'
     and training_session.session_date between effective_from_date and effective_to_date
    where trainer.organization_id = p_organization_id
    group by trainer.id
    having trainer.is_active or count(training_session.id) > 0
  ) trainer_rows;

  select coalesce(jsonb_agg(row_data order by month_start), '[]'::jsonb)
  into monthly_data
  from (
    select
      date_trunc('month', training_session.session_date)::date as month_start,
      jsonb_build_object(
        'month', to_char(date_trunc('month', training_session.session_date), 'YYYY-MM'),
        'session_count', count(distinct training_session.id),
        'average_present', round(
          avg(
            (
              select count(*)
              from public.training_attendance attendance
              where attendance.organization_id = p_organization_id
                and attendance.session_id = training_session.id
                and attendance.status = 'present'
            )
          ),
          1
        )
      ) as row_data
    from public.training_sessions training_session
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group_id
      and training_session.deleted_at is null
      and training_session.state = 'scheduled'
      and training_session.session_date between effective_from_date and effective_to_date
    group by date_trunc('month', training_session.session_date)
  ) monthly_rows;

  select jsonb_build_object(
    'session_count', count(*),
    'cancelled_count', count(*) filter (where training_session.state = 'cancelled'),
    'average_present', coalesce(round(avg(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 1), 0),
    'max_present', coalesce(max(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 0),
    'min_present', coalesce(min(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 0),
    'unique_present', (
      select count(distinct attendance.athlete_id)
      from public.training_attendance attendance
      join public.training_sessions session_for_attendance
        on session_for_attendance.id = attendance.session_id
       and session_for_attendance.organization_id = attendance.organization_id
      where attendance.organization_id = p_organization_id
        and session_for_attendance.group_id = target_group_id
        and session_for_attendance.deleted_at is null
        and session_for_attendance.state = 'scheduled'
        and session_for_attendance.session_date between effective_from_date and effective_to_date
        and attendance.status = 'present'
    )
  )
  into summary_data
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = target_group_id
    and training_session.deleted_at is null
    and training_session.session_date between effective_from_date and effective_to_date;

  return jsonb_build_object(
    'default_from_date', default_from_date,
    'from_date', effective_from_date,
    'to_date', effective_to_date,
    'summary', summary_data,
    'sessions', sessions_data,
    'athletes', athletes_data,
    'trainers', trainers_data,
    'monthly', monthly_data
  );
end;
$$;

create or replace function public.training_module_statistics_overview(
  p_organization_id uuid,
  p_module_key text,
  p_from_date date default null,
  p_to_date date default null,
  p_session_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  default_from_date date;
  effective_from_date date;
  effective_to_date date := coalesce(p_to_date, current_date);
  effective_limit integer := greatest(1, least(coalesce(p_session_limit, 10), 500));
  target_group_id uuid;
  sessions_data jsonb;
  athletes_data jsonb;
  trainers_data jsonb;
  monthly_data jsonb;
  summary_data jsonb;
begin
  if not public.can_read_training_module_statistics(p_organization_id, p_module_key) then
    raise exception 'Für die Trainingsstatistik fehlen die erforderlichen Rechte.';
  end if;

  select coalesce(
    settings.default_from,
    date_trunc('year', current_date)::date
  )
  into default_from_date
  from (select 1) seed
  left join public.training_module_statistics_settings settings
    on settings.organization_id = p_organization_id
   and settings.module_key = p_module_key;

  effective_from_date := coalesce(p_from_date, default_from_date);

  if effective_from_date > effective_to_date then
    raise exception 'Das Von-Datum darf nicht nach dem Bis-Datum liegen.';
  end if;

  select training_group.id
  into target_group_id
  from public.training_groups training_group
  where training_group.organization_id = p_organization_id
    and training_group.module_key = p_module_key;

  if target_group_id is null then
    return jsonb_build_object(
      'default_from_date', default_from_date,
      'from_date', effective_from_date,
      'to_date', effective_to_date,
      'summary', jsonb_build_object(),
      'sessions', '[]'::jsonb,
      'athletes', '[]'::jsonb,
      'trainers', '[]'::jsonb,
      'monthly', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(row_data order by session_date desc), '[]'::jsonb)
  into sessions_data
  from (
    select
      training_session.session_date,
      jsonb_build_object(
        'id', training_session.id,
        'session_date', training_session.session_date,
        'state', training_session.state,
        'is_special', training_session.is_special,
        'environment', training_session.environment,
        'note', coalesce(training_session.note, ''),
        'present_count', count(attendance.id) filter (where attendance.status = 'present'),
        'participant_count', count(attendance.id),
        'present_athletes', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', athlete.id,
              'name', concat_ws(' ', athlete.first_name, athlete.last_name)
            )
            order by lower(athlete.first_name), lower(athlete.last_name)
          ) filter (where attendance.status = 'present'),
          '[]'::jsonb
        ),
        'trainers', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', trainer.id,
                'name', concat_ws(' ', trainer.first_name, trainer.last_name)
              )
              order by lower(trainer.last_name), lower(trainer.first_name)
            )
            from public.training_session_trainers session_trainer
            join public.trainers trainer
              on trainer.id = session_trainer.trainer_id
             and trainer.organization_id = session_trainer.organization_id
            where session_trainer.organization_id = p_organization_id
              and session_trainer.session_id = training_session.id
          ),
          '[]'::jsonb
        )
      ) as row_data
    from public.training_sessions training_session
    left join public.training_attendance attendance
      on attendance.organization_id = training_session.organization_id
     and attendance.session_id = training_session.id
    left join public.athletes athlete
      on athlete.id = attendance.athlete_id
     and athlete.organization_id = attendance.organization_id
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group_id
      and training_session.deleted_at is null
      and training_session.session_date between effective_from_date and effective_to_date
    group by training_session.id
    order by training_session.session_date desc
    limit effective_limit
  ) session_rows;

  select coalesce(jsonb_agg(row_data order by present_count desc, last_name, first_name), '[]'::jsonb)
  into athletes_data
  from (
    select
      athlete.first_name,
      athlete.last_name,
      jsonb_build_object(
        'id', athlete.id,
        'first_name', athlete.first_name,
        'last_name', athlete.last_name,
        'birth_year', athlete.birth_year,
        'is_active', athlete.is_active,
        'possible_count', count(attendance.id) filter (where training_session.state = 'scheduled'),
        'present_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'present'
        ),
        'excused_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'excused'
        ),
        'absent_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'absent'
        ),
        'open_count', count(attendance.id) filter (
          where training_session.state = 'scheduled' and attendance.status = 'open'
        ),
        'attendance_rate', case
          when count(attendance.id) filter (where training_session.state = 'scheduled') = 0 then 0
          else round(
            100.0 * count(attendance.id) filter (
              where training_session.state = 'scheduled' and attendance.status = 'present'
            ) / count(attendance.id) filter (where training_session.state = 'scheduled'),
            1
          )
        end
      ) as row_data,
      count(attendance.id) filter (
        where training_session.state = 'scheduled' and attendance.status = 'present'
      ) as present_count
    from public.athletes athlete
    left join public.training_attendance attendance
      on attendance.organization_id = athlete.organization_id
     and attendance.athlete_id = athlete.id
    left join public.training_sessions training_session
      on training_session.id = attendance.session_id
     and training_session.organization_id = attendance.organization_id
     and training_session.group_id = target_group_id
     and training_session.deleted_at is null
     and training_session.session_date between effective_from_date and effective_to_date
    where athlete.organization_id = p_organization_id
      and (
        exists (
          select 1
          from public.athlete_group_memberships membership
          where membership.organization_id = p_organization_id
            and membership.group_id = target_group_id
            and membership.athlete_id = athlete.id
        )
        or training_session.id is not null
      )
    group by athlete.id
  ) athlete_rows;

  select coalesce(jsonb_agg(row_data order by session_count desc, last_name, first_name), '[]'::jsonb)
  into trainers_data
  from (
    select
      trainer.first_name,
      trainer.last_name,
      count(distinct training_session.id) as session_count,
      jsonb_build_object(
        'id', trainer.id,
        'first_name', trainer.first_name,
        'last_name', trainer.last_name,
        'is_active', trainer.is_active,
        'session_count', count(distinct training_session.id)
      ) as row_data
    from public.trainers trainer
    left join public.training_session_trainers session_trainer
      on session_trainer.organization_id = trainer.organization_id
     and session_trainer.trainer_id = trainer.id
    left join public.training_sessions training_session
      on training_session.id = session_trainer.session_id
     and training_session.organization_id = session_trainer.organization_id
     and training_session.group_id = target_group_id
     and training_session.deleted_at is null
     and training_session.state = 'scheduled'
     and training_session.session_date between effective_from_date and effective_to_date
    where trainer.organization_id = p_organization_id
    group by trainer.id
    having trainer.is_active or count(training_session.id) > 0
  ) trainer_rows;

  select coalesce(jsonb_agg(row_data order by month_start), '[]'::jsonb)
  into monthly_data
  from (
    select
      date_trunc('month', training_session.session_date)::date as month_start,
      jsonb_build_object(
        'month', to_char(date_trunc('month', training_session.session_date), 'YYYY-MM'),
        'session_count', count(distinct training_session.id),
        'average_present', round(
          avg(
            (
              select count(*)
              from public.training_attendance attendance
              where attendance.organization_id = p_organization_id
                and attendance.session_id = training_session.id
                and attendance.status = 'present'
            )
          ),
          1
        )
      ) as row_data
    from public.training_sessions training_session
    where training_session.organization_id = p_organization_id
      and training_session.group_id = target_group_id
      and training_session.deleted_at is null
      and training_session.state = 'scheduled'
      and training_session.session_date between effective_from_date and effective_to_date
    group by date_trunc('month', training_session.session_date)
  ) monthly_rows;

  select jsonb_build_object(
    'session_count', count(*),
    'cancelled_count', count(*) filter (where training_session.state = 'cancelled'),
    'average_present', coalesce(round(avg(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 1), 0),
    'max_present', coalesce(max(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 0),
    'min_present', coalesce(min(
      (
        select count(*)
        from public.training_attendance attendance
        where attendance.organization_id = p_organization_id
          and attendance.session_id = training_session.id
          and attendance.status = 'present'
      )
    ) filter (where training_session.state = 'scheduled'), 0),
    'unique_present', (
      select count(distinct attendance.athlete_id)
      from public.training_attendance attendance
      join public.training_sessions session_for_attendance
        on session_for_attendance.id = attendance.session_id
       and session_for_attendance.organization_id = attendance.organization_id
      where attendance.organization_id = p_organization_id
        and session_for_attendance.group_id = target_group_id
        and session_for_attendance.deleted_at is null
        and session_for_attendance.state = 'scheduled'
        and session_for_attendance.session_date between effective_from_date and effective_to_date
        and attendance.status = 'present'
    )
  )
  into summary_data
  from public.training_sessions training_session
  where training_session.organization_id = p_organization_id
    and training_session.group_id = target_group_id
    and training_session.deleted_at is null
    and training_session.session_date between effective_from_date and effective_to_date;

  return jsonb_build_object(
    'default_from_date', default_from_date,
    'from_date', effective_from_date,
    'to_date', effective_to_date,
    'summary', summary_data,
    'sessions', sessions_data,
    'athletes', athletes_data,
    'trainers', trainers_data,
    'monthly', monthly_data
  );
end;
$$;
