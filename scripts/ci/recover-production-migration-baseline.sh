#!/usr/bin/env bash
set -euo pipefail

BASELINE_VERSION="202608080039"
FIRST_PENDING_VERSION="202608090040"
EXPECTED_BASELINE_COUNT=38
EXPECTED_TOTAL_COUNT=39
DB_URL="${SUPABASE_DB_URL:-${1:-}}"
ROOT="$(pwd)"
REPORT_DIR="${ULC_DB_BASELINE_REPORT_DIR:-$ROOT/ulc-db-baseline-diagnostic}"

rm -rf "$REPORT_DIR"
mkdir -p "$REPORT_DIR"
: > "$REPORT_DIR/DIAGNOSTIC-ERRORS.txt"

if [[ -z "$DB_URL" ]]; then
  echo "FEHLER: SUPABASE_DB_URL fehlt." | tee -a "$REPORT_DIR/DIAGNOSTIC-ERRORS.txt" >&2
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
  echo "FEHLER: Fuer die Diagnose werden exakt ${EXPECTED_TOTAL_COUNT} Repository-Migrationen erwartet; gefunden: ${#ALL_VERSIONS[@]}." >&2
  exit 1
fi
if [[ "${#BASELINE_VERSIONS[@]}" -ne "$EXPECTED_BASELINE_COUNT" ]]; then
  echo "FEHLER: Baseline bis ${BASELINE_VERSION} ist unerwartet: ${#BASELINE_VERSIONS[@]} statt ${EXPECTED_BASELINE_COUNT} Migrationen." >&2
  exit 1
fi
if [[ "${#PENDING_VERSIONS[@]}" -ne 1 || "${PENDING_VERSIONS[0]}" != "$FIRST_PENDING_VERSION" ]]; then
  echo "FEHLER: Nach der Baseline darf fuer diese einmalige Diagnose ausschliesslich ${FIRST_PENDING_VERSION} offen sein." >&2
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
  echo "FEHLER: Diese historische Diagnose ist nur fuer die noch vollstaendig leere Remote-Migrationshistorie erlaubt." >&2
  printf 'Remote vorhanden: %s\n' "${REMOTE_VERSIONS[*]}" >&2
  exit 1
fi

printf '%s\n' "${ALL_VERSIONS[@]}" > "$REPORT_DIR/repository-migrations.txt"
: > "$REPORT_DIR/remote-migrations.txt"

sanitize_report_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  REPORT_FILE="$file" DB_URL_SECRET="$DB_URL" node - <<'NODE'
const fs = require("node:fs");
const file = process.env.REPORT_FILE;
const secret = process.env.DB_URL_SECRET ?? "";
let text = fs.readFileSync(file, "utf8");
if (secret) text = text.split(secret).join("[REDACTED_DB_URL]");
fs.writeFileSync(file, text, "utf8");
NODE
}

DIAGNOSTIC_ERROR_COUNT=0

record_diagnostic_error() {
  local label="$1"
  local output="$2"
  DIAGNOSTIC_ERROR_COUNT=$((DIAGNOSTIC_ERROR_COUNT + 1))
  {
    printf '[%s] %s\n' "$DIAGNOSTIC_ERROR_COUNT" "$label"
    printf '%s\n\n' "$output"
  } >> "$REPORT_DIR/DIAGNOSTIC-ERRORS.txt"
}

diagnostic_query() {
  local label="$1"
  local sql="$2"
  local output
  if output="$(psql_query "$sql" 2>&1)"; then
    printf '%s\n' "$output"
    return 0
  fi
  record_diagnostic_error "$label" "$output"
  printf 'DIAGNOSEFEHLER: %s (Details in DIAGNOSTIC-ERRORS.txt)\n' "$label"
  return 0
}

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

echo "Erzeuge Schema-Diff Repository-Baseline 001-039 -> Produktion..."
FORWARD_SQL="$REPORT_DIR/baseline-001-039-to-production.sql"
FORWARD_LOG="$REPORT_DIR/baseline-001-039-to-production.log"
DIFF_STATUS="ok"
if ! (
  cd "$TEMP_ROOT/project"
  # Supabase CLI 2.109.1 schreibt den Diff auf stdout. Neuere Richtungs- und
  # Output-Flags werden in dieser gepinnten CLI-Version bewusst nicht verwendet.
  supabase db diff --db-url "$DB_URL" --schema public --use-migra > "$FORWARD_SQL" 2> "$FORWARD_LOG"
); then
  DIFF_STATUS="failed"
  record_diagnostic_error "schema-diff" "$(cat "$FORWARD_LOG" 2>/dev/null || true)"
  echo "WARNUNG: Schema-Diff ist fehlgeschlagen; weitere Diagnose wird trotzdem gesammelt." >&2
fi
touch "$FORWARD_SQL" "$FORWARD_LOG"
sanitize_report_file "$FORWARD_LOG"

echo "Erzeuge schema-only Dump der produktiven public-Schemaobjekte..."
DUMP_STATUS="ok"
if ! supabase db dump \
  --db-url "$DB_URL" \
  --schema public \
  --file "$REPORT_DIR/production-public-schema.sql" \
  > "$REPORT_DIR/production-public-schema.log" 2>&1; then
  DUMP_STATUS="failed"
  record_diagnostic_error "schema-dump" "$(cat "$REPORT_DIR/production-public-schema.log" 2>/dev/null || true)"
  echo "WARNUNG: Schema-Dump ist fehlgeschlagen; weitere Diagnose wird trotzdem gesammelt." >&2
fi
touch "$REPORT_DIR/production-public-schema.sql" "$REPORT_DIR/production-public-schema.log"
sanitize_report_file "$REPORT_DIR/production-public-schema.log"

echo "Erzeuge gezielte, nicht personenbezogene Produktions-Invarianten..."
{
  echo "# ULC Linz App – Produktionsdatenbank Baseline-Diagnose"
  echo "baseline_version=${BASELINE_VERSION}"
  echo "first_pending_version=${FIRST_PENDING_VERSION}"
  echo "repository_migration_count=${#ALL_VERSIONS[@]}"
  echo "remote_migration_count=${#REMOTE_VERSIONS[@]}"
  echo

  echo "## Kernobjekte"
  diagnostic_query "invariant-01" "select 'training_blocks.usage_count=' || case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='training_blocks' and column_name='usage_count') then 'present' else 'missing' end;"
  diagnostic_query "invariant-02" "select 'organization_dropdown_options.parameter_group=' || case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_dropdown_options' and column_name='parameter_group') then 'present' else 'missing' end;"
  diagnostic_query "invariant-03" "select 'kindertraining_statistics_overview.signatures=' || coalesce(string_agg(pg_get_function_identity_arguments(p.oid), ' | ' order by pg_get_function_identity_arguments(p.oid)), '(none)') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kindertraining_statistics_overview';"
  diagnostic_query "invariant-04" "select 'training_module_statistics_overview.signatures=' || coalesce(string_agg(pg_get_function_identity_arguments(p.oid), ' | ' order by pg_get_function_identity_arguments(p.oid)), '(none)') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='training_module_statistics_overview';"
  diagnostic_query "invariant-05" "select 'apply_exercise_import_v2.signatures=' || coalesce(string_agg(pg_get_function_identity_arguments(p.oid), ' | ' order by pg_get_function_identity_arguments(p.oid)), '(none)') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='apply_exercise_import_v2';"
  diagnostic_query "invariant-06" "select 'save_dropdown_setting.signatures=' || coalesce(string_agg(pg_get_function_identity_arguments(p.oid), ' | ' order by pg_get_function_identity_arguments(p.oid)), '(none)') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_dropdown_setting';"
  echo

  echo "## App-Module"
  diagnostic_query "invariant-07" "select key || E'\\t' || is_active::text from public.app_modules order by key;"
  echo

  echo "## Storage-Buckets"
  diagnostic_query "invariant-08" "select id || E'\\tpublic=' || public::text || E'\\tlimit=' || coalesce(file_size_limit::text,'null') || E'\\tmimes=' || coalesce(array_to_string(allowed_mime_types,','),'null') from storage.buckets where id in ('exercise-videos','training-documentation-media') order by id;"
  echo

  echo "## Storage-Policies"
  diagnostic_query "invariant-09" "select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('exercise_videos_storage_select','exercise_videos_storage_insert','exercise_videos_storage_update','exercise_videos_storage_delete','training_documentation_media_storage_select','training_documentation_media_storage_insert','training_documentation_media_storage_update','training_documentation_media_storage_delete') order by policyname;"
  echo

  echo "## Auth-Trigger"
  diagnostic_query "invariant-10" "select t.tgname || E'\\t' || pn.nspname || '.' || p.proname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where n.nspname='auth' and c.relname='users' and t.tgname='on_auth_user_created' and not t.tgisinternal;"
  echo

  echo "## Realtime"
  diagnostic_query "invariant-11" "select p.tablename || E'\\treplident=' || c.relreplident::text from pg_publication_tables p join pg_class c on c.oid=to_regclass(format('%I.%I',p.schemaname,p.tablename)) where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename in ('athletes','training_groups','trainers','exercises','training_blocks','athlete_training_plans','athlete_training_sessions','training_block_user_favorites','organization_members','audit_log') order by p.tablename;"
  echo

  echo "## Statistikrechte"
  diagnostic_query "invariant-12" "select key || E'\\t' || is_active::text from public.app_modules where key in ('kindertraining_statistics','u12_statistics','u14_statistics') order by key;"
  echo

  echo "## Planning-Parameter (nur technische Keys/Gruppe)"
  parameter_group_present="$(psql_query "select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_dropdown_options' and column_name='parameter_group') then '1' else '0' end;" 2>/dev/null || printf 'unknown')"
  if [[ "$parameter_group_present" == "1" ]]; then
    diagnostic_query "planning-parameter-with-group" "select option_key || E'\\t' || parameter_group from public.organization_dropdown_options where list_key='planning_parameter' group by option_key, parameter_group order by option_key, parameter_group;"
  elif [[ "$parameter_group_present" == "0" ]]; then
    diagnostic_query "planning-parameter-without-group" "select option_key from public.organization_dropdown_options where list_key='planning_parameter' group by option_key order by option_key;"
  else
    record_diagnostic_error "planning-parameter-column-check" "Spaltenpruefung organization_dropdown_options.parameter_group ist fehlgeschlagen."
    echo "DIAGNOSEFEHLER: planning-parameter-column-check (Details in DIAGNOSTIC-ERRORS.txt)"
  fi
} > "$REPORT_DIR/production-invariants.txt"

normalize_diff() {
  local input="$1"
  local output="$2"
  sed -E \
    -e '/^[[:space:]]*$/d' \
    -e '/^[[:space:]]*--/d' \
    -e '/^[[:space:]]*set[[:space:]]+check_function_bodies[[:space:]]*=[[:space:]]*off;?[[:space:]]*$/Id' \
    "$input" > "$output"
}
normalize_diff "$FORWARD_SQL" "$REPORT_DIR/baseline-001-039-to-production.substantive.sql"

FORWARD_LINES="$(wc -l < "$REPORT_DIR/baseline-001-039-to-production.substantive.sql" | tr -d ' ')"
FORWARD_SHA="$(sha256sum "$FORWARD_SQL" | awk '{print $1}')"
DUMP_SHA="$(sha256sum "$REPORT_DIR/production-public-schema.sql" | awk '{print $1}')"

cat > "$REPORT_DIR/README.txt" <<EOF_README
ULC Linz App – Produktionsdatenbank Baseline-Diagnose

Diese Diagnose ist strikt READ-ONLY. Sie fuehrt weder migration repair noch db push,
DB-Reset, Seeds oder sonstige schreibende SQL-Befehle gegen Produktion aus.

Dateien:
- baseline-001-039-to-production.sql
  Supabase-CLI-2.109.1-Diff vom durch Migrationen 001-039 rekonstruierten
  Repository-Stand zum aktuellen Produktionsstand. Der Diff wird direkt aus
  stdout erfasst; es werden keine in dieser CLI-Version unbekannten neueren
  Richtungs- oder Output-Flags verwendet.
- baseline-001-039-to-production.substantive.sql
  Gleicher Diff ohne Leer-/Kommentarzeilen und technische SET-Zeilen.
- production-public-schema.sql
  Schema-only Dump von public, ohne Tabellendaten.
- production-invariants.txt
  Nicht personenbezogene technische Invarianten fuer Auth/Storage/Realtime/Module.
- repository-migrations.txt / remote-migrations.txt
  Erwartete Repository-Versionen und die vor Diagnose gelesene Remote-Historie.
- *.log
  Supabase-CLI-Diagnoselog ohne absichtlich ausgegebene DB-URL.

WICHTIG: Der SQL-Diff ist ein Diagnoseartefakt und darf NICHT manuell gegen
Produktion ausgefuehrt werden. Zusammen mit dem Produktions-Schema-Dump und
den Invarianten wird daraus erst nach fachlicher Pruefung die einmalige,
konkret passende Recovery abgeleitet.
EOF_README

# Auch Fehlerdateien koennen CLI-Ausgaben enthalten; vor dem Upload alle
# Textartefakte nochmals gegen die geheime Connection-URL bereinigen.
while IFS= read -r -d '' report_file; do
  sanitize_report_file "$report_file"
done < <(find "$REPORT_DIR" -type f -print0)

cat > "$REPORT_DIR/SUMMARY.txt" <<EOF_SUMMARY
baseline_version=${BASELINE_VERSION}
first_pending_version=${FIRST_PENDING_VERSION}
repository_migrations=${#ALL_VERSIONS[@]}
remote_migrations=${#REMOTE_VERSIONS[@]}
baseline_to_production_substantive_lines=${FORWARD_LINES}
baseline_to_production_sha256=${FORWARD_SHA}
production_public_schema_sha256=${DUMP_SHA}
diff_status=${DIFF_STATUS}
dump_status=${DUMP_STATUS}
diagnostic_query_errors=${DIAGNOSTIC_ERROR_COUNT}
supabase_cli_expected=2.109.1
write_operations=NONE
EOF_SUMMARY

printf 'Diagnose abgeschlossen. Baseline 001-039 -> Produktion: %s substantive Zeilen.\n' "$FORWARD_LINES"
printf 'Diff SHA-256: %s\n' "$FORWARD_SHA"
printf 'Diagnoseabfrage-Fehler: %s\n' "$DIAGNOSTIC_ERROR_COUNT"
echo "Es wurden KEINE Aenderungen an der Produktionsdatenbank vorgenommen."
echo "Das GitHub-Artefakt muss vor jeder Reparatur ausgewertet werden."

# Ein roter Lauf bleibt sichtbar, aber erst NACHDEM der vollstaendige Bericht
# erzeugt wurde. upload-artifact laeuft im Workflow mit if: always().
if [[ "$DIFF_STATUS" != "ok" || "$DUMP_STATUS" != "ok" || "$DIAGNOSTIC_ERROR_COUNT" -gt 0 ]]; then
  echo "FEHLER: Die Diagnose hat Teilfehler gesammelt. Das Artefakt wurde trotzdem vollstaendig vorbereitet." >&2
  exit 1
fi
