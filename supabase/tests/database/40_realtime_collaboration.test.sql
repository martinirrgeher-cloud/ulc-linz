begin;

select plan(4);

with required_tables(table_name) as (
  values
    ('athletes'),
    ('training_groups'),
    ('trainers'),
    ('exercises'),
    ('training_blocks'),
    ('athlete_training_plans'),
    ('athlete_training_sessions')
)
select is(
  (
    select count(*)::bigint
    from required_tables required
    join pg_publication_tables published
      on published.pubname = 'supabase_realtime'
     and published.schemaname = 'public'
     and published.tablename = required.table_name
  ),
  7::bigint,
  'Alle E4-Kerntabellen sind fuer Supabase Realtime veroeffentlicht'
);

with required_tables(table_name) as (
  values
    ('athletes'),
    ('training_groups'),
    ('trainers'),
    ('exercises'),
    ('training_blocks'),
    ('athlete_training_plans'),
    ('athlete_training_sessions')
)
select is(
  (
    select count(*)::bigint
    from required_tables required
    join pg_class relation on relation.relname = required.table_name
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relreplident = 'f'
  ),
  7::bigint,
  'Realtime-Kerntabellen liefern bei Aenderungen den vollstaendigen Datensatzschluessel'
);

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'exercise',
      'training_block',
      'athlete',
      'training_plan',
      'training_documentation',
      'training_group',
      'trainer'
    ]) as entity_type
    where public.edit_lock_module_key(entity_type) is not null
  ),
  7::bigint,
  'Alle gemeinsam bearbeiteten E4-Datensatztypen besitzen eine Modulzuordnung'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.acquire_edit_lock(uuid,text,uuid,uuid,boolean,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.assert_edit_lock(uuid,text,uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  'Authentifizierte Benutzer koennen Sperre und Version vor dem Schreiben pruefen'
);

select * from finish();
rollback;
