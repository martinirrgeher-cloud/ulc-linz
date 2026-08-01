-- E0: Der versionierte Migrationsstand wird an den bereits produktiv ausgeführten
-- Sicherheitsstand angeglichen. Alte, nicht atomar geschützte Schreib-RPCs bleiben
-- für interne SECURITY-DEFINER-Aufrufe erhalten, sind aber nicht mehr direkt über
-- die API-Rollen aufrufbar.

revoke all on function public.save_exercise_catalog_item(
  uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb
) from authenticated, anon, public;

revoke all on function public.save_exercise_catalog_item_v2(
  uuid, uuid, text, text, text, text, text, text, text, text[], text, boolean, uuid[], jsonb
) from authenticated, anon, public;

revoke all on function public.save_training_block(
  uuid, uuid, text, text, text, integer, boolean, uuid[], jsonb
) from authenticated, anon, public;

revoke all on function public.update_athlete(
  uuid, uuid, text, text, integer, text, boolean, uuid[]
) from authenticated, anon, public;

revoke all on function public.update_athlete_v2(
  uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb
) from authenticated, anon, public;

revoke all on function public.update_athlete_v3(
  uuid, uuid, text, text, integer, text, boolean, uuid[], jsonb, uuid
) from authenticated, anon, public;

revoke all on function public.save_athlete_training_plan(
  uuid, uuid, uuid, uuid, date, text, text, jsonb
) from authenticated, anon, public;

revoke all on function public.save_training_documentation(
  uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb
) from authenticated, anon, public;

revoke all on function public.save_training_documentation_v2(
  uuid, uuid, text, integer, integer, integer, text, text, text, text, jsonb, timestamptz
) from authenticated, anon, public;
