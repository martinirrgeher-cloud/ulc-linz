#!/usr/bin/env bash
set -euo pipefail

EXPECTED_MAIN_SHA="${EXPECTED_MAIN_SHA:-9b11be2dc1234b38742d20262b41317947d9baed}"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-feature/db-diagnose-fast}"
EXPECTED_MIGRATION_COUNT=39
EXPECTED_LAST_VERSION="202608090040"
DB_URL="${SUPABASE_DB_URL:-${1:-}}"
ROOT="$(pwd)"
REPORT_DIR="${ULC_DB_RESET_REPORT_DIR:-$ROOT/ulc-db-reset-artifact}"

rm -rf "$REPORT_DIR"
mkdir -p "$REPORT_DIR"
: > "$REPORT_DIR/ERRORS.txt"

fail() {
  printf 'FEHLER: %s\n' "$1" | tee -a "$REPORT_DIR/ERRORS.txt" >&2
  exit 1
}

sanitize_file() {
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

if [[ -z "$DB_URL" ]]; then
  fail "SUPABASE_DB_URL fehlt."
fi
command -v supabase >/dev/null 2>&1 || fail "Supabase CLI ist nicht verfuegbar."
command -v docker >/dev/null 2>&1 || fail "Docker ist nicht verfuegbar."
command -v git >/dev/null 2>&1 || fail "Git ist nicht verfuegbar."

if [[ "${GITHUB_REF:-}" != "refs/heads/${EXPECTED_BRANCH}" ]]; then
  fail "Neuaufbau ist nur auf ${EXPECTED_BRANCH} erlaubt."
fi

mapfile -t ALL_VERSIONS < <(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
    | sed -E 's/^([0-9]+)_.*/\1/' \
    | sort -u
)
if [[ "${#ALL_VERSIONS[@]}" -ne "$EXPECTED_MIGRATION_COUNT" ]]; then
  fail "Es werden exakt ${EXPECTED_MIGRATION_COUNT} Repository-Migrationen erwartet; gefunden: ${#ALL_VERSIONS[@]}."
fi
if [[ "${ALL_VERSIONS[-1]}" != "$EXPECTED_LAST_VERSION" ]]; then
  fail "Letzte erwartete Migration ist ${EXPECTED_LAST_VERSION}; gefunden: ${ALL_VERSIONS[-1]}."
fi
printf '%s\n' "${ALL_VERSIONS[@]}" > "$REPORT_DIR/repository-migrations.txt"

# Die Fast-Lane ist absichtlich nur fuer den bereits diagnostizierten Altzustand
# mit leerer Remote-Migrationshistorie erlaubt. So kann sie spaeter nicht
# versehentlich als normaler Produktions-Reset wiederverwendet werden.
remote_history_exists="$(docker run --rm postgres:17-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "select case when to_regclass('supabase_migrations.schema_migrations') is null then '0' else '1' end;")"
if [[ "$remote_history_exists" == "1" ]]; then
  mapfile -t REMOTE_BEFORE < <(
    docker run --rm postgres:17-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
      "select version from supabase_migrations.schema_migrations order by version;"
  )
else
  REMOTE_BEFORE=()
fi
printf '%s\n' "${REMOTE_BEFORE[@]:-}" | sed '/^[[:space:]]*$/d' > "$REPORT_DIR/remote-migrations-before.txt"
if [[ "${#REMOTE_BEFORE[@]}" -ne 0 ]]; then
  fail "Die einmalige Recovery erwartet weiterhin eine vollstaendig leere Remote-Migrationshistorie."
fi

# Vor dem destruktiven Schritt sichern wir das benutzerdefinierte public-Schema
# und dessen Daten. Auth-/Storage-Verwaltungsschemas werden bewusst nicht als
# Restore-Quelle benutzt; das Artefakt ist nur ein kurzfristiges Notfallnetz.
echo "Sichere public-Schema vor dem Neuaufbau..."
if ! supabase db dump --db-url "$DB_URL" --schema public --file "$REPORT_DIR/pre-reset-public-schema.sql" > "$REPORT_DIR/pre-reset-schema.log" 2>&1; then
  sanitize_file "$REPORT_DIR/pre-reset-schema.log"
  fail "Public-Schema-Backup vor dem Reset ist fehlgeschlagen."
fi
sanitize_file "$REPORT_DIR/pre-reset-schema.log"

echo "Sichere public-Daten vor dem Neuaufbau..."
if ! supabase db dump --db-url "$DB_URL" --schema public --data-only --use-copy --file "$REPORT_DIR/pre-reset-public-data.sql" > "$REPORT_DIR/pre-reset-data.log" 2>&1; then
  sanitize_file "$REPORT_DIR/pre-reset-data.log"
  fail "Public-Datenbackup vor dem Reset ist fehlgeschlagen."
fi
sanitize_file "$REPORT_DIR/pre-reset-data.log"

# Nicht-personenbezogene Vorher-Zaehlung fuer Nachvollziehbarkeit.
PRE_RESET_COUNTS_SQL=$(cat <<'SQL'
select 'auth_users=' || count(*)::text from auth.users;
select 'organizations=' || count(*)::text from public.organizations;
select 'athletes=' || count(*)::text from public.athletes;
select 'exercises=' || count(*)::text from public.exercises;
select 'training_blocks=' || count(*)::text from public.training_blocks;
select 'storage_objects=' || count(*)::text from storage.objects;
SQL
)
docker run --rm postgres:17-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "$PRE_RESET_COUNTS_SQL" \
  > "$REPORT_DIR/pre-reset-counts.txt"

# Vor dem ersten und einzigen destruktiven Befehl pruefen wir die von der
# gepinnten CLI angebotenen Flags. --no-seed ist zwingend, weil seed.sql nur
# fuer lokale E2E-Umgebungen bestimmt ist.
supabase --help > "$REPORT_DIR/supabase-help.txt" 2>&1
sanitize_file "$REPORT_DIR/supabase-help.txt"
grep -q -- '--yes' "$REPORT_DIR/supabase-help.txt" || fail "Supabase CLI bietet keinen globalen --yes-Schalter fuer CI."

supabase db reset --help > "$REPORT_DIR/db-reset-help.txt" 2>&1
sanitize_file "$REPORT_DIR/db-reset-help.txt"
grep -q -- '--db-url' "$REPORT_DIR/db-reset-help.txt" || fail "Supabase CLI bietet fuer db reset kein --db-url."
grep -q -- '--no-seed' "$REPORT_DIR/db-reset-help.txt" || fail "Supabase CLI bietet fuer db reset kein --no-seed."

cat > "$REPORT_DIR/RESET-AUTHORIZATION.txt" <<EOF
branch=${EXPECTED_BRANCH}
workflow_sha=${GITHUB_SHA:-unknown}
target_main_sha=${EXPECTED_MAIN_SHA}
confirmation=PRODUKTION-NEU-AUFBAUEN
migration_count=${#ALL_VERSIONS[@]}
last_migration=${EXPECTED_LAST_VERSION}
seed=DISABLED
EOF

echo "ACHTUNG: Starte jetzt den einmaligen destruktiven Neuaufbau der Produktionsdatenbank."
if ! supabase --yes db reset --db-url "$DB_URL" --no-seed > "$REPORT_DIR/db-reset.log" 2>&1; then
  sanitize_file "$REPORT_DIR/db-reset.log"
  fail "supabase db reset ist fehlgeschlagen. Siehe db-reset.log im Artefakt."
fi
sanitize_file "$REPORT_DIR/db-reset.log"

# Remote reset laesst Supabase-verwaltete Auth-Benutzer typischerweise bestehen.
# Bereits vorhandene Benutzer erhalten den bei einem Neuregistrierungs-Trigger
# normalerweise erzeugten public.profiles-Datensatz erneut. Das stellt keine
# alten Vereins-/Trainingsdaten wieder her.
echo "Synchronisiere Profile fuer eventuell bestehende Auth-Benutzer..."
docker run --rm postgres:17-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
insert into public.profiles (id, display_name)
select
  auth_user.id,
  coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(auth_user.email, ''), '@', 1),
    ''
  )
from auth.users auth_user
on conflict (id) do nothing;
SQL

# Exakte Migrationshistorie pruefen.
find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
  | sed -E 's/^([0-9]+)_.*/\1/' \
  | sort -u > "$REPORT_DIR/local-migrations-after.txt"

docker run --rm postgres:17-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "select version from supabase_migrations.schema_migrations order by version;" \
  | tr -d '\r' | sed '/^[[:space:]]*$/d' | sort -u > "$REPORT_DIR/remote-migrations-after.txt"

if ! diff -u "$REPORT_DIR/local-migrations-after.txt" "$REPORT_DIR/remote-migrations-after.txt" > "$REPORT_DIR/migration-history.diff"; then
  fail "Nach dem Reset stimmt die Remote-Migrationshistorie nicht exakt mit dem Repository ueberein."
fi

# Kritische fachliche/technische Postconditions, inklusive des urspruenglichen
# Auswahllistenfehlers durch die fehlende Migration 040.
POSTCHECK_SQL=$(cat <<'SQL'
select case when exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='organization_dropdown_options' and column_name='parameter_group'
) then 'parameter_group=ok' else 'parameter_group=missing' end;

select case when exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='save_dropdown_setting'
    and pg_get_function_identity_arguments(p.oid) like '%p_parameter_group text%'
) then 'save_dropdown_setting_v10=ok' else 'save_dropdown_setting_v10=missing' end;

select case when exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='training_blocks' and column_name='usage_count'
) then 'training_blocks_usage_count=ok' else 'training_blocks_usage_count=missing' end;

select 'storage_buckets=' || count(*)::text
from storage.buckets where id in ('exercise-videos','training-documentation-media');

select 'realtime_tables=' || count(*)::text
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public'
  and tablename in ('athletes','training_groups','trainers','exercises','training_blocks','athlete_training_plans','athlete_training_sessions','training_block_user_favorites','organization_members','audit_log');

select 'disabled_statistics_modules=' || count(*)::text
from public.app_modules
where key in ('kindertraining_statistics','u12_statistics','u14_statistics') and is_active=false;
SQL
)
docker run --rm postgres:17-alpine psql "$DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "$POSTCHECK_SQL" > "$REPORT_DIR/postconditions.txt"

grep -qx 'parameter_group=ok' "$REPORT_DIR/postconditions.txt" || fail "Migration-040-Spalte parameter_group fehlt nach Reset."
grep -qx 'save_dropdown_setting_v10=ok' "$REPORT_DIR/postconditions.txt" || fail "Neue save_dropdown_setting-Signatur fehlt nach Reset."
grep -qx 'training_blocks_usage_count=ok' "$REPORT_DIR/postconditions.txt" || fail "training_blocks.usage_count fehlt nach Reset."
grep -qx 'storage_buckets=2' "$REPORT_DIR/postconditions.txt" || fail "Erwartete Storage-Buckets fehlen nach Reset."
grep -qx 'realtime_tables=10' "$REPORT_DIR/postconditions.txt" || fail "Realtime-Publication ist nach Reset nicht vollstaendig."
grep -qx 'disabled_statistics_modules=3' "$REPORT_DIR/postconditions.txt" || fail "Statistikrechte-Konsolidierung ist nach Reset nicht vollstaendig."

# Schema-Drift nach frischem Aufbau muss fuer public verschwunden sein.
echo "Pruefe public-Schema gegen alle 39 Repository-Migrationen..."
if ! supabase db diff --db-url "$DB_URL" --schema public --use-migra > "$REPORT_DIR/post-reset-schema-diff.sql" 2> "$REPORT_DIR/post-reset-schema-diff.log"; then
  sanitize_file "$REPORT_DIR/post-reset-schema-diff.log"
  fail "Schema-Diff nach Reset ist technisch fehlgeschlagen."
fi
sanitize_file "$REPORT_DIR/post-reset-schema-diff.log"
sed -E \
  -e '/^[[:space:]]*$/d' \
  -e '/^[[:space:]]*--/d' \
  -e '/^[[:space:]]*set[[:space:]]+check_function_bodies[[:space:]]*=[[:space:]]*off;?[[:space:]]*$/Id' \
  "$REPORT_DIR/post-reset-schema-diff.sql" > "$REPORT_DIR/post-reset-schema-diff.substantive.sql"
if [[ -s "$REPORT_DIR/post-reset-schema-diff.substantive.sql" ]]; then
  fail "Nach dem frischen Neuaufbau besteht weiterhin public-Schema-Drift."
fi

# Der einmalige Recovery-Branch hat dieselben Migrationen wie der gepinnte
# aktuelle main. Deshalb darf nach vollstaendiger DB-Verifikation der regulare
# database-verified-Nachweis direkt fuer GENAU diesen main-Commit gesetzt werden.
# Das ist die einzige bewusste Ausnahme; der normale main-Workflow bleibt unveraendert.
remote_main="$(git rev-parse origin/main)"
if [[ "$remote_main" != "$EXPECTED_MAIN_SHA" ]]; then
  fail "origin/main hat sich waehrend des Neuaufbaus geaendert; kein Verifikations-Tag wird gesetzt."
fi
if ! git diff --quiet origin/main HEAD -- supabase/migrations; then
  fail "Migrationen des Recovery-Branches unterscheiden sich nach dem Reset von origin/main; kein Verifikations-Tag wird gesetzt."
fi

TAG="database-verified-${EXPECTED_MAIN_SHA}"
existing="$(git ls-remote --tags origin "refs/tags/${TAG}" | awk '{print $1}')"
if [[ -n "$existing" && "$existing" != "$EXPECTED_MAIN_SHA" ]]; then
  fail "Vorhandener Verifikations-Tag ${TAG} zeigt auf einen unerwarteten Commit: ${existing}."
fi
if [[ -z "$existing" ]]; then
  git tag "$TAG" "$EXPECTED_MAIN_SHA"
  git push origin "refs/tags/${TAG}"
fi

cat > "$REPORT_DIR/SUMMARY.txt" <<EOF
status=SUCCESS
reset=COMPLETED
seed=DISABLED
repository_migrations=${#ALL_VERSIONS[@]}
remote_migrations_after=$(wc -l < "$REPORT_DIR/remote-migrations-after.txt" | tr -d ' ')
last_migration=${EXPECTED_LAST_VERSION}
target_main_sha=${EXPECTED_MAIN_SHA}
database_verification_tag=${TAG}
public_schema_drift=NONE
existing_auth_profiles_rehydrated=YES
EOF

# Letzte Redaction-Runde fuer alle Textartefakte.
while IFS= read -r -d '' file; do
  sanitize_file "$file"
done < <(find "$REPORT_DIR" -type f -print0)

echo "ERFOLG: Produktionsdatenbank wurde frisch aus allen 39 Migrationen aufgebaut."
echo "ERFOLG: Verifikations-Tag ${TAG} ist gesetzt."
echo "Vorhandene Vereins-/Trainingsdaten wurden absichtlich nicht wiederhergestellt."
