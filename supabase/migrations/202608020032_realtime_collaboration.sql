-- E4: Realtime-Datenabgleich fuer gemeinsam bearbeitete Kerndatensaetze.
-- Die Sperr- und Versionspruefung bleibt in den bestehenden atomaren Schreib-RPCs.
-- Diese Migration stellt nur die fuer E4b benoetigten Aenderungsereignisse bereit.

do $$
declare
  v_table text;
  v_tables constant text[] := array[
    'athletes',
    'training_groups',
    'trainers',
    'exercises',
    'training_blocks',
    'athlete_training_plans',
    'athlete_training_sessions'
  ];
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'Die Supabase-Realtime-Publication fehlt.';
  end if;

  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Realtime-Tabelle fehlt: public.%', v_table;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;

    execute format(
      'alter table public.%I replica identity full',
      v_table
    );
  end loop;
end;
$$;
