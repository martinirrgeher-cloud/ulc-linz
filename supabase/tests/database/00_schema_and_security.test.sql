begin;

select plan(26);

select is(
  (
    select count(*)::bigint
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  0::bigint,
  'Alle öffentlichen Tabellen haben Row Level Security aktiviert'
);

select is(
  (
    select count(*)::bigint
    from pg_proc function_row
    join pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public'
      and function_row.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(function_row.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      )
  ),
  0::bigint,
  'Alle SECURITY-DEFINER-Funktionen setzen einen festen search_path'
);

select ok(
  not has_table_privilege('authenticated', 'public.edit_locks', 'SELECT'),
  'authenticated kann edit_locks nicht direkt lesen'
);
select ok(
  not has_table_privilege('authenticated', 'public.edit_locks', 'INSERT'),
  'authenticated kann edit_locks nicht direkt schreiben'
);
select ok(
  not has_table_privilege('authenticated', 'public.data_import_runs', 'SELECT'),
  'authenticated kann data_import_runs nicht direkt lesen'
);
select ok(
  not has_table_privilege('authenticated', 'public.data_import_runs', 'INSERT'),
  'authenticated kann data_import_runs nicht direkt schreiben'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_exercise_catalog_item_v3(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'Der atomare Übungsspeicher ist für authenticated freigegeben'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_training_block_v2(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'Der atomare Trainingsblockspeicher ist für authenticated freigegeben'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.update_athlete_v4(uuid,uuid,text,text,integer,text,boolean,uuid[],jsonb,uuid,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'Der atomare Athletenspeicher ist für authenticated freigegeben'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_athlete_training_plan_v2(uuid,uuid,uuid,uuid,date,text,text,jsonb,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'Der atomare Trainingsplanspeicher ist für authenticated freigegeben'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_training_documentation_v3(uuid,uuid,text,integer,integer,integer,text,text,text,text,jsonb,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'Der gesperrte Dokumentationsspeicher ist für authenticated freigegeben'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_exercise_import_v1(uuid,uuid,jsonb,jsonb)',
    'EXECUTE'
  ),
  'Der transaktionale Übungsimport ist für authenticated freigegeben'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_athlete_import_v1(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'Der transaktionale Athletenimport ist für authenticated freigegeben'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_exercise_catalog_item(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb)',
    'EXECUTE'
  ),
  'Der alte Übungsspeicher ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_exercise_catalog_item_v2(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb)',
    'EXECUTE'
  ),
  'Der ungesperrte Übungsspeicher V2 ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_training_block(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb)',
    'EXECUTE'
  ),
  'Der alte Trainingsblockspeicher ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_athlete(uuid,uuid,text,text,integer,text,boolean,uuid[])',
    'EXECUTE'
  ),
  'Der alte Athletenspeicher ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_athlete_v2(uuid,uuid,text,text,integer,text,boolean,uuid[],jsonb)',
    'EXECUTE'
  ),
  'Der Athletenspeicher V2 ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_athlete_v3(uuid,uuid,text,text,integer,text,boolean,uuid[],jsonb,uuid)',
    'EXECUTE'
  ),
  'Der ungesperrte Athletenspeicher V3 ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_athlete_training_plan(uuid,uuid,uuid,uuid,date,text,text,jsonb)',
    'EXECUTE'
  ),
  'Der alte Trainingsplanspeicher ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_training_documentation(uuid,uuid,text,integer,integer,integer,text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  'Der alte Dokumentationsspeicher ist gesperrt'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_training_documentation_v2(uuid,uuid,text,integer,integer,integer,text,text,text,text,jsonb,timestamp with time zone)',
    'EXECUTE'
  ),
  'Der Dokumentationsspeicher V2 ist gesperrt'
);

select ok(
  exists(select 1 from storage.buckets where id = 'exercise-videos'),
  'Der Storage-Bucket exercise-videos existiert'
);
select ok(
  exists(select 1 from storage.buckets where id = 'training-documentation-media'),
  'Der Storage-Bucket training-documentation-media existiert'
);
select ok(
  exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace on namespace.oid = table_row.relnamespace
    where namespace.nspname = 'public'
      and table_row.relname = 'edit_locks'
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) like '%training_documentation%'
  ),
  'Die Bearbeitungssperre unterstützt Trainingsdokumentationen'
);
select ok(
  (
    select count(*)
    from supabase_migrations.schema_migrations
    where version = '202607300030'
  ) = 1,
  'Die E0-Konsolidierungsmigration wurde angewendet'
);

select * from finish();
rollback;
