-- ULC Linz App – Paket A: schreibgeschützte Prüfung des produktiven Schemas
-- Diese Datei verändert keine Daten. Sie kann im Supabase SQL Editor ausgeführt werden.

with required_objects(kind, object_name, is_present) as (
  values
    ('Tabelle', 'organization_exercise_categories', to_regclass('public.organization_exercise_categories') is not null),
    ('Tabelle', 'organization_dropdown_options', to_regclass('public.organization_dropdown_options') is not null),
    ('Tabelle', 'training_block_usages', to_regclass('public.training_block_usages') is not null),
    ('Tabelle', 'athlete_training_plans', to_regclass('public.athlete_training_plans') is not null),
    ('Tabelle', 'athlete_training_plan_sections', to_regclass('public.athlete_training_plan_sections') is not null),
    ('Tabelle', 'athlete_training_plan_items', to_regclass('public.athlete_training_plan_items') is not null),
    ('Tabelle', 'athlete_training_sessions', to_regclass('public.athlete_training_sessions') is not null),
    ('Tabelle', 'athlete_training_session_sections', to_regclass('public.athlete_training_session_sections') is not null),
    ('Tabelle', 'athlete_training_session_items', to_regclass('public.athlete_training_session_items') is not null),
    ('Tabelle', 'athlete_training_session_sets', to_regclass('public.athlete_training_session_sets') is not null),
    ('Tabelle', 'athlete_training_session_media', to_regclass('public.athlete_training_session_media') is not null),
    ('Tabelle', 'edit_locks', to_regclass('public.edit_locks') is not null),
    ('Funktion', 'dropdown_settings_overview', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'dropdown_settings_overview')),
    ('Funktion', 'save_dropdown_setting', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'save_dropdown_setting')),
    ('Funktion', 'set_dropdown_setting_active', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'set_dropdown_setting_active')),
    ('Funktion', 'exercise_catalog_overview_v2', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'exercise_catalog_overview_v2')),
    ('Funktion', 'save_exercise_catalog_item_v2', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'save_exercise_catalog_item_v2')),
    ('Funktion', 'training_block_overview_v2', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_block_overview_v2')),
    ('Funktion', 'training_block_exercise_video_overview', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_block_exercise_video_overview')),
    ('Funktion', 'training_planning_overview', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_planning_overview')),
    ('Funktion', 'training_plan_detail', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_plan_detail')),
    ('Funktion', 'save_athlete_training_plan', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'save_athlete_training_plan')),
    ('Funktion', 'training_plan_week_overview', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_plan_week_overview')),
    ('Funktion', 'training_documentation_overview', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_documentation_overview')),
    ('Funktion', 'training_documentation_detail', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_documentation_detail')),
    ('Funktion', 'start_training_documentation', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'start_training_documentation')),
    ('Funktion', 'save_training_documentation', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'save_training_documentation')),
    ('Funktion', 'register_training_documentation_media', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'register_training_documentation_media')),
    ('Funktion', 'delete_training_documentation_media', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'delete_training_documentation_media')),
    ('Funktion', 'training_documentation_statistics', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'training_documentation_statistics')),
    ('Funktion', 'acquire_edit_lock', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'acquire_edit_lock')),
    ('Funktion', 'renew_edit_lock', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'renew_edit_lock')),
    ('Funktion', 'release_edit_lock', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'release_edit_lock')),
    ('Funktion', 'assert_edit_lock', exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'assert_edit_lock')),
    ('Storage-Bucket', 'exercise-videos', exists(select 1 from storage.buckets where id = 'exercise-videos')),
    ('Storage-Bucket', 'training-documentation-media', exists(select 1 from storage.buckets where id = 'training-documentation-media'))
)
select
  kind,
  object_name,
  case when is_present then 'OK' else 'FEHLT' end as status
from required_objects
order by
  case when is_present then 1 else 0 end,
  kind,
  object_name;
