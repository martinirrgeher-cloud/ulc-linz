-- D2: Verlustsicheres Autosave der Trainingsdokumentation
-- Neue versionierte Speicher-RPC. Die bisherige Funktion bleibt für den sicheren Rollout vorerst bestehen.

create or replace function public.save_training_documentation_v2(
  p_organization_id uuid,
  p_session_id uuid,
  p_status text,
  p_actual_minutes integer,
  p_overall_rpe integer,
  p_overall_rating integer,
  p_overall_comment text,
  p_pain_level text,
  p_pain_comment text,
  p_trainer_feedback text,
  p_items jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role public.app_role;
  v_session public.athlete_training_sessions%rowtype;
  v_own_athlete_id uuid;
  v_can_review boolean := false;
  v_item jsonb;
  v_item_id uuid;
  v_item_status text;
  v_actual_values jsonb;
  v_set jsonb;
  v_set_number integer;
  v_set_status text;
  v_was_terminal boolean;
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
     or not public.has_module_access(p_organization_id, 'training_documentation', true) then
    raise exception 'Du darfst diese Trainingsdokumentation nicht bearbeiten.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('training_documentation:' || p_session_id::text, 0)
  );

  select session.*
  into v_session
  from public.athlete_training_sessions session
  where session.id = p_session_id
    and session.organization_id = p_organization_id
  for update;

  if v_session.id is null then
    raise exception 'Die Trainingsdokumentation wurde nicht gefunden.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Die erwartete Serverversion der Trainingsdokumentation fehlt.';
  end if;

  if abs(extract(epoch from (v_session.updated_at - p_expected_updated_at))) > 0.001 then
    raise exception using
      errcode = '40001',
      message = 'TRAINING_DOCUMENTATION_VERSION_CONFLICT: Die Trainingsdokumentation wurde zwischenzeitlich geändert.';
  end if;

  select athlete.id
  into v_own_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_user_id
    and athlete.is_active
  limit 1;

  if v_role not in ('admin', 'trainer') and v_session.athlete_id is distinct from v_own_athlete_id then
    raise exception 'Du darfst nur dein eigenes Training dokumentieren.';
  end if;

  v_can_review := v_role in ('admin', 'trainer');
  v_was_terminal := v_session.status in ('completed', 'partial', 'aborted');

  if p_status not in ('in_progress', 'completed', 'partial', 'aborted') then
    raise exception 'Der Trainingsstatus ist ungültig.';
  end if;
  if p_actual_minutes is not null and (p_actual_minutes < 0 or p_actual_minutes > 1440) then
    raise exception 'Die tatsächliche Trainingsdauer ist ungültig.';
  end if;
  if p_overall_rpe is not null and (p_overall_rpe < 1 or p_overall_rpe > 10) then
    raise exception 'Die Gesamtbelastung muss zwischen 1 und 10 liegen.';
  end if;
  if p_overall_rating is not null and (p_overall_rating < 1 or p_overall_rating > 5) then
    raise exception 'Die Gesamtbewertung muss zwischen 1 und 5 liegen.';
  end if;
  if coalesce(p_pain_level, 'none') not in ('none', 'mild', 'strong') then
    raise exception 'Die Angabe zu Beschwerden ist ungültig.';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Die Übungsdokumentation besitzt ein ungültiges Format.';
  end if;

  update public.athlete_training_sessions
  set
    status = p_status,
    actual_minutes = p_actual_minutes,
    overall_rpe = p_overall_rpe,
    overall_rating = p_overall_rating,
    overall_comment = nullif(trim(coalesce(p_overall_comment, '')), ''),
    pain_level = coalesce(p_pain_level, 'none'),
    pain_comment = nullif(trim(coalesce(p_pain_comment, '')), ''),
    trainer_feedback = case
      when v_can_review then nullif(trim(coalesce(p_trainer_feedback, '')), '')
      else trainer_feedback
    end,
    trainer_reviewed_at = case
      when v_can_review and nullif(trim(coalesce(p_trainer_feedback, '')), '') is distinct from trainer_feedback then now()
      else trainer_reviewed_at
    end,
    trainer_reviewed_by = case
      when v_can_review and nullif(trim(coalesce(p_trainer_feedback, '')), '') is distinct from trainer_feedback then v_user_id
      else trainer_reviewed_by
    end,
    completed_at = case
      when p_status in ('completed', 'partial', 'aborted') then coalesce(completed_at, now())
      else null
    end,
    edited_after_completion = edited_after_completion or v_was_terminal,
    last_saved_by = v_user_id
  where id = p_session_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    begin
      v_item_id := (v_item->>'id')::uuid;
    exception when others then
      raise exception 'Eine Übungs-ID ist ungültig.';
    end;

    if not exists (
      select 1
      from public.athlete_training_session_items item
      where item.id = v_item_id
        and item.session_id = p_session_id
        and item.organization_id = p_organization_id
    ) then
      raise exception 'Eine Übung gehört nicht zu dieser Trainingsdokumentation.';
    end if;

    v_item_status := coalesce(v_item->>'status', 'planned');
    if v_item_status not in ('planned', 'as_planned', 'changed', 'partial', 'skipped', 'aborted') then
      raise exception 'Ein Übungsstatus ist ungültig.';
    end if;

    v_actual_values := coalesce(v_item->'actual_values', '{}'::jsonb);
    if jsonb_typeof(v_actual_values) <> 'object' then
      raise exception 'Die Istwerte einer Übung besitzen ein ungültiges Format.';
    end if;
    if jsonb_typeof(coalesce(v_item->'sets', '[]'::jsonb)) <> 'array' then
      raise exception 'Die Satzdokumentation besitzt ein ungültiges Format.';
    end if;
    if nullif(v_item->>'rating', '') is not null
       and ((v_item->>'rating')::integer < 1 or (v_item->>'rating')::integer > 5) then
      raise exception 'Die Bewertung einer Übung muss zwischen 1 und 5 liegen.';
    end if;
    if nullif(v_item->>'rpe', '') is not null
       and ((v_item->>'rpe')::integer < 1 or (v_item->>'rpe')::integer > 10) then
      raise exception 'Die Belastung einer Übung muss zwischen 1 und 10 liegen.';
    end if;
    if coalesce(nullif(v_item->>'pain_level', ''), 'none') not in ('none', 'mild', 'strong') then
      raise exception 'Die Angabe zu Beschwerden einer Übung ist ungültig.';
    end if;

    update public.athlete_training_session_items item
    set
      status = v_item_status,
      actual_values = v_actual_values,
      rating = case
        when nullif(v_item->>'rating', '') is null then null
        else (v_item->>'rating')::integer
      end,
      rpe = case
        when nullif(v_item->>'rpe', '') is null then null
        else (v_item->>'rpe')::integer
      end,
      comment = nullif(trim(coalesce(v_item->>'comment', '')), ''),
      pain_level = coalesce(nullif(v_item->>'pain_level', ''), 'none'),
      pain_comment = nullif(trim(coalesce(v_item->>'pain_comment', '')), ''),
      trainer_comment = case
        when v_can_review then nullif(trim(coalesce(v_item->>'trainer_comment', '')), '')
        else item.trainer_comment
      end
    where item.id = v_item_id;


    delete from public.athlete_training_session_sets session_set
    where session_set.item_id = v_item_id;

    v_set_number := 0;
    for v_set in select value from jsonb_array_elements(coalesce(v_item->'sets', '[]'::jsonb))
    loop
      v_set_number := v_set_number + 1;
      v_set_status := coalesce(v_set->>'status', 'as_planned');
      if v_set_status not in ('as_planned', 'changed', 'partial', 'skipped', 'aborted') then
        raise exception 'Ein Satzstatus ist ungültig.';
      end if;
      if jsonb_typeof(coalesce(v_set->'planned_values', '{}'::jsonb)) <> 'object'
         or jsonb_typeof(coalesce(v_set->'actual_values', '{}'::jsonb)) <> 'object' then
        raise exception 'Die Satzwerte besitzen ein ungültiges Format.';
      end if;

      insert into public.athlete_training_session_sets (
        organization_id,
        session_id,
        item_id,
        set_number,
        planned_values,
        actual_values,
        status,
        comment
      ) values (
        p_organization_id,
        p_session_id,
        v_item_id,
        v_set_number,
        coalesce(v_set->'planned_values', '{}'::jsonb),
        coalesce(v_set->'actual_values', '{}'::jsonb),
        v_set_status,
        nullif(trim(coalesce(v_set->>'comment', '')), '')
      );
    end loop;
  end loop;

  if not v_was_terminal and p_status in ('completed', 'partial', 'aborted') then
    insert into public.audit_log (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      after_data
    ) values (
      p_organization_id,
      v_user_id,
      'training_documentation.completed',
      'athlete_training_session',
      p_session_id::text,
      jsonb_build_object('status', p_status, 'actual_minutes', p_actual_minutes)
    );
  end if;

  select jsonb_build_object(
    'status', session.status,
    'completed_at', session.completed_at,
    'updated_at', session.updated_at
  )
  into v_result
  from public.athlete_training_sessions session
  where session.id = p_session_id;

  return v_result;
end;
$$;

revoke all on function public.save_training_documentation_v2(
  uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb, timestamptz
) from public;

grant execute on function public.save_training_documentation_v2(
  uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb, timestamptz
) to authenticated;
