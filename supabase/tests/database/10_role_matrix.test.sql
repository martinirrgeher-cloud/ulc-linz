begin;

select plan(27);

create function public.e1a_execute_row_count(p_sql text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_row_count bigint;
begin
  execute p_sql;
  get diagnostics v_row_count = row_count;
  return v_row_count;
end;
$$;

revoke all on function public.e1a_execute_row_count(text) from public;
grant execute on function public.e1a_execute_row_count(text) to authenticated;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'admin-e1a@example.test', '{"display_name":"E1A Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'trainer-e1a@example.test', '{"display_name":"E1A Trainer"}'),
  ('00000000-0000-0000-0000-000000000003', 'athlete-e1a@example.test', '{"display_name":"E1A Athlet"}'),
  ('00000000-0000-0000-0000-000000000004', 'parent-e1a@example.test', '{"display_name":"E1A Elternteil"}'),
  ('00000000-0000-0000-0000-000000000005', 'outsider-e1a@example.test', '{"display_name":"E1A Außenstehend"}');

insert into public.organizations (id, name, slug)
values
  ('10000000-0000-0000-0000-000000000001', 'E1A Verein A', 'e1a-verein-a'),
  ('20000000-0000-0000-0000-000000000001', 'E1A Verein B', 'e1a-verein-b');

insert into public.organization_members (
  id, organization_id, user_id, role, status
)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin', 'active'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'trainer', 'active'),
  ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'athlete', 'active'),
  ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'parent', 'active');

insert into public.member_module_permissions (
  membership_id, module_key, can_view, can_edit
)
values
  ('11000000-0000-0000-0000-000000000002', 'athletes', true, true),
  ('11000000-0000-0000-0000-000000000003', 'training_documentation', true, false),
  ('11000000-0000-0000-0000-000000000004', 'kindertraining', true, false);

insert into public.training_groups (
  id, organization_id, name, short_name, sort_order
)
values
  ('12000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'E1A Gruppe A', 'A', 10),
  ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'E1A Gruppe B', 'B', 10);

insert into public.athletes (
  id, organization_id, first_name, last_name, birth_year
)
values
  ('13000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Anna', 'E1A', 2010),
  ('23000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Berta', 'E1A', 2011);

insert into public.audit_log (
  organization_id, actor_user_id, action, entity_type, entity_id
)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'e1a.test',
  'test_entity',
  '1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select ok(public.is_org_admin('10000000-0000-0000-0000-000000000001'), 'Admin wird als Administrator erkannt');
select ok(public.has_module_access('10000000-0000-0000-0000-000000000001', 'athletes', true), 'Admin besitzt Bearbeitungsrecht ohne Einzelberechtigung');
select is((select count(*) from public.organizations), 1::bigint, 'Admin sieht nur seinen Verein');
select is((select count(*) from public.profiles), 4::bigint, 'Admin sieht Profile aller Vereinsmitglieder');
select is((select count(*) from public.organization_members), 4::bigint, 'Admin sieht alle Mitgliedschaften seines Vereins');
select is((select count(*) from public.audit_log), 1::bigint, 'Admin sieht das Auditprotokoll');
select is((select count(*) from public.athletes), 1::bigint, 'Admin sieht nur Athleten seines Vereins');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select ok(not public.is_org_admin('10000000-0000-0000-0000-000000000001'), 'Trainer wird nicht als Administrator erkannt');
select ok(public.has_module_access('10000000-0000-0000-0000-000000000001', 'athletes', false), 'Trainer besitzt Leserecht im Athletenmodul');
select ok(public.has_module_access('10000000-0000-0000-0000-000000000001', 'athletes', true), 'Trainer besitzt das zugewiesene Bearbeitungsrecht');
select is((select count(*) from public.organizations), 1::bigint, 'Trainer sieht seinen Verein');
select is((select count(*) from public.profiles), 1::bigint, 'Trainer sieht ohne Adminrecht nur sein eigenes Profil');
select is((select count(*) from public.organization_members), 1::bigint, 'Trainer sieht ohne Adminrecht nur seine Mitgliedschaft');
select is((select count(*) from public.audit_log), 0::bigint, 'Trainer sieht kein Auditprotokoll');
select is((select count(*) from public.athletes), 1::bigint, 'Trainer sieht Athleten seines Vereins über das Modulrecht');
select is(
  public.e1a_execute_row_count(
    'update public.organizations set name = ''Unzulässige Änderung'' where id = ''10000000-0000-0000-0000-000000000001'''
  ),
  0::bigint,
  'Trainer kann den Verein nicht direkt ändern'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select ok(public.has_module_access('10000000-0000-0000-0000-000000000001', 'training_documentation', false), 'Athlet besitzt das zugewiesene Dokumentations-Leserecht');
select ok(not public.has_module_access('10000000-0000-0000-0000-000000000001', 'training_documentation', true), 'Athlet besitzt ohne Zuweisung kein Dokumentations-Bearbeitungsrecht');
select ok(public.can_read_athlete_data('10000000-0000-0000-0000-000000000001'), 'Dokumentationszugriff erlaubt die benötigten Athletenstammdaten');
select is((select count(*) from public.athletes), 1::bigint, 'Athlet sieht nur Athleten seines Vereins');
select is((select count(*) from public.profiles), 1::bigint, 'Athlet sieht nur sein eigenes Profil');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

select ok(public.has_module_access('10000000-0000-0000-0000-000000000001', 'kindertraining', false), 'Elternteil besitzt das zugewiesene Kindertraining-Leserecht');
select ok(not public.has_module_access('10000000-0000-0000-0000-000000000001', 'kindertraining', true), 'Elternteil besitzt ohne Zuweisung kein Kindertraining-Bearbeitungsrecht');
select is((select count(*) from public.athletes), 1::bigint, 'Elternteil sieht die für das Kindertraining benötigten Athleten');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);

select is((select count(*) from public.organizations), 0::bigint, 'Benutzer ohne Mitgliedschaft sieht keinen Verein');
select is((select count(*) from public.athletes), 0::bigint, 'Benutzer ohne Mitgliedschaft sieht keine Athleten');
select is((select count(*) from public.profiles), 1::bigint, 'Benutzer ohne Mitgliedschaft sieht nur sein eigenes Profil');

reset role;
select * from finish();
rollback;
