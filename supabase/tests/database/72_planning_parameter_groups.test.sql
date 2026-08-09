begin;

select plan(5);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_dropdown_options'
      and column_name = 'parameter_group'
      and is_nullable = 'NO'
  ),
  'Planungsparameter besitzen eine persistente Parametergruppe'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.organization_dropdown_options'::regclass
      and constraint_definition.conname = 'organization_dropdown_options_parameter_group_check'
      and pg_get_constraintdef(constraint_definition.oid) like '%distance_geometry%'
      and pg_get_constraintdef(constraint_definition.oid) like '%time_recovery%'
  ),
  'Die erlaubten Parametergruppen werden in der Datenbank begrenzt'
);

select ok(
  to_regprocedure('public.save_dropdown_setting(uuid,text,uuid,text,text,text,text,numeric,integer,text)') is not null,
  'Auswahllisten speichern die Parametergruppe ueber die bestehende RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_dropdown_setting(uuid,text,uuid,text,text,text,text,numeric,integer,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'public',
    'public.save_dropdown_setting(uuid,text,uuid,text,text,text,text,numeric,integer,text)',
    'EXECUTE'
  ),
  'Die erweiterte Speicher-RPC behaelt ihre Zugriffsbeschraenkung'
);

select ok(
  exists (
    select 1
    from pg_trigger trigger_definition
    where trigger_definition.tgrelid = 'public.organizations'::regclass
      and trigger_definition.tgname = 'organizations_seed_planning_parameters'
      and not trigger_definition.tgisinternal
  ),
  'Neue Organisationen erhalten gruppierte Standardparameter'
);

select * from finish();
rollback;
