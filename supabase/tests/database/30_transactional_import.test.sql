begin;

select plan(14);

create function public.e1a_capture_error(p_sql text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

revoke all on function public.e1a_capture_error(text) from public;
grant execute on function public.e1a_capture_error(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data)
values (
  '40000000-0000-0000-0000-000000000001',
  'admin-import-e1a@example.test',
  '{"display_name":"E1A Import Admin"}'
);

insert into public.organizations (id, name, slug)
values ('41000000-0000-0000-0000-000000000001', 'E1A Import Verein', 'e1a-import-verein');

insert into public.organization_members (id, organization_id, user_id, role, status)
values (
  '42000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'admin',
  'active'
);

insert into public.organization_exercise_categories (
  organization_id, category_key, title, sort_order, is_active
)
select
  '41000000-0000-0000-0000-000000000001',
  category.key,
  category.title,
  category.sort_order,
  true
from public.exercise_categories category;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (
    public.apply_exercise_import_v1(
      '41000000-0000-0000-0000-000000000001',
      '43000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'row_number', 1,
        'label', 'E1A Import Erfolg',
        'action', 'create',
        'values', jsonb_build_object(
          'name', 'E1A Import Erfolg',
          'category_label', 'Aufwärmen & Lauf-ABC',
          'subcategory', null,
          'goal', null,
          'description', null,
          'coaching_cues', null,
          'common_mistakes', null,
          'equipment', jsonb_build_array(),
          'video_url', null,
          'is_active', true,
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array()
        )
      )),
      '[]'::jsonb
    ) ->> 'created'
  )::integer,
  1,
  'Ein gültiger Import legt genau eine Übung an'
);
select is(
  (select count(*) from public.exercises where organization_id = '41000000-0000-0000-0000-000000000001' and name = 'E1A Import Erfolg'),
  1::bigint,
  'Die importierte Übung ist vorhanden'
);

select is(
  (
    public.apply_exercise_import_v1(
      '41000000-0000-0000-0000-000000000001',
      '43000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'row_number', 1,
        'label', 'E1A Import Erfolg',
        'action', 'create',
        'values', jsonb_build_object(
          'name', 'E1A Import Erfolg',
          'category_label', 'Aufwärmen & Lauf-ABC',
          'subcategory', null,
          'goal', null,
          'description', null,
          'coaching_cues', null,
          'common_mistakes', null,
          'equipment', jsonb_build_array(),
          'video_url', null,
          'is_active', true,
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array()
        )
      )),
      '[]'::jsonb
    ) ->> 'created'
  )::integer,
  1,
  'Eine identische Wiederholung liefert das gespeicherte Ergebnis'
);
select is(
  (select count(*) from public.exercises where organization_id = '41000000-0000-0000-0000-000000000001' and name = 'E1A Import Erfolg'),
  1::bigint,
  'Die identische Import-ID erzeugt keine Dublette'
);

select like(
  public.e1a_capture_error(format(
    'select public.apply_exercise_import_v1(%L::uuid,%L::uuid,%L::jsonb,%L::jsonb)',
    '41000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'row_number', 1,
      'label', 'Andere Daten',
      'action', 'skip',
      'skip_message', 'Test'
    ))::text,
    '[]'
  )),
  '%bereits für andere Importdaten verwendet%',
  'Dieselbe Import-ID wird für abweichende Daten abgelehnt'
);

select like(
  public.e1a_capture_error(format(
    'select public.apply_exercise_import_v1(%L::uuid,%L::uuid,%L::jsonb,%L::jsonb)',
    '41000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000002',
    jsonb_build_array(
      jsonb_build_object(
        'row_number', 1,
        'label', 'E1A Rollback gültig',
        'action', 'create',
        'values', jsonb_build_object(
          'name', 'E1A Rollback gültig',
          'category_label', 'Aufwärmen & Lauf-ABC',
          'equipment', jsonb_build_array(),
          'is_active', true,
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array()
        )
      ),
      jsonb_build_object(
        'row_number', 2,
        'label', 'E1A Rollback ungültig',
        'action', 'create',
        'values', jsonb_build_object(
          'name', 'E1A Rollback ungültig',
          'category_label', 'Nicht vorhandene Kategorie',
          'equipment', jsonb_build_array(),
          'is_active', true,
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array()
        )
      )
    )::text,
    jsonb_build_array(jsonb_build_object(
      'list_key', 'material',
      'option_key', 'e1a_rollback_material',
      'label', 'E1A Rollback Material',
      'sort_order', 10
    ))::text
  )),
  '%wurde nicht gefunden oder ist inaktiv%',
  'Ein Fehler in einer späteren Zeile bricht den gesamten Import ab'
);
select is(
  (select count(*) from public.exercises where organization_id = '41000000-0000-0000-0000-000000000001' and name = 'E1A Rollback gültig'),
  0::bigint,
  'Eine vorherige gültige Zeile wird bei Fehler zurückgerollt'
);
select is(
  (select count(*) from public.organization_dropdown_options where organization_id = '41000000-0000-0000-0000-000000000001' and option_key = 'e1a_rollback_material'),
  0::bigint,
  'Auch automatisch angelegte Auswahllistenwerte werden zurückgerollt'
);
reset role;
select is(
  (select count(*) from public.data_import_runs where organization_id = '41000000-0000-0000-0000-000000000001' and import_id = '43000000-0000-0000-0000-000000000002'),
  0::bigint,
  'Ein fehlgeschlagener Import erzeugt keinen Importlauf'
);

insert into public.exercises (
  id, organization_id, name, category_key, is_active
)
values (
  '44000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  'E1A Gesperrte Übung',
  'warmup',
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select ok(
  (public.acquire_edit_lock(
    '41000000-0000-0000-0000-000000000001',
    'exercise',
    '44000000-0000-0000-0000-000000000001',
    '45000000-0000-0000-0000-000000000001',
    false,
    120
  ) ->> 'acquired')::boolean,
  'Die bestehende Übung wird für den Lock-Test reserviert'
);

select like(
  public.e1a_capture_error(format(
    'select public.apply_exercise_import_v1(%L::uuid,%L::uuid,%L::jsonb,%L::jsonb)',
    '41000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000003',
    jsonb_build_array(
      jsonb_build_object(
        'row_number', 1,
        'label', 'E1A Gesperrte Übung',
        'action', 'update',
        'existing_id', '44000000-0000-0000-0000-000000000001',
        'expected_updated_at', (select updated_at from public.exercises where id = '44000000-0000-0000-0000-000000000001'),
        'values', jsonb_build_object(
          'name', 'E1A Gesperrte Übung geändert',
          'category_label', 'Aufwärmen & Lauf-ABC',
          'equipment', jsonb_build_array(),
          'is_active', true,
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array()
        )
      ),
      jsonb_build_object(
        'row_number', 2,
        'label', 'E1A Darf nicht entstehen',
        'action', 'create',
        'values', jsonb_build_object(
          'name', 'E1A Darf nicht entstehen',
          'category_label', 'Aufwärmen & Lauf-ABC',
          'equipment', jsonb_build_array(),
          'is_active', true,
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array()
        )
      )
    )::text,
    '[]'
  )),
  '%wird gerade durch%',
  'Eine aktive Bearbeitungssperre bricht den gesamten Import ab'
);
select is(
  (select name from public.exercises where id = '44000000-0000-0000-0000-000000000001'),
  'E1A Gesperrte Übung',
  'Die gesperrte Übung bleibt unverändert'
);
select is(
  (select count(*) from public.exercises where organization_id = '41000000-0000-0000-0000-000000000001' and name = 'E1A Darf nicht entstehen'),
  0::bigint,
  'Weitere Importzeilen werden bei einer Sperre nicht ausgeführt'
);
reset role;
select is(
  (select count(*) from public.data_import_runs where organization_id = '41000000-0000-0000-0000-000000000001' and import_id = '43000000-0000-0000-0000-000000000003'),
  0::bigint,
  'Ein wegen Sperre abgebrochener Import wird nicht als erfolgreich gespeichert'
);

select * from finish();
rollback;
