-- D1-Finalisierung: Erst nach produktiver Bereitstellung und Prüfung des neuen Frontends ausführen.
-- Danach können bestehende Datensätze nur noch über die atomar geschützten V2/V3/V4-RPCs geändert werden.

revoke execute on function public.save_exercise_catalog_item_v2(
  uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb
) from authenticated;

revoke execute on function public.save_training_block(
  uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb
) from authenticated;

revoke execute on function public.update_athlete_v3(
  uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb, uuid
) from authenticated;

revoke execute on function public.save_athlete_training_plan(
  uuid, uuid, uuid, uuid, date, text, text, jsonb
) from authenticated;
