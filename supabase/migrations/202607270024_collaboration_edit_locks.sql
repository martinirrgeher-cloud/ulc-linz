-- ULC Linz App – Zusammenarbeit und Bearbeitungsschutz
-- Temporäre Bearbeitungssperren mit Ablaufzeit und Versionsprüfung.

create table if not exists public.edit_locks (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('exercise', 'training_block', 'athlete', 'training_plan')),
  entity_id uuid not null,
  lock_token uuid not null,
  locked_by_user_id uuid not null references auth.users(id) on delete cascade,
  locked_by_membership_id uuid not null references public.organization_members(id) on delete cascade,
  locked_by_name text not null,
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (organization_id, entity_type, entity_id)
);

create index if not exists edit_locks_expiry_idx
  on public.edit_locks (expires_at);

alter table public.edit_locks enable row level security;
revoke all on table public.edit_locks from public, anon, authenticated;

create or replace function public.edit_lock_module_key(p_entity_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_entity_type
    when 'exercise' then 'exercise_catalog'
    when 'training_block' then 'training_blocks'
    when 'athlete' then 'athletes'
    when 'training_plan' then 'training_planning'
    else null
  end;
$$;

create or replace function public.edit_lock_record_version(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  case p_entity_type
    when 'exercise' then
      select item.updated_at into v_updated_at
      from public.exercises item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'training_block' then
      select item.updated_at into v_updated_at
      from public.training_blocks item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'athlete' then
      select item.updated_at into v_updated_at
      from public.athletes item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    when 'training_plan' then
      select item.updated_at into v_updated_at
      from public.athlete_training_plans item
      where item.organization_id = p_organization_id and item.id = p_entity_id;
    else
      raise exception 'Dieser Datensatztyp unterstützt keine Bearbeitungssperre.';
  end case;

  if v_updated_at is null then
    raise exception 'Der Datensatz wurde nicht gefunden oder bereits gelöscht.';
  end if;

  return v_updated_at;
end;
$$;

create or replace function public.acquire_edit_lock(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_lock_token uuid,
  p_force boolean default false,
  p_ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_membership public.organization_members%rowtype;
  v_existing public.edit_locks%rowtype;
  v_display_name text;
  v_module_key text;
  v_ttl integer := greatest(60, least(coalesce(p_ttl_seconds, 120), 300));
  v_version timestamptz;
begin
  if v_user_id is null then
    raise exception 'Für die Bearbeitung ist eine Anmeldung erforderlich.';
  end if;

  v_module_key := public.edit_lock_module_key(p_entity_type);
  if v_module_key is null then
    raise exception 'Dieser Datensatztyp unterstützt keine Bearbeitungssperre.';
  end if;

  if not public.has_module_access(p_organization_id, v_module_key, true) then
    raise exception 'Du besitzt für diesen Bereich kein Bearbeitungsrecht.';
  end if;

  select membership.* into v_membership
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = v_user_id
    and membership.status = 'active'
  limit 1;

  if v_membership.id is null then
    raise exception 'Keine aktive Vereinszuordnung gefunden.';
  end if;

  v_version := public.edit_lock_record_version(p_organization_id, p_entity_type, p_entity_id);

  select coalesce(nullif(trim(profile.display_name), ''), 'Unbekannter Benutzer')
  into v_display_name
  from public.profiles profile
  where profile.id = v_user_id;

  v_display_name := coalesce(v_display_name, 'Unbekannter Benutzer');

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':' || p_entity_type || ':' || p_entity_id::text,
      0
    )
  );

  select lock_row.* into v_existing
  from public.edit_locks lock_row
  where lock_row.organization_id = p_organization_id
    and lock_row.entity_type = p_entity_type
    and lock_row.entity_id = p_entity_id
  for update;

  if v_existing.entity_id is null
     or v_existing.expires_at <= now()
     or (v_existing.locked_by_user_id = v_user_id and v_existing.lock_token = p_lock_token)
     or (p_force and (v_membership.role = 'admin' or v_existing.locked_by_user_id = v_user_id)) then
    insert into public.edit_locks (
      organization_id,
      entity_type,
      entity_id,
      lock_token,
      locked_by_user_id,
      locked_by_membership_id,
      locked_by_name,
      acquired_at,
      heartbeat_at,
      expires_at
    ) values (
      p_organization_id,
      p_entity_type,
      p_entity_id,
      p_lock_token,
      v_user_id,
      v_membership.id,
      v_display_name,
      now(),
      now(),
      now() + make_interval(secs => v_ttl)
    )
    on conflict (organization_id, entity_type, entity_id) do update
    set lock_token = excluded.lock_token,
        locked_by_user_id = excluded.locked_by_user_id,
        locked_by_membership_id = excluded.locked_by_membership_id,
        locked_by_name = excluded.locked_by_name,
        acquired_at = case
          when public.edit_locks.lock_token = excluded.lock_token then public.edit_locks.acquired_at
          else excluded.acquired_at
        end,
        heartbeat_at = excluded.heartbeat_at,
        expires_at = excluded.expires_at;

    return jsonb_build_object(
      'acquired', true,
      'lock_token', p_lock_token,
      'locked_by_user_id', v_user_id,
      'locked_by_name', v_display_name,
      'acquired_at', now(),
      'expires_at', now() + make_interval(secs => v_ttl),
      'record_version', v_version,
      'can_force', v_membership.role = 'admin'
    );
  end if;

  return jsonb_build_object(
    'acquired', false,
    'locked_by_user_id', v_existing.locked_by_user_id,
    'locked_by_name', v_existing.locked_by_name,
    'acquired_at', v_existing.acquired_at,
    'expires_at', v_existing.expires_at,
    'record_version', v_version,
    'is_own_other_session', v_existing.locked_by_user_id = v_user_id,
    'can_force', v_membership.role = 'admin' or v_existing.locked_by_user_id = v_user_id
  );
end;
$$;

create or replace function public.renew_edit_lock(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_lock_token uuid,
  p_ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ttl integer := greatest(60, least(coalesce(p_ttl_seconds, 120), 300));
  v_row public.edit_locks%rowtype;
begin
  update public.edit_locks lock_row
  set heartbeat_at = now(),
      expires_at = now() + make_interval(secs => v_ttl)
  where lock_row.organization_id = p_organization_id
    and lock_row.entity_type = p_entity_type
    and lock_row.entity_id = p_entity_id
    and lock_row.lock_token = p_lock_token
    and lock_row.locked_by_user_id = v_user_id
    and lock_row.expires_at > now()
  returning lock_row.* into v_row;

  if v_row.entity_id is null then
    return jsonb_build_object('renewed', false);
  end if;

  return jsonb_build_object(
    'renewed', true,
    'expires_at', v_row.expires_at
  );
end;
$$;

create or replace function public.release_edit_lock(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.edit_locks lock_row
  where lock_row.organization_id = p_organization_id
    and lock_row.entity_type = p_entity_type
    and lock_row.entity_id = p_entity_id
    and lock_row.lock_token = p_lock_token
    and lock_row.locked_by_user_id = (select auth.uid());

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

create or replace function public.assert_edit_lock(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_lock_token uuid,
  p_expected_updated_at timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_version timestamptz;
begin
  if not exists (
    select 1
    from public.edit_locks lock_row
    where lock_row.organization_id = p_organization_id
      and lock_row.entity_type = p_entity_type
      and lock_row.entity_id = p_entity_id
      and lock_row.lock_token = p_lock_token
      and lock_row.locked_by_user_id = v_user_id
      and lock_row.expires_at > now()
  ) then
    raise exception 'Die Bearbeitungsreservierung ist abgelaufen oder wurde übernommen. Bitte Datensatz neu öffnen.';
  end if;

  v_version := public.edit_lock_record_version(p_organization_id, p_entity_type, p_entity_id);

  if p_expected_updated_at is not null
     and abs(extract(epoch from (v_version - p_expected_updated_at))) > 0.001 then
    raise exception 'Der Datensatz wurde seit dem Öffnen verändert. Bitte neu laden, damit keine Änderungen überschrieben werden.';
  end if;

  return v_version;
end;
$$;

create or replace function public.cleanup_expired_edit_locks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.edit_locks where expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Ein noch geöffneter Trainingsblock darf nicht aus der Übersicht gelöscht werden.
create or replace function public.delete_unused_training_block(
  p_organization_id uuid,
  p_block_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := (select auth.uid());
begin
  if v_current_user_id is null or not public.has_module_access(p_organization_id, 'training_blocks', true) then
    raise exception 'Du darfst Trainingsblöcke nicht löschen.';
  end if;

  if exists (
    select 1
    from public.edit_locks lock_row
    where lock_row.organization_id = p_organization_id
      and lock_row.entity_type = 'training_block'
      and lock_row.entity_id = p_block_id
      and lock_row.expires_at > now()
  ) then
    raise exception 'Der Trainingsblock wird gerade bearbeitet und kann erst danach gelöscht werden.';
  end if;

  if exists (select 1 from public.training_block_usages usage where usage.block_id = p_block_id) then
    raise exception 'Verwendete Trainingsblöcke können nicht gelöscht werden.';
  end if;

  delete from public.training_blocks
  where id = p_block_id and organization_id = p_organization_id;
  if not found then raise exception 'Der Trainingsblock wurde nicht gefunden.'; end if;
end;
$$;

revoke all on function public.edit_lock_module_key(text) from public;
revoke all on function public.edit_lock_record_version(uuid, text, uuid) from public;
revoke all on function public.acquire_edit_lock(uuid, text, uuid, uuid, boolean, integer) from public;
revoke all on function public.renew_edit_lock(uuid, text, uuid, uuid, integer) from public;
revoke all on function public.release_edit_lock(uuid, text, uuid, uuid) from public;
revoke all on function public.assert_edit_lock(uuid, text, uuid, uuid, timestamptz) from public;
revoke all on function public.cleanup_expired_edit_locks() from public;

grant execute on function public.acquire_edit_lock(uuid, text, uuid, uuid, boolean, integer) to authenticated;
grant execute on function public.renew_edit_lock(uuid, text, uuid, uuid, integer) to authenticated;
grant execute on function public.release_edit_lock(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.assert_edit_lock(uuid, text, uuid, uuid, timestamptz) to authenticated;
