-- ULC Linz App v16
-- Trainingsdokumentation Phase 3.1 bis 3.3:
-- Soll-Ist-Dokumentation, Autosave-Grundlage, Satzdokumentation, Videos,
-- Trainerfeedback, Wochenstatus und statistische Auswertungen.

begin;

update public.app_modules
set
  title = 'Trainingsdokumentation',
  description = 'Training durchführen, Soll-Ist dokumentieren und auswerten',
  route = '/module/training_documentation',
  icon = 'dumbbell',
  is_active = true
where key = 'training_documentation';

create table if not exists public.athlete_training_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.athlete_training_plans(id) on delete restrict,
  athlete_id uuid not null,
  group_id uuid not null,
  training_date date not null,
  athlete_name_snapshot text not null check (char_length(trim(athlete_name_snapshot)) between 1 and 200),
  group_name_snapshot text not null check (char_length(trim(group_name_snapshot)) between 1 and 160),
  plan_title_snapshot text not null check (char_length(trim(plan_title_snapshot)) between 1 and 200),
  plan_notes_snapshot text check (plan_notes_snapshot is null or char_length(plan_notes_snapshot) <= 10000),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'partial', 'aborted')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  planned_minutes_snapshot integer not null default 0
    check (planned_minutes_snapshot between 0 and 1440),
  actual_minutes integer check (actual_minutes is null or actual_minutes between 0 and 1440),
  overall_rpe smallint check (overall_rpe is null or overall_rpe between 1 and 10),
  overall_rating smallint check (overall_rating is null or overall_rating between 1 and 5),
  overall_comment text check (overall_comment is null or char_length(overall_comment) <= 5000),
  pain_level text not null default 'none' check (pain_level in ('none', 'mild', 'strong')),
  pain_comment text check (pain_comment is null or char_length(pain_comment) <= 3000),
  trainer_feedback text check (trainer_feedback is null or char_length(trainer_feedback) <= 5000),
  trainer_reviewed_at timestamptz,
  trainer_reviewed_by uuid references auth.users(id) on delete set null,
  edited_after_completion boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  last_saved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id),
  unique (id, organization_id),
  constraint athlete_training_sessions_athlete_fk
    foreign key (athlete_id, organization_id)
    references public.athletes(id, organization_id)
    on delete restrict,
  constraint athlete_training_sessions_group_fk
    foreign key (group_id, organization_id)
    references public.training_groups(id, organization_id)
    on delete restrict
);

create index if not exists athlete_training_sessions_org_date_idx
  on public.athlete_training_sessions (organization_id, training_date desc, athlete_id);
create index if not exists athlete_training_sessions_group_date_idx
  on public.athlete_training_sessions (organization_id, group_id, training_date desc);
create index if not exists athlete_training_sessions_status_idx
  on public.athlete_training_sessions (organization_id, status, training_date desc);

create table if not exists public.athlete_training_session_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.athlete_training_sessions(id) on delete cascade,
  source_plan_section_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 0 and 1440),
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, source_plan_section_id)
);

create index if not exists athlete_training_session_sections_session_idx
  on public.athlete_training_session_sections (session_id, sort_order);

create table if not exists public.athlete_training_session_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.athlete_training_sessions(id) on delete cascade,
  section_id uuid not null references public.athlete_training_session_sections(id) on delete cascade,
  source_plan_item_id uuid,
  source_exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null check (char_length(trim(exercise_name)) between 1 and 160),
  category_title text not null default '',
  planned_note text,
  parameter_definitions jsonb not null default '[]'::jsonb,
  planned_values jsonb not null default '{}'::jsonb,
  actual_values jsonb not null default '{}'::jsonb,
  status text not null default 'planned'
    check (status in ('planned', 'as_planned', 'changed', 'partial', 'skipped', 'aborted')),
  rating smallint check (rating is null or rating between 1 and 5),
  rpe smallint check (rpe is null or rpe between 1 and 10),
  comment text check (comment is null or char_length(comment) <= 3000),
  pain_level text not null default 'none' check (pain_level in ('none', 'mild', 'strong')),
  pain_comment text check (pain_comment is null or char_length(pain_comment) <= 3000),
  trainer_comment text check (trainer_comment is null or char_length(trainer_comment) <= 3000),
  exercise_video_url text,
  exercise_video_storage_path text,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(parameter_definitions) = 'array'),
  check (jsonb_typeof(planned_values) = 'object'),
  check (jsonb_typeof(actual_values) = 'object'),
  unique (session_id, source_plan_item_id)
);

create index if not exists athlete_training_session_items_session_idx
  on public.athlete_training_session_items (session_id, sort_order);
create index if not exists athlete_training_session_items_exercise_idx
  on public.athlete_training_session_items (organization_id, source_exercise_id, created_at desc)
  where source_exercise_id is not null;

create table if not exists public.athlete_training_session_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.athlete_training_sessions(id) on delete cascade,
  item_id uuid not null references public.athlete_training_session_items(id) on delete cascade,
  set_number integer not null check (set_number between 1 and 1000),
  planned_values jsonb not null default '{}'::jsonb,
  actual_values jsonb not null default '{}'::jsonb,
  status text not null default 'as_planned'
    check (status in ('as_planned', 'changed', 'partial', 'skipped', 'aborted')),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(planned_values) = 'object'),
  check (jsonb_typeof(actual_values) = 'object'),
  unique (item_id, set_number)
);

create index if not exists athlete_training_session_sets_item_idx
  on public.athlete_training_session_sets (item_id, set_number);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'training-documentation-media',
  'training-documentation-media',
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

create table if not exists public.athlete_training_session_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.athlete_training_sessions(id) on delete cascade,
  item_id uuid not null references public.athlete_training_session_items(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 10 and 500),
  title text not null check (char_length(trim(title)) between 1 and 120),
  mime_type text not null check (mime_type like 'video/%'),
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athlete_training_session_media_item_idx
  on public.athlete_training_session_media (item_id, created_at);

-- Aktualisierungszeitpunkte

drop trigger if exists athlete_training_sessions_set_updated_at on public.athlete_training_sessions;
create trigger athlete_training_sessions_set_updated_at
before update on public.athlete_training_sessions
for each row execute function public.set_updated_at();

drop trigger if exists athlete_training_session_sections_set_updated_at on public.athlete_training_session_sections;
create trigger athlete_training_session_sections_set_updated_at
before update on public.athlete_training_session_sections
for each row execute function public.set_updated_at();

drop trigger if exists athlete_training_session_items_set_updated_at on public.athlete_training_session_items;
create trigger athlete_training_session_items_set_updated_at
before update on public.athlete_training_session_items
for each row execute function public.set_updated_at();

drop trigger if exists athlete_training_session_sets_set_updated_at on public.athlete_training_session_sets;
create trigger athlete_training_session_sets_set_updated_at
before update on public.athlete_training_session_sets
for each row execute function public.set_updated_at();

drop trigger if exists athlete_training_session_media_set_updated_at on public.athlete_training_session_media;
create trigger athlete_training_session_media_set_updated_at
before update on public.athlete_training_session_media
for each row execute function public.set_updated_at();

-- Zentrale Zugriffsprüfung für RPCs und private Storage-Dateien.
create or replace function public.can_access_training_documentation_session(
  p_organization_id uuid,
  p_session_id uuid,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.athlete_training_sessions session
    join public.organization_members membership
      on membership.organization_id = session.organization_id
     and membership.user_id = (select auth.uid())
     and membership.status = 'active'
    where session.id = p_session_id
      and session.organization_id = p_organization_id
      and public.has_module_access(
        p_organization_id,
        'training_documentation',
        p_write
      )
      and (
        membership.role in ('admin', 'trainer')
        or exists (
          select 1
          from public.athletes athlete
          where athlete.id = session.athlete_id
            and athlete.organization_id = session.organization_id
            and athlete.linked_user_id = (select auth.uid())
        )
      )
  );
$$;

-- Tabellen werden ausschließlich über Security-Definer-RPCs verwendet.
alter table public.athlete_training_sessions enable row level security;
alter table public.athlete_training_session_sections enable row level security;
alter table public.athlete_training_session_items enable row level security;
alter table public.athlete_training_session_sets enable row level security;
alter table public.athlete_training_session_media enable row level security;

revoke all on table public.athlete_training_sessions from anon, authenticated;
revoke all on table public.athlete_training_session_sections from anon, authenticated;
revoke all on table public.athlete_training_session_items from anon, authenticated;
revoke all on table public.athlete_training_session_sets from anon, authenticated;
revoke all on table public.athlete_training_session_media from anon, authenticated;

-- Private Trainingsvideos: Pfad organization/session/item/datei.
drop policy if exists training_documentation_media_storage_select on storage.objects;
create policy training_documentation_media_storage_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'training-documentation-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_training_documentation_session(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid,
    false
  )
);

drop policy if exists training_documentation_media_storage_insert on storage.objects;
create policy training_documentation_media_storage_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'training-documentation-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_training_documentation_session(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid,
    true
  )
);

drop policy if exists training_documentation_media_storage_update on storage.objects;
create policy training_documentation_media_storage_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'training-documentation-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_training_documentation_session(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid,
    true
  )
)
with check (
  bucket_id = 'training-documentation-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_training_documentation_session(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid,
    true
  )
);

drop policy if exists training_documentation_media_storage_delete on storage.objects;
create policy training_documentation_media_storage_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'training-documentation-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.can_access_training_documentation_session(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid,
    true
  )
);

-- Übungsvideos müssen auch innerhalb der Trainingsdokumentation abrufbar sein.
drop policy if exists exercise_videos_storage_select on storage.objects;
create policy exercise_videos_storage_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'exercise-videos'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (
    public.has_module_access(split_part(name, '/', 1)::uuid, 'exercise_catalog', false)
    or public.has_module_access(split_part(name, '/', 1)::uuid, 'training_planning', false)
    or public.has_module_access(split_part(name, '/', 1)::uuid, 'training_documentation', false)
  )
);

create or replace function public.training_documentation_overview(
  p_organization_id uuid,
  p_week_start date,
  p_group_id uuid default null,
  p_athlete_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_week_start date := date_trunc('week', p_week_start::timestamp)::date;
  v_week_end date := v_week_start + 6;
  v_role public.app_role;
  v_own_athlete_id uuid;
  v_effective_athlete_id uuid;
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

  select athlete.id
  into v_own_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_user_id
    and athlete.is_active
  limit 1;

  if v_role in ('admin', 'trainer') then
    -- Trainer benötigen für die Wochenmatrix alle Pläne der Gruppe.
    -- Die Auswahl eines Athleten wird ausschließlich im Client gefiltert.
    v_effective_athlete_id := null;
  else
    v_effective_athlete_id := v_own_athlete_id;
  end if;

  return jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'current_role', v_role,
    'own_athlete_id', v_own_athlete_id,
    'can_review', v_role in ('admin', 'trainer')
      and public.has_module_access(p_organization_id, 'training_documentation', true),
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
      where training_group.organization_id = p_organization_id
        and training_group.is_active
        and (
          v_role in ('admin', 'trainer')
          or exists (
            select 1
            from public.athlete_group_memberships membership
            where membership.organization_id = p_organization_id
              and membership.group_id = training_group.id
              and membership.athlete_id = v_own_athlete_id
              and membership.ended_on is null
          )
        )
    ), '[]'::jsonb),
    'athletes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', athlete.id,
          'first_name', athlete.first_name,
          'last_name', athlete.last_name,
          'group_ids', coalesce((
            select jsonb_agg(membership.group_id order by membership.group_id)
            from public.athlete_group_memberships membership
            where membership.organization_id = p_organization_id
              and membership.athlete_id = athlete.id
              and membership.ended_on is null
          ), '[]'::jsonb)
        )
        order by lower(athlete.last_name), lower(athlete.first_name)
      )
      from public.athletes athlete
      where athlete.organization_id = p_organization_id
        and athlete.is_active
        and (v_role in ('admin', 'trainer') or athlete.id = v_own_athlete_id)
        and (
          p_group_id is null
          or exists (
            select 1
            from public.athlete_group_memberships membership
            where membership.organization_id = p_organization_id
              and membership.athlete_id = athlete.id
              and membership.group_id = p_group_id
              and membership.ended_on is null
          )
        )
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', plan.id,
          'athlete_id', plan.athlete_id,
          'athlete_name', athlete.first_name || ' ' || athlete.last_name,
          'group_id', plan.group_id,
          'group_name', training_group.name,
          'training_date', plan.training_date,
          'title', coalesce(session.plan_title_snapshot, plan.title),
          'planned_minutes', coalesce(session.planned_minutes_snapshot, (
            select sum(section.estimated_minutes)
            from public.athlete_training_plan_sections section
            where section.plan_id = plan.id
          ), 0),
          'exercise_count', case
            when session.id is not null then (
              select count(*)
              from public.athlete_training_session_items session_item
              where session_item.session_id = session.id
            )
            else (
              select count(*)
              from public.athlete_training_plan_items item
              where item.plan_id = plan.id
            )
          end,
          'session_id', session.id,
          'session_status', coalesce(session.status, 'not_started'),
          'actual_minutes', session.actual_minutes,
          'overall_rpe', session.overall_rpe,
          'overall_rating', session.overall_rating,
          'completed_exercise_count', coalesce((
            select count(*)
            from public.athlete_training_session_items session_item
            where session_item.session_id = session.id
              and session_item.status <> 'planned'
          ), 0),
          'updated_at', coalesce(session.updated_at, plan.updated_at)
        )
        order by plan.training_date, lower(athlete.last_name), lower(athlete.first_name)
      )
      from public.athlete_training_plans plan
      join public.athletes athlete
        on athlete.id = plan.athlete_id
       and athlete.organization_id = plan.organization_id
      join public.training_groups training_group
        on training_group.id = plan.group_id
       and training_group.organization_id = plan.organization_id
      left join public.athlete_training_sessions session
        on session.plan_id = plan.id
       and session.organization_id = plan.organization_id
      where plan.organization_id = p_organization_id
        and plan.training_date between v_week_start and v_week_end
        and (p_group_id is null or plan.group_id = p_group_id)
        and (v_effective_athlete_id is null or plan.athlete_id = v_effective_athlete_id)
        and (v_role in ('admin', 'trainer') or plan.athlete_id = v_own_athlete_id)
    ), '[]'::jsonb)
  );
end;
$$;

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
                  'exercise_name', item.exercise_name,
                  'category_title', item.category_title,
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

create or replace function public.start_training_documentation(
  p_organization_id uuid,
  p_plan_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role public.app_role;
  v_plan public.athlete_training_plans%rowtype;
  v_own_athlete_id uuid;
  v_session_id uuid;
  v_section record;
  v_session_section_id uuid;
  v_planned_minutes integer;
  v_athlete_name text;
  v_group_name text;
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
    raise exception 'Du darfst keine Trainingsdokumentation starten.';
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
    raise exception 'Du darfst nur dein eigenes Training dokumentieren.';
  end if;

  select session.id
  into v_session_id
  from public.athlete_training_sessions session
  where session.organization_id = p_organization_id
    and session.plan_id = p_plan_id;

  if v_session_id is not null then
    return v_session_id;
  end if;

  select coalesce(sum(section.estimated_minutes), 0)::integer
  into v_planned_minutes
  from public.athlete_training_plan_sections section
  where section.plan_id = p_plan_id;

  select
    athlete.first_name || ' ' || athlete.last_name,
    training_group.name
  into v_athlete_name, v_group_name
  from public.athletes athlete
  join public.training_groups training_group
    on training_group.id = v_plan.group_id
   and training_group.organization_id = v_plan.organization_id
  where athlete.id = v_plan.athlete_id
    and athlete.organization_id = v_plan.organization_id;

  if v_athlete_name is null or v_group_name is null then
    raise exception 'Athlet oder Trainingsgruppe des Plans wurde nicht gefunden.';
  end if;

  insert into public.athlete_training_sessions (
    organization_id,
    plan_id,
    athlete_id,
    group_id,
    training_date,
    athlete_name_snapshot,
    group_name_snapshot,
    plan_title_snapshot,
    plan_notes_snapshot,
    status,
    planned_minutes_snapshot,
    created_by,
    last_saved_by
  ) values (
    p_organization_id,
    p_plan_id,
    v_plan.athlete_id,
    v_plan.group_id,
    v_plan.training_date,
    v_athlete_name,
    v_group_name,
    v_plan.title,
    nullif(trim(coalesce(v_plan.notes, '')), ''),
    'in_progress',
    v_planned_minutes,
    v_user_id,
    v_user_id
  )
  returning id into v_session_id;

  for v_section in
    select section.*
    from public.athlete_training_plan_sections section
    where section.plan_id = p_plan_id
    order by section.sort_order, section.id
  loop
    insert into public.athlete_training_session_sections (
      organization_id,
      session_id,
      source_plan_section_id,
      name,
      description,
      estimated_minutes,
      sort_order
    ) values (
      p_organization_id,
      v_session_id,
      v_section.id,
      v_section.name,
      v_section.description,
      v_section.estimated_minutes,
      v_section.sort_order
    )
    returning id into v_session_section_id;

    insert into public.athlete_training_session_items (
      organization_id,
      session_id,
      section_id,
      source_plan_item_id,
      source_exercise_id,
      exercise_name,
      category_title,
      planned_note,
      parameter_definitions,
      planned_values,
      actual_values,
      status,
      exercise_video_url,
      exercise_video_storage_path,
      sort_order
    )
    select
      p_organization_id,
      v_session_id,
      v_session_section_id,
      item.id,
      item.source_exercise_id,
      item.exercise_name,
      item.category_title,
      item.note,
      item.parameter_definitions,
      item.parameter_values,
      item.parameter_values,
      'planned',
      exercise.video_url,
      primary_video.storage_path,
      item.sort_order
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
    where item.section_id = v_section.id
    order by item.sort_order, item.id;
  end loop;

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
    'training_documentation.started',
    'athlete_training_session',
    v_session_id::text,
    jsonb_build_object('plan_id', p_plan_id, 'athlete_id', v_plan.athlete_id, 'training_date', v_plan.training_date)
  );

  return v_session_id;
end;
$$;

create or replace function public.save_training_documentation(
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
  p_items jsonb
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

  select session.*
  into v_session
  from public.athlete_training_sessions session
  where session.id = p_session_id
    and session.organization_id = p_organization_id
  for update;

  if v_session.id is null then
    raise exception 'Die Trainingsdokumentation wurde nicht gefunden.';
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

create or replace function public.register_training_documentation_media(
  p_organization_id uuid,
  p_session_id uuid,
  p_item_id uuid,
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
  v_media_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_expected_prefix text := p_organization_id::text || '/' || p_session_id::text || '/' || p_item_id::text || '/';
begin
  if v_user_id is null
     or not public.can_access_training_documentation_session(p_organization_id, p_session_id, true) then
    raise exception 'Du darfst zu dieser Trainingsdokumentation keine Videos hochladen.';
  end if;

  if not exists (
    select 1
    from public.athlete_training_session_items item
    where item.id = p_item_id
      and item.session_id = p_session_id
      and item.organization_id = p_organization_id
  ) then
    raise exception 'Die ausgewählte Übung wurde nicht gefunden.';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'Bitte eine gültige Videobezeichnung eingeben.';
  end if;
  if p_mime_type is null or p_mime_type not like 'video/%' then
    raise exception 'Die ausgewählte Datei ist kein unterstütztes Video.';
  end if;
  if p_file_size is null or p_file_size <= 0 or p_file_size > 52428800 then
    raise exception 'Das Video ist leer oder größer als 50 MB.';
  end if;
  if p_storage_path is null or position(v_expected_prefix in p_storage_path) <> 1 then
    raise exception 'Der Speicherpfad des Videos ist ungültig.';
  end if;
  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'training-documentation-media'
      and object.name = p_storage_path
  ) then
    raise exception 'Die hochgeladene Videodatei wurde im Speicher nicht gefunden.';
  end if;

  insert into public.athlete_training_session_media (
    organization_id,
    session_id,
    item_id,
    storage_path,
    title,
    mime_type,
    file_size,
    uploaded_by
  ) values (
    p_organization_id,
    p_session_id,
    p_item_id,
    p_storage_path,
    v_title,
    p_mime_type,
    p_file_size,
    v_user_id
  )
  returning id into v_media_id;

  return v_media_id;
end;
$$;

create or replace function public.delete_training_documentation_media(
  p_organization_id uuid,
  p_media_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_storage_path text;
begin
  select medium.session_id, medium.storage_path
  into v_session_id, v_storage_path
  from public.athlete_training_session_media medium
  where medium.id = p_media_id
    and medium.organization_id = p_organization_id;

  if v_session_id is null then
    raise exception 'Das Trainingsvideo wurde nicht gefunden.';
  end if;
  if not public.can_access_training_documentation_session(p_organization_id, v_session_id, true) then
    raise exception 'Du darfst dieses Trainingsvideo nicht löschen.';
  end if;

  delete from public.athlete_training_session_media medium
  where medium.id = p_media_id
    and medium.organization_id = p_organization_id;

  return v_storage_path;
end;
$$;

create or replace function public.training_documentation_statistics(
  p_organization_id uuid,
  p_athlete_id uuid,
  p_date_from date,
  p_date_to date
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
  v_date_from date := coalesce(p_date_from, current_date - 90);
  v_date_to date := coalesce(p_date_to, current_date);
  v_athlete_name text;
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
    raise exception 'Für die Trainingsauswertung fehlen die erforderlichen Rechte.';
  end if;

  select athlete.id
  into v_own_athlete_id
  from public.athletes athlete
  where athlete.organization_id = p_organization_id
    and athlete.linked_user_id = v_user_id
    and athlete.is_active
  limit 1;

  if v_role not in ('admin', 'trainer') and p_athlete_id is distinct from v_own_athlete_id then
    raise exception 'Du darfst nur deine eigene Trainingsauswertung öffnen.';
  end if;
  if v_date_from > v_date_to then
    raise exception 'Das Von-Datum darf nicht nach dem Bis-Datum liegen.';
  end if;

  select athlete.first_name || ' ' || athlete.last_name
  into v_athlete_name
  from public.athletes athlete
  where athlete.id = p_athlete_id
    and athlete.organization_id = p_organization_id;

  if v_athlete_name is null then
    raise exception 'Der Athlet wurde nicht gefunden.';
  end if;

  return jsonb_build_object(
    'athlete_id', p_athlete_id,
    'athlete_name', v_athlete_name,
    'date_from', v_date_from,
    'date_to', v_date_to,
    'summary', jsonb_build_object(
      'session_count', (
        select count(*)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
      ),
      'completed_count', (
        select count(*)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and session.status = 'completed'
      ),
      'planned_minutes', coalesce((
        select sum(session.planned_minutes_snapshot)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
      ), 0),
      'actual_minutes', coalesce((
        select sum(session.actual_minutes)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
      ), 0),
      'average_rpe', (
        select round(avg(session.overall_rpe)::numeric, 1)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
      ),
      'average_rating', (
        select round(avg(session.overall_rating)::numeric, 1)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
      ),
      'pain_session_count', (
        select count(*)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and session.pain_level <> 'none'
      ),
      'exercise_count', (
        select count(*)
        from public.athlete_training_session_items item
        join public.athlete_training_sessions session on session.id = item.session_id
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and item.status <> 'planned'
      ),
      'completion_rate', coalesce((
        select round(
          100.0 * count(*) filter (where session.status = 'completed') / nullif(count(*), 0),
          1
        )
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
      ), 0)
    ),
    'sessions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', session.id,
          'training_date', session.training_date,
          'title', session.plan_title_snapshot,
          'status', session.status,
          'planned_minutes', session.planned_minutes_snapshot,
          'actual_minutes', session.actual_minutes,
          'overall_rpe', session.overall_rpe,
          'overall_rating', session.overall_rating,
          'pain_level', session.pain_level,
          'completed_exercise_count', (
            select count(*)
            from public.athlete_training_session_items item
            where item.session_id = session.id
              and item.status <> 'planned'
          ),
          'exercise_count', (
            select count(*)
            from public.athlete_training_session_items item
            where item.session_id = session.id
          )
        )
        order by session.training_date
      )
      from public.athlete_training_sessions session
      where session.organization_id = p_organization_id
        and session.athlete_id = p_athlete_id
        and session.training_date between v_date_from and v_date_to
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'exercise_id', statistic.source_exercise_id,
          'exercise_name', statistic.exercise_name,
          'session_count', statistic.session_count,
          'completed_count', statistic.completed_count,
          'changed_count', statistic.changed_count,
          'skipped_count', statistic.skipped_count,
          'average_rating', statistic.average_rating,
          'average_rpe', statistic.average_rpe,
          'pain_count', statistic.pain_count
        )
        order by statistic.session_count desc, lower(statistic.exercise_name)
      )
      from (
        select
          item.source_exercise_id,
          item.exercise_name,
          count(distinct session.id) as session_count,
          count(*) filter (where item.status = 'as_planned') as completed_count,
          count(*) filter (where item.status in ('changed', 'partial')) as changed_count,
          count(*) filter (where item.status in ('skipped', 'aborted')) as skipped_count,
          round(avg(item.rating)::numeric, 1) as average_rating,
          round(avg(item.rpe)::numeric, 1) as average_rpe,
          count(*) filter (where item.pain_level <> 'none') as pain_count
        from public.athlete_training_session_items item
        join public.athlete_training_sessions session on session.id = item.session_id
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and item.status <> 'planned'
        group by item.source_exercise_id, item.exercise_name
      ) statistic
    ), '[]'::jsonb),
    'parameters', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'exercise_id', statistic.source_exercise_id,
          'exercise_name', statistic.exercise_name,
          'parameter_key', statistic.parameter_key,
          'label', statistic.label,
          'unit', statistic.unit,
          'sample_count', statistic.sample_count,
          'planned_average', statistic.planned_average,
          'actual_average', statistic.actual_average,
          'achievement_percent', statistic.achievement_percent
        )
        order by lower(statistic.exercise_name), statistic.label
      )
      from (
        select
          item.source_exercise_id,
          item.exercise_name,
          planned.key as parameter_key,
          coalesce(definition.value->>'label', planned.key) as label,
          coalesce(definition.value->>'unit', '') as unit,
          count(*) as sample_count,
          round(avg(replace(planned.value #>> '{}', ',', '.')::numeric), 2) as planned_average,
          round(avg(replace(actual.value #>> '{}', ',', '.')::numeric), 2) as actual_average,
          round(
            100.0 * avg(replace(actual.value #>> '{}', ',', '.')::numeric)
              / nullif(avg(replace(planned.value #>> '{}', ',', '.')::numeric), 0),
            1
          ) as achievement_percent
        from public.athlete_training_session_items item
        join public.athlete_training_sessions session on session.id = item.session_id
        cross join lateral jsonb_each(item.planned_values) planned(key, value)
        join lateral jsonb_each(item.actual_values) actual(key, value)
          on actual.key = planned.key
        left join lateral jsonb_array_elements(item.parameter_definitions) definition(value)
          on coalesce(definition.value->>'key', definition.value->>'parameter_key') = planned.key
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and (planned.value #>> '{}') ~ '^-?[0-9]+([.,][0-9]+)?$'
          and (actual.value #>> '{}') ~ '^-?[0-9]+([.,][0-9]+)?$'
        group by
          item.source_exercise_id,
          item.exercise_name,
          planned.key,
          coalesce(definition.value->>'label', planned.key),
          coalesce(definition.value->>'unit', '')
      ) statistic
    ), '[]'::jsonb),
    'months', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', statistic.month,
          'session_count', statistic.session_count,
          'planned_minutes', statistic.planned_minutes,
          'actual_minutes', statistic.actual_minutes,
          'average_rpe', statistic.average_rpe,
          'average_rating', statistic.average_rating
        )
        order by statistic.month
      )
      from (
        select
          to_char(date_trunc('month', session.training_date), 'YYYY-MM') as month,
          count(*) as session_count,
          coalesce(sum(session.planned_minutes_snapshot), 0) as planned_minutes,
          coalesce(sum(session.actual_minutes), 0) as actual_minutes,
          round(avg(session.overall_rpe)::numeric, 1) as average_rpe,
          round(avg(session.overall_rating)::numeric, 1) as average_rating
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
        group by date_trunc('month', session.training_date)
      ) statistic
    ), '[]'::jsonb),
    'reasons', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', reason.key, 'label', reason.label, 'count', reason.count)
        order by reason.count desc, reason.label
      )
      from (
        select 'session_partial'::text as key, 'Training teilweise absolviert'::text as label, count(*) as count
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and session.status = 'partial'
        having count(*) > 0
        union all
        select 'session_aborted', 'Training abgebrochen', count(*)
        from public.athlete_training_sessions session
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and session.status = 'aborted'
        having count(*) > 0
        union all
        select 'exercise_skipped', 'Übungen ausgelassen', count(*)
        from public.athlete_training_session_items item
        join public.athlete_training_sessions session on session.id = item.session_id
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and item.status = 'skipped'
        having count(*) > 0
        union all
        select 'exercise_aborted', 'Übungen abgebrochen', count(*)
        from public.athlete_training_session_items item
        join public.athlete_training_sessions session on session.id = item.session_id
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and item.status = 'aborted'
        having count(*) > 0
        union all
        select 'pain_mild', 'Leichte Beschwerden', count(*)
        from public.athlete_training_session_items item
        join public.athlete_training_sessions session on session.id = item.session_id
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and item.pain_level = 'mild'
        having count(*) > 0
        union all
        select 'pain_strong', 'Starke Beschwerden', count(*)
        from public.athlete_training_session_items item
        join public.athlete_training_sessions session on session.id = item.session_id
        where session.organization_id = p_organization_id
          and session.athlete_id = p_athlete_id
          and session.training_date between v_date_from and v_date_to
          and item.pain_level = 'strong'
        having count(*) > 0
      ) reason
    ), '[]'::jsonb)
  );
end;
$$;

-- Ergänzt die bestehende Trainingsplan-Wochenübersicht um den Dokumentationsstatus.
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
    or public.has_module_access(p_organization_id, 'training_documentation', false)
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
          ),
          'session_id', session.id,
          'documentation_status', coalesce(session.status, 'not_started'),
          'actual_minutes', session.actual_minutes,
          'overall_rpe', session.overall_rpe,
          'completed_exercise_count', coalesce((
            select count(*)
            from public.athlete_training_session_items session_item
            where session_item.session_id = session.id
              and session_item.status <> 'planned'
          ), 0)
        )
        order by plan.training_date, plan.athlete_id
      )
      from public.athlete_training_plans plan
      left join public.athlete_training_sessions session
        on session.plan_id = plan.id
       and session.organization_id = plan.organization_id
      where plan.organization_id = p_organization_id
        and plan.group_id = v_group_id
        and plan.training_date between v_week_start and v_week_end
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.can_access_training_documentation_session(uuid, uuid, boolean) from public;
revoke all on function public.training_documentation_overview(uuid, date, uuid, uuid) from public;
revoke all on function public.training_documentation_detail(uuid, uuid) from public;
revoke all on function public.start_training_documentation(uuid, uuid) from public;
revoke all on function public.save_training_documentation(uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb) from public;
revoke all on function public.register_training_documentation_media(uuid, uuid, uuid, text, text, text, bigint) from public;
revoke all on function public.delete_training_documentation_media(uuid, uuid) from public;
revoke all on function public.training_documentation_statistics(uuid, uuid, date, date) from public;
revoke all on function public.training_plan_week_overview(uuid, date, uuid) from public;

grant execute on function public.can_access_training_documentation_session(uuid, uuid, boolean) to authenticated;
grant execute on function public.training_documentation_overview(uuid, date, uuid, uuid) to authenticated;
grant execute on function public.training_documentation_detail(uuid, uuid) to authenticated;
grant execute on function public.start_training_documentation(uuid, uuid) to authenticated;
grant execute on function public.save_training_documentation(uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb) to authenticated;
grant execute on function public.register_training_documentation_media(uuid, uuid, uuid, text, text, text, bigint) to authenticated;
grant execute on function public.delete_training_documentation_media(uuid, uuid) to authenticated;
grant execute on function public.training_documentation_statistics(uuid, uuid, date, date) to authenticated;
grant execute on function public.training_plan_week_overview(uuid, date, uuid) to authenticated;

commit;
