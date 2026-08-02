begin;

select plan(20);

create function public.e5c3_capture_error(p_sql text)
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

revoke all on function public.e5c3_capture_error(text) from public;
grant execute on function public.e5c3_capture_error(text) to authenticated;

select has_table(
  'public',
  'organization_member_athlete_links',
  'Mehrfachverknuepfungen werden in einer eigenen Tabelle gespeichert'
);
select has_column(
  'public',
  'organization_member_athlete_links',
  'relation_type',
  'Selbst- und betreute Verknuepfungen sind unterscheidbar'
);
select has_function(
  'public',
  'admin_member_overview_v3',
  array['uuid'],
  'Benutzeruebersicht V3 liefert mehrere Athleten'
);
select has_function(
  'public',
  'admin_update_organization_member_v3',
  array['uuid', 'uuid', 'text', 'app_role', 'membership_status', 'jsonb', 'uuid[]', 'uuid', 'uuid', 'timestamp with time zone'],
  'Benutzeraenderung V3 speichert mehrere Athleten'
);
select ok(
  (
    select relation.relrowsecurity
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'organization_member_athlete_links'
  ),
  'Mehrfachverknuepfungen sind durch RLS geschuetzt'
);
select is(
  has_table_privilege('authenticated', 'public.organization_member_athlete_links', 'INSERT'),
  false,
  'Authentifizierte Benutzer koennen Verknuepfungen nicht direkt schreiben'
);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
values
  ('70000000-0000-0000-0000-000000000001', 'admin-e5c3@example.test', '{"display_name":"E5c3 Admin"}', now()),
  ('70000000-0000-0000-0000-000000000002', 'athlete-e5c3@example.test', '{"display_name":"E5c3 Athlet"}', now()),
  ('70000000-0000-0000-0000-000000000003', 'parent-e5c3@example.test', '{"display_name":"E5c3 Elternteil"}', now());

insert into public.organizations (id, name, slug)
values ('71000000-0000-0000-0000-000000000001', 'E5c3 Verein', 'e5c3-verein');

insert into public.organization_members (id, organization_id, user_id, role, status, updated_at)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'admin', 'active', clock_timestamp() - interval '10 seconds'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'athlete', 'active', clock_timestamp() - interval '10 seconds'),
  ('72000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', 'parent', 'active', clock_timestamp() - interval '10 seconds');

insert into public.athletes (id, organization_id, first_name, last_name, birth_year, linked_user_id)
values
  ('73000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Anna', 'E5c3', 2010, '70000000-0000-0000-0000-000000000002'),
  ('73000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'Berta', 'E5c3', 2012, null),
  ('73000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001', 'Clara', 'E5c3', 2014, null),
  ('73000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000001', 'Dora', 'E5c3', 2016, '70000000-0000-0000-0000-000000000003');

select is(
  (
    select relation_type
    from public.organization_member_athlete_links
    where membership_id = '72000000-0000-0000-0000-000000000002'
      and athlete_id = '73000000-0000-0000-0000-000000000001'
  ),
  'self',
  'Direkte Athletenverknuepfung wird als Selbstverknuepfung synchronisiert'
);
select is(
  (
    select relation_type
    from public.organization_member_athlete_links
    where membership_id = '72000000-0000-0000-0000-000000000003'
      and athlete_id = '73000000-0000-0000-0000-000000000004'
  ),
  'managed',
  'Bestehende Eltern-Direktverknuepfung wird als betreute Beziehung synchronisiert'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  jsonb_array_length(
    (
      select linked_athletes
      from public.admin_member_overview_v3('71000000-0000-0000-0000-000000000001')
      where membership_id = '72000000-0000-0000-0000-000000000002'
    )
  ),
  1,
  'Athletenkonto zeigt genau sein eigenes Athletenprofil'
);

select set_config(
  'e5c3.parent_version',
  (
    select updated_at::text
    from public.organization_members
    where id = '72000000-0000-0000-0000-000000000003'
  ),
  true
);

select ok(
  (public.acquire_edit_lock(
    '71000000-0000-0000-0000-000000000001',
    'organization_member',
    '72000000-0000-0000-0000-000000000003',
    '74000000-0000-0000-0000-000000000001',
    false,
    120
  ) ->> 'acquired')::boolean,
  'Administrator erhaelt die Sperre fuer das Elternkonto'
);

select ok(
  (public.admin_update_organization_member_v3(
    '71000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000003',
    'E5c3 Elternteil',
    'parent',
    'active',
    '[{"module_key":"kindertraining","can_view":true,"can_edit":false}]'::jsonb,
    array[
      '73000000-0000-0000-0000-000000000001'::uuid,
      '73000000-0000-0000-0000-000000000002'::uuid
    ],
    null,
    '74000000-0000-0000-0000-000000000001',
    current_setting('e5c3.parent_version')::timestamptz
  ) ->> 'updated_at') is not null,
  'Elternkonto kann mit zwei Athleten gespeichert werden'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.organization_member_athlete_links
    where membership_id = '72000000-0000-0000-0000-000000000003'
      and relation_type = 'managed'
  ),
  2::bigint,
  'Beide Eltern-Athletenverknuepfungen wurden gespeichert'
);
select is(
  (
    select count(*)::bigint
    from public.athletes
    where organization_id = '71000000-0000-0000-0000-000000000001'
      and linked_user_id = '70000000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  'Elternkonto wird nicht als Athleten-Selbstkonto eingetragen'
);
select ok(
  exists (
    select 1
    from public.organization_member_athlete_links parent_link
    join public.organization_member_athlete_links self_link
      on self_link.organization_id = parent_link.organization_id
     and self_link.athlete_id = parent_link.athlete_id
    where parent_link.membership_id = '72000000-0000-0000-0000-000000000003'
      and parent_link.athlete_id = '73000000-0000-0000-0000-000000000001'
      and parent_link.relation_type = 'managed'
      and self_link.membership_id = '72000000-0000-0000-0000-000000000002'
      and self_link.relation_type = 'self'
  ),
  'Eltern- und Athletenkonto koennen mit demselben Athleten verknuepft sein'
);
select is(
  jsonb_array_length(
    (
      select linked_athletes
      from public.admin_member_overview_v3('71000000-0000-0000-0000-000000000001')
      where membership_id = '72000000-0000-0000-0000-000000000003'
    )
  ),
  2,
  'Benutzeruebersicht liefert beide verknuepften Athleten'
);
select ok(
  exists (
    select 1
    from public.audit_log
    where entity_id = '72000000-0000-0000-0000-000000000003'
      and action = 'member.athlete_links_changed'
      and before_data -> 'athlete_ids' @> '["73000000-0000-0000-0000-000000000004"]'::jsonb
      and jsonb_array_length(after_data -> 'athlete_ids') = 2
  ),
  'Mehrfachverknuepfung wird mit alter und neuer ID-Liste protokolliert'
);
select ok(
  not exists (
    select 1
    from public.audit_log
    where entity_id = '72000000-0000-0000-0000-000000000003'
      and action = 'member.athlete_links_changed'
      and (
        coalesce(before_data, '{}'::jsonb) ?| array['email', 'display_name', 'user_id']
        or coalesce(after_data, '{}'::jsonb) ?| array['email', 'display_name', 'user_id']
      )
  ),
  'Athleten-Audit enthaelt keine E-Mail, Namen oder Benutzer-ID'
);

select set_config(
  'e5c3.athlete_version',
  (
    select updated_at::text
    from public.organization_members
    where id = '72000000-0000-0000-0000-000000000002'
  ),
  true
);
set local role authenticated;

select ok(
  (public.acquire_edit_lock(
    '71000000-0000-0000-0000-000000000001',
    'organization_member',
    '72000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000002',
    false,
    120
  ) ->> 'acquired')::boolean,
  'Administrator erhaelt die Sperre fuer das Athletenkonto'
);
select alike(
  public.e5c3_capture_error(format(
    'select public.admin_update_organization_member_v3(%L::uuid,%L::uuid,%L,%L::public.app_role,%L::public.membership_status,%L::jsonb,array[%L::uuid,%L::uuid],null,%L::uuid,%L::timestamptz)',
    '71000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000002',
    'E5c3 Athlet',
    'athlete',
    'active',
    '[]',
    '73000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000002',
    current_setting('e5c3.athlete_version')
  )),
  '%nur mit einem Athleten%',
  'Athletenkonto lehnt eine Mehrfachauswahl ab'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"70000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select alike(
  public.e5c3_capture_error(
    $$select * from public.admin_member_overview_v3('71000000-0000-0000-0000-000000000001')$$
  ),
  '%Administratorrechte%',
  'Elternkonto kann die Benutzerverwaltung nicht lesen'
);

reset role;
drop function public.e5c3_capture_error(text);

select * from finish();
rollback;
