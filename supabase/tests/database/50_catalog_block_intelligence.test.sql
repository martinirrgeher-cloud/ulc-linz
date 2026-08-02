begin;

select plan(16);

select ok(
  to_regclass('public.exercise_similarities') is not null,
  'Aehnliche Uebungen werden in einer eigenen Tabelle gespeichert'
);

select ok(
  to_regclass('public.training_block_user_favorites') is not null,
  'Trainingsblock-Favoriten werden benutzerbezogen gespeichert'
);

select ok(
  to_regclass('public.training_block_versions') is not null,
  'Trainingsblock-Versionen werden dauerhaft gespeichert'
);

select is(
  (
    select count(*)::bigint
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name in ('difficulty_key', 'normalized_name')
  ),
  2::bigint,
  'Uebungen besitzen Schwierigkeitsgrad und normalisierten Namen'
);

select is(
  (
    select count(*)::bigint
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'training_blocks'
      and column_name in ('variant_parent_id', 'variant_root_id', 'variant_number')
  ),
  3::bigint,
  'Trainingsbloecke besitzen eine nachvollziehbare Variantenstruktur'
);

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'public.normalize_catalog_name(text)',
      'public.exercise_catalog_overview_v3(uuid,boolean)',
      'public.exercise_duplicate_candidates(uuid,uuid,text,integer)',
      'public.save_exercise_catalog_item_v4(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb,text,uuid[],uuid,timestamp with time zone)',
      'public.capture_training_block_version(uuid,uuid,text)',
      'public.training_block_overview_v3(uuid,boolean)',
      'public.save_training_block_v3(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb,uuid,timestamp with time zone)',
      'public.create_training_block_variant(uuid,uuid)',
      'public.set_training_block_favorite(uuid,uuid,boolean)'
    ]) as signature
    where to_regprocedure(signature) is not null
  ),
  9::bigint,
  'Alle E5-Katalog- und Blockfunktionen sind vorhanden'
);

select is(
  (
    select count(*)::bigint
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'exercise_similarities',
        'training_block_user_favorites',
        'training_block_versions'
      )
      and relation.relrowsecurity
  ),
  3::bigint,
  'Alle neuen E5-Tabellen sind durch RLS geschuetzt'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'training_block_user_favorites'
  ),
  'Favoritenaenderungen koennen auf mehreren Geraeten aktualisiert werden'
);

select is(
  (
    select relation.relreplident::text
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'training_block_user_favorites'
  ),
  'f'::text,
  'Favoriten liefern bei Realtime-Aenderungen den vollstaendigen Datensatz'
);

select is(
  public.normalize_catalog_name('  Sprint – Ähnlich  '),
  'sprintahnlich',
  'Uebungsnamen werden fuer die Dublettenerkennung stabil normalisiert'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.organization_dropdown_options'::regclass
      and constraint_definition.contype = 'c'
      and pg_get_constraintdef(constraint_definition.oid) like '%difficulty%'
  ),
  'Schwierigkeitsgrad ist als gepflegte Auswahlliste zugelassen'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.exercise_catalog_overview_v3(uuid,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.exercise_duplicate_candidates(uuid,uuid,text,integer)',
    'EXECUTE'
  ),
  'Authentifizierte Benutzer koennen Katalog und Dublettenhinweise lesen'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_exercise_catalog_item_v4(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb,text,uuid[],uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'Berechtigte Benutzer koennen E5-Uebungsdaten ueber die geschuetzte RPC speichern'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.training_block_overview_v3(uuid,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.save_training_block_v3(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'Authentifizierte Benutzer koennen E5-Trainingsbloecke lesen und berechtigt speichern'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_training_block_variant(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.set_training_block_favorite(uuid,uuid,boolean)',
    'EXECUTE'
  ),
  'Varianten und Favoriten sind nur ueber die vorgesehenen RPCs erreichbar'
);

select ok(
  exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = 'public.training_block_versions'::regclass
      and attribute.attname = 'snapshot'
      and attribute.attnotnull
      and not attribute.attisdropped
  ),
  'Jede Blockversion enthaelt einen unveraenderlichen Snapshot'
);

select * from finish();
rollback;
