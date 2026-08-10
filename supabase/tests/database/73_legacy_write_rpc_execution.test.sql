begin;

select plan(7);

create function public.legacy_write_rpc_capture_error(p_sql text)
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

revoke all on function public.legacy_write_rpc_capture_error(text) from public;
grant execute on function public.legacy_write_rpc_capture_error(text) to authenticated;

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'public.update_trainer(uuid,uuid,text,text,text,text,text,boolean)',
      'public.update_trainer_v2(uuid,uuid,text,text,text,text,text,boolean,uuid[])',
      'public.update_training_group(uuid,uuid,text,text,text,boolean,integer)',
      'public.update_training_group_v2(uuid,uuid,text,text,text,boolean,integer,text,smallint[],boolean)',
      'public.admin_update_organization_member(uuid,uuid,text,public.app_role,public.membership_status,jsonb)',
      'public.admin_update_organization_member_v2(uuid,uuid,text,public.app_role,public.membership_status,jsonb,uuid,uuid,uuid,timestamp with time zone)',
      'public.save_exercise_catalog_item_v3(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb,uuid,timestamp with time zone)',
      'public.save_training_block_v2(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb,uuid,timestamp with time zone)'
    ]) legacy(signature)
    where has_function_privilege('authenticated', legacy.signature, 'EXECUTE')
  ),
  0::bigint,
  'authenticated kann keine bestätigte Legacy-Schreib-RPC direkt ausführen'
);

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'public.update_trainer(uuid,uuid,text,text,text,text,text,boolean)',
      'public.update_trainer_v2(uuid,uuid,text,text,text,text,text,boolean,uuid[])',
      'public.update_training_group(uuid,uuid,text,text,text,boolean,integer)',
      'public.update_training_group_v2(uuid,uuid,text,text,text,boolean,integer,text,smallint[],boolean)',
      'public.admin_update_organization_member(uuid,uuid,text,public.app_role,public.membership_status,jsonb)',
      'public.admin_update_organization_member_v2(uuid,uuid,text,public.app_role,public.membership_status,jsonb,uuid,uuid,uuid,timestamp with time zone)',
      'public.save_exercise_catalog_item_v3(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb,uuid,timestamp with time zone)',
      'public.save_training_block_v2(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb,uuid,timestamp with time zone)'
    ]) legacy(signature)
    where has_function_privilege('anon', legacy.signature, 'EXECUTE')
  ),
  0::bigint,
  'anon kann keine bestätigte Legacy-Schreib-RPC direkt ausführen'
);

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'public.update_trainer(uuid,uuid,text,text,text,text,text,boolean)',
      'public.update_trainer_v2(uuid,uuid,text,text,text,text,text,boolean,uuid[])',
      'public.update_training_group(uuid,uuid,text,text,text,boolean,integer)',
      'public.update_training_group_v2(uuid,uuid,text,text,text,boolean,integer,text,smallint[],boolean)',
      'public.admin_update_organization_member(uuid,uuid,text,public.app_role,public.membership_status,jsonb)',
      'public.admin_update_organization_member_v2(uuid,uuid,text,public.app_role,public.membership_status,jsonb,uuid,uuid,uuid,timestamp with time zone)',
      'public.save_exercise_catalog_item_v3(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb,uuid,timestamp with time zone)',
      'public.save_training_block_v2(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb,uuid,timestamp with time zone)'
    ]) legacy(signature)
    join pg_proc function_row on function_row.oid = to_regprocedure(legacy.signature)
    cross join lateral aclexplode(coalesce(function_row.proacl, acldefault('f', function_row.proowner))) privilege
    where privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'PUBLIC besitzt keine EXECUTE-Rechte auf bestätigte Legacy-Schreib-RPCs'
);

select is(
  (
    select count(*)::bigint
    from unnest(array[
      'public.update_trainer_v4(uuid,uuid,text,text,text,text,text,boolean,uuid[],uuid,uuid,timestamp with time zone)',
      'public.update_training_group_v4(uuid,uuid,text,text,text,boolean,integer,text,smallint[],boolean,boolean,smallint,time without time zone,smallint,boolean,uuid,timestamp with time zone)',
      'public.admin_update_organization_member_v3(uuid,uuid,text,public.app_role,public.membership_status,jsonb,uuid[],uuid,uuid,timestamp with time zone)',
      'public.save_exercise_catalog_item_v4(uuid,uuid,text,text,text,text,text,text,text,text[],text,boolean,uuid[],jsonb,text,uuid[],uuid,timestamp with time zone)',
      'public.save_training_block_v3(uuid,uuid,text,text,text,integer,boolean,uuid[],jsonb,uuid,timestamp with time zone)'
    ]) current_rpc(signature)
    where has_function_privilege('authenticated', current_rpc.signature, 'EXECUTE')
  ),
  5::bigint,
  'Die aktuellen Schreib-RPCs bleiben für authenticated ausführbar'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '80000000-0000-0000-0000-000000000001',
  'legacy-write-rpc-admin@example.test',
  '{"display_name":"Legacy RPC Admin"}'
);

insert into public.organizations (id, name, slug)
values (
  '81000000-0000-0000-0000-000000000001',
  'Legacy RPC Verein',
  'legacy-rpc-verein'
);

insert into public.organization_members (id, organization_id, user_id, role, status)
values (
  '82000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  'admin',
  'active'
);

insert into public.organization_exercise_categories (
  organization_id, category_key, title, sort_order, is_active
)
select
  '81000000-0000-0000-0000-000000000001',
  category.key,
  category.title,
  category.sort_order,
  true
from public.exercise_categories category
on conflict (organization_id, category_key) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (
    select count(*)::bigint
    from (values
      ('select public.update_trainer(null::uuid,null::uuid,null::text,null::text,null::text,null::text,null::text,null::boolean)'),
      ('select public.update_trainer_v2(null::uuid,null::uuid,null::text,null::text,null::text,null::text,null::text,null::boolean,null::uuid[])'),
      ('select public.update_training_group(null::uuid,null::uuid,null::text,null::text,null::text,null::boolean,null::integer)'),
      ('select public.update_training_group_v2(null::uuid,null::uuid,null::text,null::text,null::text,null::boolean,null::integer,null::text,null::smallint[],null::boolean)'),
      ('select public.admin_update_organization_member(null::uuid,null::uuid,null::text,null::public.app_role,null::public.membership_status,null::jsonb)'),
      ('select public.admin_update_organization_member_v2(null::uuid,null::uuid,null::text,null::public.app_role,null::public.membership_status,null::jsonb,null::uuid,null::uuid,null::uuid,null::timestamptz)'),
      ('select public.save_exercise_catalog_item_v3(null::uuid,null::uuid,null::text,null::text,null::text,null::text,null::text,null::text,null::text,null::text[],null::text,null::boolean,null::uuid[],null::jsonb,null::uuid,null::timestamptz)'),
      ('select public.save_training_block_v2(null::uuid,null::uuid,null::text,null::text,null::text,null::integer,null::boolean,null::uuid[],null::jsonb,null::uuid,null::timestamptz)')
    ) legacy_call(statement)
    where public.legacy_write_rpc_capture_error(legacy_call.statement) like '42501:%'
  ),
  8::bigint,
  'Direkte Legacy-Aufrufe scheitern mit insufficient_privilege'
);

select set_config(
  'legacy_write_rpc.exercise_id',
  public.save_exercise_catalog_item_v4(
    '81000000-0000-0000-0000-000000000001',
    null,
    'Legacy RPC Kettenprüfung',
    'warmup',
    null,
    null,
    null,
    null,
    null,
    array[]::text[],
    null,
    true,
    array[]::uuid[],
    '[]'::jsonb,
    null,
    array[]::uuid[],
    null,
    null
  ) ->> 'id',
  true
);

select ok(
  current_setting('legacy_write_rpc.exercise_id')::uuid is not null,
  'Katalog V4 speichert weiter über die interne V3-V2-V1-Kette'
);

select is(
  (
    public.save_training_block_v3(
      '81000000-0000-0000-0000-000000000001',
      null,
      'Legacy RPC Blockprüfung',
      null,
      null,
      30,
      true,
      array[]::uuid[],
      jsonb_build_array(jsonb_build_object(
        'exercise_id', current_setting('legacy_write_rpc.exercise_id'),
        'parameter_values', '{}'::jsonb
      )),
      null,
      null
    ) ->> 'version_number'
  )::integer,
  1,
  'Block V3 speichert weiter über die interne V2-V1-Kette und erzeugt eine Version'
);

reset role;
drop function public.legacy_write_rpc_capture_error(text);

select * from finish();
rollback;
