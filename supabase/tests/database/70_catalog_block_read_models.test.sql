begin;

select plan(15);

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'public.exercise_catalog_overview_v4(uuid,boolean)',
      'public.exercise_usage_overview(uuid,uuid)',
      'public.training_block_overview_v4(uuid,boolean)',
      'public.training_block_versions_overview(uuid,uuid)'
    ]) as signature
    where to_regprocedure(signature) is not null
  ),
  4::bigint,
  'Alle P2a-Lesefunktionen sind vorhanden'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.exercise_catalog_overview_v4(uuid,boolean)',
    'EXECUTE'
  ),
  'Authentifizierte Benutzer koennen die schlanke Uebungsuebersicht lesen'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.training_block_overview_v4(uuid,boolean)',
    'EXECUTE'
  ),
  'Authentifizierte Benutzer koennen die schlanke Blockuebersicht lesen'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.exercise_usage_overview(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.training_block_versions_overview(uuid,uuid)',
    'EXECUTE'
  ),
  'Bedarfsgesteuerte Detailfunktionen sind fuer authentifizierte Benutzer freigegeben'
);

select ok(
  not has_function_privilege(
    'public',
    'public.exercise_catalog_overview_v4(uuid,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'public',
    'public.exercise_usage_overview(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'public',
    'public.training_block_overview_v4(uuid,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'public',
    'public.training_block_versions_overview(uuid,uuid)',
    'EXECUTE'
  ),
  'P2a-Lesefunktionen sind nicht allgemein oeffentlich ausfuehrbar'
);

select is(
  (
    select count(*)::bigint
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'exercise_catalog_overview_v4',
        'exercise_usage_overview',
        'training_block_overview_v4',
        'training_block_versions_overview'
      )
      and procedure.prosecdef
  ),
  4::bigint,
  'Alle P2a-Lesefunktionen pruefen Rechte als SECURITY DEFINER'
);

select is(
  (
    select count(*)::bigint
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'exercise_catalog_overview_v4',
        'exercise_usage_overview',
        'training_block_overview_v4',
        'training_block_versions_overview'
      )
      and procedure.provolatile = 's'
  ),
  4::bigint,
  'Alle P2a-Lesefunktionen sind als STABLE markiert'
);

select is(
  (
    select count(*)::bigint
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'exercise_catalog_overview_v4',
        'exercise_usage_overview',
        'training_block_overview_v4',
        'training_block_versions_overview'
      )
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, '{}'::text[])) setting
        where setting like 'search_path=%'
      )
  ),
  4::bigint,
  'Alle P2a-Lesefunktionen verwenden einen festen leeren search_path'
);

select ok(
  position(
    'block_usage_count'
    in pg_get_functiondef('public.exercise_catalog_overview_v4(uuid,boolean)'::regprocedure)
  ) > 0,
  'Die Uebungsuebersicht liefert nur die Blockanzahl'
);

select ok(
  position(
    'plan_usage_count'
    in pg_get_functiondef('public.exercise_catalog_overview_v4(uuid,boolean)'::regprocedure)
  ) > 0,
  'Die Uebungsuebersicht liefert nur die Plananzahl'
);

select ok(
  position(
    'block_usages'
    in pg_get_functiondef('public.exercise_catalog_overview_v4(uuid,boolean)'::regprocedure)
  ) = 0,
  'Die Uebungsuebersicht aggregiert keine detaillierten Blockverwendungen mehr'
);

select ok(
  position(
    'version_count'
    in pg_get_functiondef('public.training_block_overview_v4(uuid,boolean)'::regprocedure)
  ) > 0
  and position(
    'latest_version'
    in pg_get_functiondef('public.training_block_overview_v4(uuid,boolean)'::regprocedure)
  ) > 0,
  'Die Blockuebersicht liefert Versionsanzahl und letzte Version'
);

select ok(
  position(
    'version.snapshot'
    in pg_get_functiondef('public.training_block_overview_v4(uuid,boolean)'::regprocedure)
  ) = 0,
  'Die Blockuebersicht laedt keine Versions-Snapshots vorab'
);

select ok(
  position(
    'block_usages'
    in pg_get_functiondef('public.exercise_usage_overview(uuid,uuid)'::regprocedure)
  ) > 0
  and position(
    'plan_usages'
    in pg_get_functiondef('public.exercise_usage_overview(uuid,uuid)'::regprocedure)
  ) > 0,
  'Verwendungsdetails werden ueber eine eigene Funktion geladen'
);

select ok(
  position(
    'version.snapshot'
    in pg_get_functiondef('public.training_block_versions_overview(uuid,uuid)'::regprocedure)
  ) > 0,
  'Versions-Snapshots werden nur ueber die Detailfunktion geladen'
);

select * from finish();
rollback;
