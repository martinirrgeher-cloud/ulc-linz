begin;

select plan(13);

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
values
  ('30000000-0000-0000-0000-000000000001', 'admin-lock-e1a@example.test', '{"display_name":"E1A Lock Admin"}'),
  ('30000000-0000-0000-0000-000000000002', 'trainer1-lock-e1a@example.test', '{"display_name":"E1A Trainer 1"}'),
  ('30000000-0000-0000-0000-000000000003', 'trainer2-lock-e1a@example.test', '{"display_name":"E1A Trainer 2"}');

insert into public.organizations (id, name, slug)
values ('31000000-0000-0000-0000-000000000001', 'E1A Lock Verein', 'e1a-lock-verein');

insert into public.organization_members (id, organization_id, user_id, role, status)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'admin', 'active'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'trainer', 'active'),
  ('32000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'trainer', 'active');

insert into public.member_module_permissions (membership_id, module_key, can_view, can_edit)
values
  ('32000000-0000-0000-0000-000000000002', 'athletes', true, true),
  ('32000000-0000-0000-0000-000000000003', 'athletes', true, true);

insert into public.athletes (id, organization_id, first_name, last_name, birth_year)
values (
  '33000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'Lock',
  'Athlet',
  2010
);

select set_config(
  'e1a.initial_athlete_version',
  (
    select updated_at::text
    from public.athletes
    where id = '33000000-0000-0000-0000-000000000001'
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select ok(
  (public.acquire_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    false,
    120
  ) ->> 'acquired')::boolean,
  'Erster Trainer erhält die Bearbeitungssperre'
);
select ok(
  (public.acquire_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    false,
    120
  ) ->> 'record_version') is not null,
  'Die Sperre liefert die Datensatzversion'
);
select ok(
  (public.renew_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    120
  ) ->> 'renewed')::boolean,
  'Der Besitzer kann seine Sperre verlängern'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select ok(
  not (public.acquire_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000002',
    false,
    120
  ) ->> 'acquired')::boolean,
  'Ein zweiter Trainer erhält keine parallele Sperre'
);
select ok(
  not public.release_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001'
  ),
  'Ein anderer Trainer kann die fremde Sperre nicht freigeben'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select ok(
  (public.acquire_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000003',
    true,
    120
  ) ->> 'acquired')::boolean,
  'Ein Administrator kann die Sperre bewusst übernehmen'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select ok(
  not (public.renew_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    120
  ) ->> 'renewed')::boolean,
  'Der vorherige Besitzer kann die übernommene Sperre nicht verlängern'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  public.assert_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000003',
    current_setting('e1a.initial_athlete_version')::timestamptz
  ),
  current_setting('e1a.initial_athlete_version')::timestamptz,
  'Die gültige Sperre akzeptiert die aktuelle Datensatzversion'
);
select ok(
  public.release_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000003'
  ),
  'Der Besitzer kann die Sperre freigeben'
);

reset role;
select pg_sleep(0.02);
update public.athletes
set first_name = 'Extern geändert'
where id = '33000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select ok(
  (public.acquire_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000004',
    false,
    120
  ) ->> 'acquired')::boolean,
  'Nach der Freigabe kann der Datensatz erneut reserviert werden'
);
select alike(
  public.e1a_capture_error(format(
    'select public.assert_edit_lock(%L::uuid,%L,%L::uuid,%L::uuid,%L::timestamptz)',
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000004',
    current_setting('e1a.initial_athlete_version')
  )),
  '%seit dem Öffnen verändert%',
  'Eine veraltete Datensatzversion erzeugt einen Konflikt'
);
select is(
  public.assert_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000004',
    (select updated_at from public.athletes where id = '33000000-0000-0000-0000-000000000001')
  ),
  (select updated_at from public.athletes where id = '33000000-0000-0000-0000-000000000001'),
  'Die aktuelle Datensatzversion wird akzeptiert'
);
select ok(
  public.release_edit_lock(
    '31000000-0000-0000-0000-000000000001',
    'athlete',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000004'
  ),
  'Die erneute Sperre kann sauber freigegeben werden'
);

reset role;
select * from finish();
rollback;
