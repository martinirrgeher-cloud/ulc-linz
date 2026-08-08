begin;

select plan(12);

select is(
  (
    select count(*)::bigint
    from public.app_modules
    where key in ('kindertraining_statistics', 'u12_statistics', 'u14_statistics')
      and not is_active
  ),
  3::bigint,
  'Separate Statistikmodule sind deaktiviert'
);

select is(
  (
    select count(*)::bigint
    from public.member_module_permissions
    where module_key in ('kindertraining_statistics', 'u12_statistics', 'u14_statistics')
  ),
  0::bigint,
  'Separate Statistikrechte wurden aus den Benutzerrechten entfernt'
);

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'public.can_read_kindertraining_statistics(uuid)',
      'public.can_edit_kindertraining_statistics(uuid)',
      'public.can_read_training_module_statistics(uuid,text)',
      'public.can_edit_training_module_statistics(uuid,text)'
    ]) as signature
    where to_regprocedure(signature) is not null
  ),
  4::bigint,
  'Alle Statistik-Rechtefunktionen sind vorhanden'
);

select ok(
  (
    select position('kindertraining_statistics' in procedure.prosrc) = 0
      and position('kindertraining' in procedure.prosrc) > 0
    from pg_proc procedure
    where procedure.oid = 'public.can_read_kindertraining_statistics(uuid)'::regprocedure
  ),
  'Kindertraining-Statistik liest ausschliesslich das Kindertraining-Recht'
);

select ok(
  (
    select position('kindertraining_statistics' in procedure.prosrc) = 0
      and position('kindertraining' in procedure.prosrc) > 0
    from pg_proc procedure
    where procedure.oid = 'public.can_edit_kindertraining_statistics(uuid)'::regprocedure
  ),
  'Kindertraining-Statistik bearbeitet ausschliesslich mit Kindertraining-Recht'
);

select ok(
  (
    select position('_statistics' in procedure.prosrc) = 0
      and position('p_module_key' in procedure.prosrc) > 0
    from pg_proc procedure
    where procedure.oid = 'public.can_read_training_module_statistics(uuid,text)'::regprocedure
  ),
  'U12/U14-Statistik liest ausschliesslich das jeweilige Trainingsmodul-Recht'
);

select ok(
  (
    select position('_statistics' in procedure.prosrc) = 0
      and position('p_module_key' in procedure.prosrc) > 0
    from pg_proc procedure
    where procedure.oid = 'public.can_edit_training_module_statistics(uuid,text)'::regprocedure
  ),
  'U12/U14-Statistik bearbeitet ausschliesslich mit dem jeweiligen Trainingsmodul-Recht'
);

select is(
  (
    select count(*)::bigint
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'can_read_kindertraining_statistics',
        'can_edit_kindertraining_statistics',
        'can_read_training_module_statistics',
        'can_edit_training_module_statistics'
      )
      and procedure.prosecdef
  ),
  4::bigint,
  'Alle Statistik-Rechtefunktionen sind SECURITY DEFINER'
);

select is(
  (
    select count(*)::bigint
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'can_read_kindertraining_statistics',
        'can_edit_kindertraining_statistics',
        'can_read_training_module_statistics',
        'can_edit_training_module_statistics'
      )
      and procedure.provolatile = 's'
  ),
  4::bigint,
  'Alle Statistik-Rechtefunktionen sind STABLE'
);

select is(
  (
    select count(*)::bigint
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'can_read_kindertraining_statistics',
        'can_edit_kindertraining_statistics',
        'can_read_training_module_statistics',
        'can_edit_training_module_statistics'
      )
      and exists (
        select 1
        from unnest(coalesce(procedure.proconfig, '{}'::text[])) setting
        where setting like 'search_path=%'
      )
  ),
  4::bigint,
  'Alle Statistik-Rechtefunktionen verwenden einen festen search_path'
);

select ok(
  has_function_privilege('authenticated', 'public.can_read_kindertraining_statistics(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.can_edit_kindertraining_statistics(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.can_read_training_module_statistics(uuid,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.can_edit_training_module_statistics(uuid,text)', 'EXECUTE'),
  'Authentifizierte Benutzer behalten die erforderlichen Ausfuehrungsrechte'
);

select ok(
  not has_function_privilege('public', 'public.can_read_kindertraining_statistics(uuid)', 'EXECUTE')
  and not has_function_privilege('public', 'public.can_edit_kindertraining_statistics(uuid)', 'EXECUTE')
  and not has_function_privilege('public', 'public.can_read_training_module_statistics(uuid,text)', 'EXECUTE')
  and not has_function_privilege('public', 'public.can_edit_training_module_statistics(uuid,text)', 'EXECUTE'),
  'Statistik-Rechtefunktionen bleiben fuer public gesperrt'
);

select * from finish();
rollback;
