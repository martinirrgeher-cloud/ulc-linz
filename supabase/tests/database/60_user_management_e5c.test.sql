begin;

select plan(27);

create function public.e5c_capture_error(p_sql text)
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

revoke all on function public.e5c_capture_error(text) from public;
grant execute on function public.e5c_capture_error(text) to authenticated;

select has_column(
  'public',
  'organization_members',
  'invitation_last_sent_at',
  'Einladungszeitpunkt ist am Mitglied gespeichert'
);
select has_column(
  'public',
  'organization_members',
  'invitation_send_count',
  'Einladungsanzahl ist am Mitglied gespeichert'
);
select has_function('public', 'admin_member_overview_v2', array['uuid'], 'Erweiterte Benutzerübersicht ist vorhanden');
select has_function('public', 'admin_member_link_options', array['uuid'], 'Verknüpfungsoptionen sind vorhanden');
select has_function('public', 'admin_member_audit_overview', array['uuid', 'uuid'], 'Benutzer-Auditübersicht ist vorhanden');
select has_function('public', 'provision_organization_member_v2', array['uuid', 'uuid', 'text', 'app_role', 'membership_status', 'jsonb', 'uuid', 'timestamp with time zone'], 'Erweiterte Benutzeranlage ist vorhanden');
select has_function('public', 'admin_member_invitation_target', array['uuid', 'uuid', 'uuid'], 'Einladungsziel ist vorhanden');
select has_function('public', 'record_member_invitation_sent', array['uuid', 'uuid', 'uuid', 'boolean'], 'Einladungsversand kann protokolliert werden');
select has_function('public', 'admin_update_organization_member_v2', array['uuid', 'uuid', 'text', 'app_role', 'membership_status', 'jsonb', 'uuid', 'uuid', 'uuid', 'timestamp with time zone'], 'Versionsgesicherte Benutzeränderung ist vorhanden');
select is(
  public.edit_lock_module_key('organization_member'),
  'user_management',
  'Benutzerkonten sind dem richtigen Sperrmodul zugeordnet'
);

with required_tables(table_name) as (
  values ('organization_members'), ('audit_log')
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
  2::bigint,
  'Benutzer und Auditprotokoll sind für Realtime veröffentlicht'
);

with required_tables(table_name) as (
  values ('organization_members'), ('audit_log')
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
  2::bigint,
  'Benutzer und Auditprotokoll liefern vollständige Realtime-Datensätze'
);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
values
  ('60000000-0000-0000-0000-000000000001', 'admin-e5c@example.test', '{"display_name":"E5c Admin"}', now()),
  ('60000000-0000-0000-0000-000000000002', 'target-e5c@example.test', '{"display_name":"E5c Ziel"}', null),
  ('60000000-0000-0000-0000-000000000003', 'trainer-e5c@example.test', '{"display_name":"E5c Trainer"}', now());

insert into public.organizations (id, name, slug)
values ('61000000-0000-0000-0000-000000000001', 'E5c Verein', 'e5c-verein');

insert into public.organization_members (id, organization_id, user_id, role, status, updated_at)
values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'admin', 'active', clock_timestamp() - interval '10 seconds'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'athlete', 'invited', clock_timestamp() - interval '10 seconds'),
  ('62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'trainer', 'active', clock_timestamp() - interval '10 seconds');

insert into public.athletes (id, organization_id, first_name, last_name, birth_year)
values ('63000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'E5c', 'Athlet', 2010);

insert into public.trainers (id, organization_id, first_name, last_name, is_active)
values ('63000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 'E5c', 'Trainerprofil', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::bigint from public.admin_member_overview_v2('61000000-0000-0000-0000-000000000001')),
  3::bigint,
  'Administrator sieht alle Benutzerkonten'
);
select is(
  (
    select invitation_send_count
    from public.admin_member_overview_v2('61000000-0000-0000-0000-000000000001')
    where membership_id = '62000000-0000-0000-0000-000000000002'
  ),
  0,
  'Neue offene Zuordnung zeigt noch keinen Einladungsversand'
);
select is(
  jsonb_array_length(public.admin_member_link_options('61000000-0000-0000-0000-000000000001') -> 'athletes'),
  1,
  'Verknüpfungsübersicht enthält den Athleten'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select alike(
  public.e5c_capture_error(
    $$select * from public.admin_member_overview_v2('61000000-0000-0000-0000-000000000001')$$
  ),
  '%Administratorrechte%',
  'Trainer kann die Benutzerübersicht nicht lesen'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select set_config(
  'e5c.initial_version',
  (
    select updated_at::text
    from public.organization_members
    where id = '62000000-0000-0000-0000-000000000002'
  ),
  true
);

select ok(
  (public.acquire_edit_lock(
    '61000000-0000-0000-0000-000000000001',
    'organization_member',
    '62000000-0000-0000-0000-000000000002',
    '64000000-0000-0000-0000-000000000001',
    false,
    120
  ) ->> 'acquired')::boolean,
  'Administrator erhält die Benutzersperre'
);

select ok(
  (public.admin_update_organization_member_v2(
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000002',
    'E5c Ziel geändert',
    'trainer',
    'invited',
    '[{"module_key":"kindertraining","can_view":true,"can_edit":true}]'::jsonb,
    null,
    '63000000-0000-0000-0000-000000000002',
    '64000000-0000-0000-0000-000000000001',
    current_setting('e5c.initial_version')::timestamptz
  ) ->> 'updated_at') is not null,
  'Benutzerdaten werden versionsgesichert gespeichert'
);
select is(
  (select role::text from public.organization_members where id = '62000000-0000-0000-0000-000000000002'),
  'trainer',
  'Rollenänderung wurde gespeichert'
);
select is(
  (select linked_user_id from public.trainers where id = '63000000-0000-0000-0000-000000000002'),
  '60000000-0000-0000-0000-000000000002'::uuid,
  'Trainerverknüpfung wurde gespeichert'
);
select ok(
  exists (
    select 1 from public.audit_log
    where entity_id = '62000000-0000-0000-0000-000000000002'
      and action = 'member.updated'
  ),
  'Rollen- und Rechteänderung wurde protokolliert'
);
select ok(
  exists (
    select 1 from public.audit_log
    where entity_id = '62000000-0000-0000-0000-000000000002'
      and action = 'member.trainer_link_changed'
  ),
  'Trainerverknüpfung wurde protokolliert'
);
select ok(
  not exists (
    select 1 from public.audit_log
    where entity_id = '62000000-0000-0000-0000-000000000002'
      and (
        coalesce(before_data, '{}'::jsonb) ?| array['email', 'display_name', 'user_id']
        or coalesce(after_data, '{}'::jsonb) ?| array['email', 'display_name', 'user_id']
      )
  ),
  'Auditprotokoll enthält keine unnötigen personenbezogenen Felder'
);
select alike(
  public.e5c_capture_error(format(
    'select public.admin_update_organization_member_v2(%L::uuid,%L::uuid,%L,%L::public.app_role,%L::public.membership_status,%L::jsonb,null,null,%L::uuid,%L::timestamptz)',
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000002',
    'Veralteter Stand',
    'trainer',
    'invited',
    '[]',
    '64000000-0000-0000-0000-000000000001',
    current_setting('e5c.initial_version')
  )),
  '%seit dem Oeffnen veraendert%',
  'Veraltete Benutzerfassung erzeugt einen Konflikt'
);

reset role;

select is(
  (public.record_member_invitation_sent(
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    false
  ) ->> 'send_count')::integer,
  1,
  'Erster Einladungsversand erhöht den Zähler'
);
select ok(
  exists (
    select 1 from public.audit_log
    where entity_id = '62000000-0000-0000-0000-000000000002'
      and action = 'member.invitation_sent'
  ),
  'Einladungsversand wurde protokolliert'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select ok(
  (select count(*) from public.admin_member_audit_overview(
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000002'
  )) >= 3,
  'Auditübersicht liefert Rollen-, Verknüpfungs- und Einladungsänderungen'
);

reset role;
drop function public.e5c_capture_error(text);

select * from finish();
rollback;
