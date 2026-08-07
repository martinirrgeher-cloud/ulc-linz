begin;

select plan(11);

create function public.exercise_import_v2_capture_error(p_sql text)
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

revoke all on function public.exercise_import_v2_capture_error(text) from public;
grant execute on function public.exercise_import_v2_capture_error(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data)
values (
  '46000000-0000-0000-0000-000000000001',
  'admin-import-v2@example.test',
  '{"display_name":"Import v2 Admin"}'
);

insert into public.organizations (id, name, slug)
values ('46100000-0000-0000-0000-000000000001', 'Import v2 Verein', 'import-v2-verein');

insert into public.organization_members (id, organization_id, user_id, role, status)
values (
  '46200000-0000-0000-0000-000000000001',
  '46100000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000001',
  'admin',
  'active'
);

insert into public.organization_exercise_categories (
  organization_id, category_key, title, sort_order, is_active
)
select
  '46100000-0000-0000-0000-000000000001',
  category.key,
  category.title,
  category.sort_order,
  true
from public.exercise_categories category
on conflict (organization_id, category_key) do nothing;

insert into public.exercises (
  id, organization_id, name, category_key, is_active
) values (
  '46300000-0000-0000-0000-000000000001',
  '46100000-0000-0000-0000-000000000001',
  'Import v2 Bezug',
  'warmup',
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"46000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (
    public.apply_exercise_import_v2(
      '46100000-0000-0000-0000-000000000001',
      '46400000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'row_number', 2,
        'label', 'Import v2 Hauptübung',
        'action', 'create',
        'values', jsonb_build_object(
          'name', 'Import v2 Hauptübung',
          'category_label', 'Aufwärmen & Lauf-ABC',
          'difficulty_label', 'Mittel',
          'equipment', jsonb_build_array(),
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array(),
          'similar_exercise_refs', jsonb_build_array(jsonb_build_object(
            'id', '46300000-0000-0000-0000-000000000001',
            'name', 'Import v2 Bezug'
          )),
          'is_active', true
        )
      )),
      '[]'::jsonb
    ) ->> 'created'
  )::integer,
  1,
  'Import v2 legt eine Übung an'
);

reset role;

select is(
  (
    select difficulty_key
    from public.exercises
    where organization_id = '46100000-0000-0000-0000-000000000001'
      and name = 'Import v2 Hauptübung'
  ),
  'medium',
  'Schwierigkeitsgrad wird aus dem aktuellen Dropdown übernommen'
);

select is(
  (
    select count(*)
    from public.exercise_similarities similarity
    join public.exercises exercise on exercise.id = similarity.exercise_id or exercise.id = similarity.related_exercise_id
    where similarity.organization_id = '46100000-0000-0000-0000-000000000001'
      and exercise.name = 'Import v2 Hauptübung'
  ),
  1::bigint,
  'Ähnliche Übung wird gespeichert'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"46000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (
    public.apply_exercise_import_v2(
      '46100000-0000-0000-0000-000000000001',
      '46400000-0000-0000-0000-000000000002',
      jsonb_build_array(
        jsonb_build_object(
          'row_number', 2,
          'label', 'Import v2 Paar A',
          'action', 'create',
          'values', jsonb_build_object(
            'name', 'Import v2 Paar A',
            'category_label', 'Aufwärmen & Lauf-ABC',
            'equipment', jsonb_build_array(),
            'group_ids', jsonb_build_array(),
            'parameters', jsonb_build_array(),
            'similar_exercise_refs', jsonb_build_array(jsonb_build_object('id', null, 'name', 'Import v2 Paar B')),
            'is_active', true
          )
        ),
        jsonb_build_object(
          'row_number', 3,
          'label', 'Import v2 Paar B',
          'action', 'create',
          'values', jsonb_build_object(
            'name', 'Import v2 Paar B',
            'category_label', 'Aufwärmen & Lauf-ABC',
            'equipment', jsonb_build_array(),
            'group_ids', jsonb_build_array(),
            'parameters', jsonb_build_array(),
            'similar_exercise_refs', jsonb_build_array(),
            'is_active', true
          )
        )
      ),
      '[]'::jsonb
    ) ->> 'created'
  )::integer,
  2,
  'Zwei neue Übungen können im selben Import angelegt werden'
);
reset role;

select is(
  (
    select count(*)
    from public.exercise_similarities similarity
    join public.exercises left_exercise on left_exercise.id = similarity.exercise_id
    join public.exercises right_exercise on right_exercise.id = similarity.related_exercise_id
    where similarity.organization_id = '46100000-0000-0000-0000-000000000001'
      and array[left_exercise.name, right_exercise.name] @> array['Import v2 Paar A', 'Import v2 Paar B']::text[]
  ),
  1::bigint,
  'Einseitig angegebene Ähnlichkeit innerhalb derselben Datei wird symmetrisch gespeichert'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"46000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (
    public.apply_exercise_import_v2(
      '46100000-0000-0000-0000-000000000001',
      '46400000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object(
        'row_number', 2,
        'label', 'Import v2 neue Schwierigkeit',
        'action', 'create',
        'values', jsonb_build_object(
          'name', 'Import v2 neue Schwierigkeit',
          'category_label', 'Aufwärmen & Lauf-ABC',
          'difficulty_label', 'Import Spezial',
          'equipment', jsonb_build_array(),
          'group_ids', jsonb_build_array(),
          'parameters', jsonb_build_array(),
          'similar_exercise_refs', jsonb_build_array(),
          'is_active', true
        )
      )),
      jsonb_build_array(jsonb_build_object(
        'list_key', 'difficulty',
        'label', 'Import Spezial',
        'sort_order', 90
      ))
    ) ->> 'created'
  )::integer,
  1,
  'Fehlender Schwierigkeitsgrad kann transaktional angelegt werden'
);
reset role;

select is(
  (
    select count(*)
    from public.organization_dropdown_options
    where organization_id = '46100000-0000-0000-0000-000000000001'
      and list_key = 'difficulty'
      and label = 'Import Spezial'
  ),
  1::bigint,
  'Neuer Schwierigkeitsgrad ist in den Stammdaten vorhanden'
);

select ok(
  (
    select difficulty_key is not null
    from public.exercises
    where organization_id = '46100000-0000-0000-0000-000000000001'
      and name = 'Import v2 neue Schwierigkeit'
  ),
  'Neu angelegter Schwierigkeitsgrad wird an die Übung gebunden'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '46000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"46000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select alike(
  public.exercise_import_v2_capture_error(format(
    'select public.apply_exercise_import_v2(%L::uuid,%L::uuid,%L::jsonb,%L::jsonb)',
    '46100000-0000-0000-0000-000000000001',
    '46400000-0000-0000-0000-000000000004',
    jsonb_build_array(jsonb_build_object(
      'row_number', 2,
      'label', 'Import v2 Rollback',
      'action', 'create',
      'values', jsonb_build_object(
        'name', 'Import v2 Rollback',
        'category_label', 'Aufwärmen & Lauf-ABC',
        'equipment', jsonb_build_array(),
        'group_ids', jsonb_build_array(),
        'parameters', jsonb_build_array(),
        'similar_exercise_refs', jsonb_build_array(jsonb_build_object('id', null, 'name', 'Nicht vorhanden')),
        'is_active', true
      )
    ))::text,
    jsonb_build_array(jsonb_build_object(
      'list_key', 'material',
      'label', 'Rollback Material v2',
      'sort_order', 100
    ))::text
  )),
  '%Ähnliche Übung „Nicht vorhanden“ wurde nicht gefunden%',
  'Ungültige ähnliche Übung bricht den gesamten Import ab'
);
reset role;

select is(
  (select count(*) from public.exercises where organization_id = '46100000-0000-0000-0000-000000000001' and name = 'Import v2 Rollback'),
  0::bigint,
  'Fehler im zweiten Durchlauf rollt auch bereits gespeicherte Übungsdaten zurück'
);

select is(
  (select count(*) from public.organization_dropdown_options where organization_id = '46100000-0000-0000-0000-000000000001' and label = 'Rollback Material v2'),
  0::bigint,
  'Auch automatisch angelegte Auswahllistenwerte werden bei Beziehungsfehler zurückgerollt'
);

select * from finish();
rollback;
