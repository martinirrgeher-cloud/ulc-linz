-- ULC Linz App – kompakte Stammdaten und sicheres Deaktivieren direkt im Training.
-- Bestehende Stammdaten und Trainingshistorien werden nicht verändert.

create or replace function public.deactivate_training_module_athlete(
  p_organization_id uuid,
  p_module_key text,
  p_group_id uuid,
  p_athlete_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  old_data jsonb;
  athlete_exists boolean;
  active_memberships jsonb;
begin
  if p_module_key not in ('kindertraining', 'u12', 'u14') then
    raise exception 'Das Trainingsmodul ist ungültig.';
  end if;

  if current_user_id is null then
    raise exception 'Für diese Änderung ist eine Anmeldung erforderlich.';
  end if;

  if not (
    public.has_module_access(p_organization_id, p_module_key, true)
    or public.can_edit_athlete_data(p_organization_id)
  ) then
    raise exception 'Für das Inaktivsetzen fehlen die erforderlichen Bearbeitungsrechte.';
  end if;

  if not exists (
    select 1
    from public.training_groups training_group
    where training_group.id = p_group_id
      and training_group.organization_id = p_organization_id
      and training_group.module_key = p_module_key
  ) then
    raise exception 'Die Trainingsgruppe gehört nicht zum ausgewählten Trainingsmodul.';
  end if;

  select
    true,
    jsonb_build_object(
      'first_name', athlete.first_name,
      'last_name', athlete.last_name,
      'birth_year', athlete.birth_year,
      'is_active', athlete.is_active
    )
  into athlete_exists, old_data
  from public.athletes athlete
  where athlete.id = p_athlete_id
    and athlete.organization_id = p_organization_id;

  if not coalesce(athlete_exists, false) then
    raise exception 'Der Athlet wurde nicht gefunden.';
  end if;

  if not exists (
    select 1
    from public.athlete_group_memberships membership
    where membership.organization_id = p_organization_id
      and membership.athlete_id = p_athlete_id
      and membership.group_id = p_group_id
      and membership.ended_on is null
  ) then
    raise exception 'Der Athlet ist dieser Trainingsgruppe nicht mehr aktiv zugeordnet.';
  end if;

  select coalesce(jsonb_agg(membership.group_id order by membership.group_id), '[]'::jsonb)
  into active_memberships
  from public.athlete_group_memberships membership
  where membership.organization_id = p_organization_id
    and membership.athlete_id = p_athlete_id
    and membership.ended_on is null;

  update public.athletes
  set is_active = false
  where id = p_athlete_id
    and organization_id = p_organization_id;

  update public.athlete_group_memberships membership
  set ended_on = greatest(membership.started_on, current_date)
  where membership.organization_id = p_organization_id
    and membership.athlete_id = p_athlete_id
    and membership.ended_on is null;

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
    current_user_id,
    'athlete.deactivated_from_training',
    'athlete',
    p_athlete_id::text,
    old_data || jsonb_build_object('active_group_ids', active_memberships),
    jsonb_build_object(
      'is_active', false,
      'ended_active_group_memberships_on', current_date,
      'source_module', p_module_key,
      'source_group_id', p_group_id
    )
  );
end;
$$;

revoke all on function public.deactivate_training_module_athlete(uuid, text, uuid, uuid) from public;
grant execute on function public.deactivate_training_module_athlete(uuid, text, uuid, uuid) to authenticated;
