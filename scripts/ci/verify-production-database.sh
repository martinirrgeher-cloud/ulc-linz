#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL fehlt}"
REPORT_DIR="${ULC_BACKEND_REPORT_DIR:-.ulc-production-backend}"
mkdir -p "$REPORT_DIR"

find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
  | sed -E 's/^([0-9]+)_.*/\1/' \
  | sort -u > "$REPORT_DIR/local-migrations.txt"

docker run --rm postgres:17-alpine \
  psql "$SUPABASE_DB_URL" -At \
  -c 'select version from supabase_migrations.schema_migrations order by version;' \
  | tr -d '\r' \
  | sed '/^[[:space:]]*$/d' \
  | sort -u > "$REPORT_DIR/remote-migrations.txt"

if ! diff -u "$REPORT_DIR/local-migrations.txt" "$REPORT_DIR/remote-migrations.txt" \
  > "$REPORT_DIR/migration-history.diff"; then
  echo "FEHLER: Produktionsdatenbank und Repository besitzen nicht dieselbe Migrationshistorie." >&2
  cat "$REPORT_DIR/migration-history.diff" >&2
  exit 1
fi

echo "Migrationshistorie stimmt exakt ueberein: $(wc -l < "$REPORT_DIR/local-migrations.txt") Migrationen."

# Ein Shadow-DB-Stand aus exakt den Repository-Migrationen wird mit dem
# produktiven public-Schema verglichen. Die Historientabelle allein reicht
# nicht als Nachweis, weil manuelle Schemaaenderungen sonst unsichtbar waeren.
supabase db diff --db-url "$SUPABASE_DB_URL" --schema public --use-migra \
  > "$REPORT_DIR/public-schema-diff.sql"

if grep -Ev '^[[:space:]]*(--.*)?$' "$REPORT_DIR/public-schema-diff.sql" | grep -q '[^[:space:]]'; then
  echo "FEHLER: Das produktive public-Schema weicht vom Repository-Migrationsstand ab." >&2
  cat "$REPORT_DIR/public-schema-diff.sql" >&2
  exit 1
fi

echo "Public-Schema stimmt mit dem Repository-Migrationsstand ueberein."

# Storage-Buckets und Realtime-Publication liegen ausserhalb eines reinen
# public-Schema-Diffs und werden deshalb separat verifiziert.
docker run --rm postgres:17-alpine psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "select id from storage.buckets where id in ('exercise-videos','training-documentation-media') order by id;" \
  > "$REPORT_DIR/storage-buckets.txt"
printf '%s\n' 'exercise-videos' 'training-documentation-media' > "$REPORT_DIR/expected-storage-buckets.txt"
if ! diff -u "$REPORT_DIR/expected-storage-buckets.txt" "$REPORT_DIR/storage-buckets.txt" \
  > "$REPORT_DIR/storage-buckets.diff"; then
  echo "FEHLER: Die produktiven Storage-Buckets entsprechen nicht dem erwarteten Stand." >&2
  cat "$REPORT_DIR/storage-buckets.diff" >&2
  exit 1
fi

EXPECTED_REALTIME_TABLES=(
  athletes
  training_groups
  trainers
  exercises
  training_blocks
  athlete_training_plans
  athlete_training_sessions
  training_block_user_favorites
  organization_members
  audit_log
)
printf '%s\n' "${EXPECTED_REALTIME_TABLES[@]}" | sort > "$REPORT_DIR/expected-realtime-tables.txt"

docker run --rm postgres:17-alpine psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "select p.tablename from pg_publication_tables p join pg_class c on c.oid=to_regclass(format('%I.%I',p.schemaname,p.tablename)) where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename in ('athletes','training_groups','trainers','exercises','training_blocks','athlete_training_plans','athlete_training_sessions','training_block_user_favorites','organization_members','audit_log') and c.relreplident='f' order by p.tablename;" \
  | sort > "$REPORT_DIR/realtime-tables.txt"
if ! diff -u "$REPORT_DIR/expected-realtime-tables.txt" "$REPORT_DIR/realtime-tables.txt" \
  > "$REPORT_DIR/realtime-tables.diff"; then
  echo "FEHLER: Realtime-Publication oder REPLICA IDENTITY FULL ist unvollstaendig." >&2
  cat "$REPORT_DIR/realtime-tables.diff" >&2
  exit 1
fi

echo "Storage- und Realtime-Postconditions sind erfuellt."
