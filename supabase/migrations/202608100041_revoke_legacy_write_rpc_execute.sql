revoke all on function public.update_trainer(
  uuid, uuid, text, text, text, text, text, boolean
) from authenticated, anon, PUBLIC;

revoke all on function public.update_trainer_v2(
  uuid, uuid, text, text, text, text, text, boolean, uuid[]
) from authenticated, anon, PUBLIC;

revoke all on function public.update_training_group(
  uuid, uuid, text, text, text, boolean, integer
) from authenticated, anon, PUBLIC;

revoke all on function public.update_training_group_v2(
  uuid, uuid, text, text, text, boolean, integer, text, smallint[], boolean
) from authenticated, anon, PUBLIC;

revoke all on function public.admin_update_organization_member(
  uuid, uuid, text, public.app_role, public.membership_status, jsonb
) from authenticated, anon, PUBLIC;

revoke all on function public.admin_update_organization_member_v2(
  uuid, uuid, text, public.app_role, public.membership_status,
  jsonb, uuid, uuid, uuid, timestamptz
) from authenticated, anon, PUBLIC;

revoke all on function public.save_exercise_catalog_item_v3(
  uuid, uuid, text, text, text, text, text, text, text, text[],
  text, boolean, uuid[], jsonb, uuid, timestamptz
) from authenticated, anon, PUBLIC;

revoke all on function public.save_training_block_v2(
  uuid, uuid, text, text, text, integer, boolean, uuid[],
  jsonb, uuid, timestamptz
) from authenticated, anon, PUBLIC;
