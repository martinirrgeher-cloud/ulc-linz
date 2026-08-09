#!/usr/bin/env bash
set -euo pipefail

BASELINE_VERSION="202608080039"
FIRST_PENDING_VERSION="202608090040"
EXPECTED_BASELINE_COUNT=38
EXPECTED_TOTAL_COUNT=39
DB_URL="${SUPABASE_DB_URL:-${1:-}}"

if [[ -z "$DB_URL" ]]; then
  echo "FEHLER: SUPABASE_DB_URL fehlt." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "FEHLER: Supabase CLI ist nicht verfuegbar." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "FEHLER: Docker ist nicht verfuegbar." >&2
  exit 1
fi

mapfile -t ALL_VERSIONS < <(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
    | sed -E 's/^([0-9]+)_.*/\1/' \
    | sort -u
)
mapfile -t BASELINE_VERSIONS < <(printf '%s\n' "${ALL_VERSIONS[@]}" | awk -v max="$BASELINE_VERSION" '$1 <= max')
mapfile -t PENDING_VERSIONS < <(printf '%s\n' "${ALL_VERSIONS[@]}" | awk -v max="$BASELINE_VERSION" '$1 > max')

if [[ "${#ALL_VERSIONS[@]}" -ne "$EXPECTED_TOTAL_COUNT" ]]; then
  echo "FEHLER: Fuer die einmalige Recovery werden exakt ${EXPECTED_TOTAL_COUNT} Repository-Migrationen erwartet; gefunden: ${#ALL_VERSIONS[@]}." >&2
  exit 1
fi
if [[ "${#BASELINE_VERSIONS[@]}" -ne "$EXPECTED_BASELINE_COUNT" ]]; then
  echo "FEHLER: Baseline bis ${BASELINE_VERSION} ist unerwartet: ${#BASELINE_VERSIONS[@]} statt ${EXPECTED_BASELINE_COUNT} Migrationen." >&2
  exit 1
fi
if [[ "${#PENDING_VERSIONS[@]}" -ne 1 || "${PENDING_VERSIONS[0]}" != "$FIRST_PENDING_VERSION" ]]; then
  echo "FEHLER: Nach der Baseline darf fuer diese Recovery ausschliesslich ${FIRST_PENDING_VERSION} offen sein." >&2
  printf 'Gefunden: %s\n' "${PENDING_VERSIONS[*]:-(keine)}" >&2
  exit 1
fi

psql_query() {
  docker run --rm postgres:17-alpine \
    psql "$DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "$1"
}

remote_history_exists="$(psql_query "select case when to_regclass('supabase_migrations.schema_migrations') is null then '0' else '1' end;")"
if [[ "$remote_history_exists" == "1" ]]; then
  mapfile -t REMOTE_VERSIONS < <(psql_query "select version from supabase_migrations.schema_migrations order by version;")
else
  REMOTE_VERSIONS=()
fi

if [[ "${#REMOTE_VERSIONS[@]}" -ne 0 ]]; then
  echo "FEHLER: Diese einmalige Baseline-Recovery ist nur fuer eine vollstaendig leere Remote-Migrationshistorie erlaubt." >&2
  printf 'Remote vorhanden: %s\n' "${REMOTE_VERSIONS[*]}" >&2
  exit 1
fi

echo "1/5: Produktionsschema gegen die nachweisliche Baseline bis ${BASELINE_VERSION} vergleichen..."
TEMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEMP_ROOT"' EXIT
mkdir -p "$TEMP_ROOT/project"
cp -a supabase "$TEMP_ROOT/project/supabase"
find "$TEMP_ROOT/project/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print0 \
  | while IFS= read -r -d '' file; do
      version="$(basename "$file" | sed -E 's/^([0-9]+)_.*/\1/')"
      if [[ "$version" > "$BASELINE_VERSION" ]]; then
        rm -f "$file"
      fi
    done

DIFF_FILE="$TEMP_ROOT/baseline-diff.sql"
(
  cd "$TEMP_ROOT/project"
  supabase db diff \
    --db-url "$DB_URL" \
    --schema public \
    --use-migra \
    --output "$DIFF_FILE"
)

NORMALIZED_DIFF="$TEMP_ROOT/baseline-diff-substantive.sql"
sed -E \
  -e '/^[[:space:]]*$/d' \
  -e '/^[[:space:]]*--/d' \
  -e '/^[[:space:]]*set[[:space:]]+check_function_bodies[[:space:]]*=[[:space:]]*off;?[[:space:]]*$/Id' \
  "$DIFF_FILE" > "$NORMALIZED_DIFF"
if [[ -s "$NORMALIZED_DIFF" ]]; then
  echo "FEHLER: Das produktive Schema entspricht nicht exakt der Repository-Baseline 001-039." >&2
  echo "Es wird KEINE Migrationshistorie repariert. Schema-Differenz:" >&2
  cat "$DIFF_FILE" >&2
  exit 1
fi

echo "2/5: Nicht-schemafeste Baseline-Bestandteile pruefen..."
BUCKET_COUNT="$(psql_query "
select count(*)
from storage.buckets
where id in ('exercise-videos', 'training-documentation-media')
  and public = false
  and file_size_limit = 52428800
  and cardinality(allowed_mime_types) = 6
  and allowed_mime_types @> array['video/mp4','video/quicktime','video/webm','video/x-m4v','video/3gpp','video/3gpp2']::text[];")"
if [[ "$BUCKET_COUNT" != "2" ]]; then
  echo "FEHLER: Die beiden erwarteten privaten Storage-Buckets entsprechen nicht der Baseline." >&2
  exit 1
fi

AUTH_TRIGGER_COUNT="$(psql_query "
select count(*)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and t.tgname = 'on_auth_user_created'
  and pn.nspname = 'public'
  and p.proname = 'handle_new_auth_user'
  and not t.tgisinternal;")"
if [[ "$AUTH_TRIGGER_COUNT" != "1" ]]; then
  echo "FEHLER: Der erwartete Auth-Trigger on_auth_user_created fehlt oder zeigt auf die falsche Funktion." >&2
  exit 1
fi

STORAGE_POLICY_COUNT="$(psql_query "
select count(*)
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    (policyname in ('exercise_videos_storage_select','exercise_videos_storage_insert','exercise_videos_storage_update','exercise_videos_storage_delete')
      and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) like '%exercise-videos%')
    or
    (policyname in ('training_documentation_media_storage_select','training_documentation_media_storage_insert','training_documentation_media_storage_update','training_documentation_media_storage_delete')
      and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) like '%training-documentation-media%')
  );")"
if [[ "$STORAGE_POLICY_COUNT" != "8" ]]; then
  echo "FEHLER: Die acht erwarteten Storage-RLS-Policies entsprechen nicht der Baseline." >&2
  exit 1
fi

read -r -d '' REALTIME_SQL <<'SQL' || true
with expected(tablename) as (
  values
    ('athletes'),
    ('training_groups'),
    ('trainers'),
    ('exercises'),
    ('training_blocks'),
    ('athlete_training_plans'),
    ('athlete_training_sessions'),
    ('training_block_user_favorites'),
    ('organization_members'),
    ('audit_log')
)
select count(*)
from expected e
join pg_publication_tables p
  on p.pubname = 'supabase_realtime'
 and p.schemaname = 'public'
 and p.tablename = e.tablename
join pg_class c on c.oid = to_regclass(format('public.%I', e.tablename))
where c.relreplident = 'f';
SQL
REALTIME_COUNT="$(psql_query "$REALTIME_SQL")"
if [[ "$REALTIME_COUNT" != "10" ]]; then
  echo "FEHLER: Realtime-Publication/Replica-Identity entspricht nicht der Baseline (erwartet 10, gefunden ${REALTIME_COUNT})." >&2
  exit 1
fi

MODULE_COUNT="$(psql_query "
select count(*)
from public.app_modules
where key in (
  'kindertraining','athletes','performance_registration','exercise_catalog',
  'training_planning','training_overview','training_blocks','training_documentation',
  'user_management','u12','u14','dropdown_settings','data_import','countdown'
);")"
if [[ "$MODULE_COUNT" != "14" ]]; then
  echo "FEHLER: Erwartete App-Module der Baseline fehlen (erwartet 14, gefunden ${MODULE_COUNT})." >&2
  exit 1
fi

INACTIVE_STATISTICS_COUNT="$(psql_query "
select count(*)
from public.app_modules
where key in ('kindertraining_statistics','u12_statistics','u14_statistics')
  and is_active = false;")"
if [[ "$INACTIVE_STATISTICS_COUNT" != "3" ]]; then
  echo "FEHLER: Statistik-Rechtekonsolidierung aus Migration 037 ist nicht vollstaendig vorhanden." >&2
  exit 1
fi

echo "3/5: Historische Migrationen 001-039 in der Supabase-Historie baselinen..."
BASELINE_REPAIRED=0
cleanup_partial_repair() {
  local rc=$?
  if [[ $rc -ne 0 && "$BASELINE_REPAIRED" == "0" ]]; then
    echo "Recovery vor Abschluss der Baseline fehlgeschlagen; versuche partielle Historieneintraege wieder zu entfernen..." >&2
    supabase migration repair "${BASELINE_VERSIONS[@]}" --status reverted --db-url "$DB_URL" >/dev/null 2>&1 || true
  fi
  rm -rf "$TEMP_ROOT"
  exit $rc
}
trap cleanup_partial_repair EXIT

supabase migration repair "${BASELINE_VERSIONS[@]}" --status applied --db-url "$DB_URL"
mapfile -t REMOTE_AFTER_REPAIR < <(psql_query "select version from supabase_migrations.schema_migrations order by version;")
if [[ "${#REMOTE_AFTER_REPAIR[@]}" -ne "${#BASELINE_VERSIONS[@]}" ]] || \
   [[ "$(printf '%s\n' "${REMOTE_AFTER_REPAIR[@]}")" != "$(printf '%s\n' "${BASELINE_VERSIONS[@]}")" ]]; then
  echo "FEHLER: Die reparierte Migrationshistorie entspricht nicht exakt der verifizierten Baseline." >&2
  exit 1
fi
BASELINE_REPAIRED=1
trap 'rm -rf "$TEMP_ROOT"' EXIT

echo "4/5: Ausschliesslich die echte offene Migration ${FIRST_PENDING_VERSION} anwenden..."
supabase db push --db-url "$DB_URL" --dry-run
supabase db push --db-url "$DB_URL"

echo "5/5: Endzustand und Migration 040 verifizieren..."
mapfile -t REMOTE_FINAL < <(psql_query "select version from supabase_migrations.schema_migrations order by version;")
if [[ "${#REMOTE_FINAL[@]}" -ne "${#ALL_VERSIONS[@]}" ]] || \
   [[ "$(printf '%s\n' "${REMOTE_FINAL[@]}")" != "$(printf '%s\n' "${ALL_VERSIONS[@]}")" ]]; then
  echo "FEHLER: Repo und Produktionsdatenbank besitzen nach der Recovery nicht dieselbe Migrationshistorie." >&2
  exit 1
fi

POSTCHECK="$(psql_query "
select case when
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='organization_dropdown_options'
      and column_name='parameter_group' and is_nullable='NO'
  )
  and exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='save_dropdown_setting' and p.pronargs=10
  )
  and exists (
    select 1 from pg_trigger t
    where t.tgrelid='public.organizations'::regclass
      and t.tgname='organizations_seed_planning_parameters'
      and not t.tgisinternal
  )
  and not exists (
    select 1 from public.organization_dropdown_options
    where list_key='planning_parameter'
      and parameter_group not in ('volume','distance_geometry','time_recovery','load','execution')
  )
then 'ok' else 'fail' end;")"
if [[ "$POSTCHECK" != "ok" ]]; then
  echo "FEHLER: Postcheck fuer Migration ${FIRST_PENDING_VERSION} ist fehlgeschlagen." >&2
  exit 1
fi

echo "ERFOLG: Produktionsschema 001-039 verifiziert, Historie baselined und Migration ${FIRST_PENDING_VERSION} angewendet."
