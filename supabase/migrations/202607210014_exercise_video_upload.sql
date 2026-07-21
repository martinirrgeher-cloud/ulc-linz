-- ULC Linz App V2 – Übungskatalog: private Video-Uploads aus der Handy-Galerie

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'exercise-videos',
  'exercise-videos',
  false,
  52428800,
  array[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
    'video/3gpp',
    'video/3gpp2'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.exercise_videos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 10 and 500),
  title text not null check (char_length(trim(title)) between 1 and 120),
  mime_type text not null check (mime_type like 'video/%'),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  is_primary boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_videos_exercise_idx
  on public.exercise_videos (exercise_id, is_primary desc, created_at);
create index if not exists exercise_videos_org_idx
  on public.exercise_videos (organization_id, created_at desc);
create unique index if not exists exercise_videos_one_primary_idx
  on public.exercise_videos (exercise_id)
  where is_primary;

drop trigger if exists exercise_videos_set_updated_at on public.exercise_videos;
create trigger exercise_videos_set_updated_at
before update on public.exercise_videos
for each row execute function public.set_updated_at();

alter table public.exercise_videos enable row level security;
revoke all on table public.exercise_videos from anon, authenticated;

-- Private Storage-Dateien: ansehen mit Leserecht, verändern nur mit Bearbeitungsrecht.
drop policy if exists exercise_videos_storage_select on storage.objects;
create policy exercise_videos_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-videos'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_module_access(
    split_part(name, '/', 1)::uuid,
    'exercise_catalog',
    false
  )
);

drop policy if exists exercise_videos_storage_insert on storage.objects;
create policy exercise_videos_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exercise-videos'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_module_access(
    split_part(name, '/', 1)::uuid,
    'exercise_catalog',
    true
  )
);

drop policy if exists exercise_videos_storage_update on storage.objects;
create policy exercise_videos_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exercise-videos'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_module_access(
    split_part(name, '/', 1)::uuid,
    'exercise_catalog',
    true
  )
)
with check (
  bucket_id = 'exercise-videos'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_module_access(
    split_part(name, '/', 1)::uuid,
    'exercise_catalog',
    true
  )
);

drop policy if exists exercise_videos_storage_delete on storage.objects;
create policy exercise_videos_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exercise-videos'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.has_module_access(
    split_part(name, '/', 1)::uuid,
    'exercise_catalog',
    true
  )
);

create or replace function public.exercise_video_overview(
  p_organization_id uuid,
  p_exercise_id uuid default null
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
    raise exception 'Für die Übungsvideos fehlen die erforderlichen Rechte.';
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
      join public.exercises exercise
        on exercise.id = video.exercise_id
       and exercise.organization_id = video.organization_id
      where video.organization_id = p_organization_id
        and (p_exercise_id is null or video.exercise_id = p_exercise_id)
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.register_exercise_video(
  p_organization_id uuid,
  p_exercise_id uuid,
  p_storage_path text,
  p_title text,
  p_mime_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_video_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_primary boolean;
begin
  if v_user_id is null or not public.has_module_access(
    p_organization_id,
    'exercise_catalog',
    true
  ) then
    raise exception 'Du darfst keine Übungsvideos hochladen.';
  end if;

  if not exists (
    select 1
    from public.exercises exercise
    where exercise.id = p_exercise_id
      and exercise.organization_id = p_organization_id
  ) then
    raise exception 'Die Übung wurde nicht gefunden.';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Bitte eine gültige Videobezeichnung eingeben.';
  end if;

  if p_mime_type is null or p_mime_type not like 'video/%' then
    raise exception 'Die ausgewählte Datei ist kein unterstütztes Video.';
  end if;

  if p_file_size is null or p_file_size <= 0 or p_file_size > 52428800 then
    raise exception 'Das Video darf maximal 50 MB groß sein.';
  end if;

  if p_storage_path is null
     or p_storage_path not like p_organization_id::text || '/' || p_exercise_id::text || '/%' then
    raise exception 'Der Speicherpfad des Videos ist ungültig.';
  end if;

  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'exercise-videos'
      and object.name = p_storage_path
  ) then
    raise exception 'Die hochgeladene Videodatei wurde im Speicher nicht gefunden.';
  end if;

  v_primary := not exists (
    select 1
    from public.exercise_videos video
    where video.exercise_id = p_exercise_id
      and video.is_primary
  );

  insert into public.exercise_videos (
    organization_id,
    exercise_id,
    storage_path,
    title,
    mime_type,
    file_size,
    is_primary,
    uploaded_by
  ) values (
    p_organization_id,
    p_exercise_id,
    p_storage_path,
    v_title,
    p_mime_type,
    p_file_size,
    v_primary,
    v_user_id
  )
  returning id into v_video_id;

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
    'exercise.video_uploaded',
    'exercise_video',
    v_video_id::text,
    jsonb_build_object(
      'exercise_id', p_exercise_id,
      'title', v_title,
      'file_size', p_file_size,
      'is_primary', v_primary
    )
  );

  return v_video_id;
end;
$$;

create or replace function public.set_exercise_primary_video(
  p_organization_id uuid,
  p_exercise_id uuid,
  p_video_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not public.has_module_access(
    p_organization_id,
    'exercise_catalog',
    true
  ) then
    raise exception 'Du darfst Übungsvideos nicht bearbeiten.';
  end if;

  if not exists (
    select 1
    from public.exercise_videos video
    where video.id = p_video_id
      and video.exercise_id = p_exercise_id
      and video.organization_id = p_organization_id
  ) then
    raise exception 'Das Video wurde nicht gefunden.';
  end if;

  update public.exercise_videos
  set is_primary = false
  where exercise_id = p_exercise_id
    and organization_id = p_organization_id
    and is_primary;

  update public.exercise_videos
  set is_primary = true
  where id = p_video_id;
end;
$$;

create or replace function public.delete_exercise_video_record(
  p_organization_id uuid,
  p_exercise_id uuid,
  p_video_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_deleted public.exercise_videos%rowtype;
  v_next_video_id uuid;
begin
  if v_user_id is null or not public.has_module_access(
    p_organization_id,
    'exercise_catalog',
    true
  ) then
    raise exception 'Du darfst Übungsvideos nicht löschen.';
  end if;

  delete from public.exercise_videos video
  where video.id = p_video_id
    and video.exercise_id = p_exercise_id
    and video.organization_id = p_organization_id
  returning video.* into v_deleted;

  if v_deleted.id is null then
    return;
  end if;

  if v_deleted.is_primary then
    select video.id
    into v_next_video_id
    from public.exercise_videos video
    where video.exercise_id = p_exercise_id
      and video.organization_id = p_organization_id
    order by video.created_at, video.id
    limit 1;

    if v_next_video_id is not null then
      update public.exercise_videos
      set is_primary = true
      where id = v_next_video_id;
    end if;
  end if;

  insert into public.audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data
  ) values (
    p_organization_id,
    v_user_id,
    'exercise.video_deleted',
    'exercise_video',
    v_deleted.id::text,
    jsonb_build_object(
      'exercise_id', v_deleted.exercise_id,
      'title', v_deleted.title,
      'storage_path', v_deleted.storage_path
    )
  );
end;
$$;

revoke all on function public.exercise_video_overview(uuid, uuid) from public;
revoke all on function public.register_exercise_video(uuid, uuid, text, text, text, bigint) from public;
revoke all on function public.set_exercise_primary_video(uuid, uuid, uuid) from public;
revoke all on function public.delete_exercise_video_record(uuid, uuid, uuid) from public;

grant execute on function public.exercise_video_overview(uuid, uuid) to authenticated;
grant execute on function public.register_exercise_video(uuid, uuid, text, text, text, bigint) to authenticated;
grant execute on function public.set_exercise_primary_video(uuid, uuid, uuid) to authenticated;
grant execute on function public.delete_exercise_video_record(uuid, uuid, uuid) to authenticated;

commit;
