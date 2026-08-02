import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

const restoreDatabaseUrl = requiredEnvironment("RESTORE_DB_URL");
const backupRoot = path.resolve(requiredEnvironment("BACKUP_ROOT"));
const outputJson = path.resolve(process.env.RESTORE_REPORT_JSON ?? "restore-report.json");
const outputMarkdown = path.resolve(process.env.RESTORE_REPORT_MARKDOWN ?? "restore-report.md");
const backupFile = process.env.BACKUP_FILE?.trim() || "unbekannt";
const encryptedSha256 = process.env.BACKUP_ENCRYPTED_SHA256?.trim() || "unbekannt";
const encryptedBytes = Number(process.env.BACKUP_ENCRYPTED_BYTES ?? 0);
const dumpCatalogEntries = Number(process.env.DUMP_CATALOG_ENTRIES ?? 0);
const migrationHistoryRestored = process.env.MIGRATION_HISTORY_RESTORED === "true";

const requiredTables = [
  "auth.users",
  "storage.buckets",
  "storage.objects",
  "public.organizations",
  "public.organization_members",
  "public.athletes",
  "public.trainers",
  "public.training_groups",
  "public.exercises",
  "public.training_blocks",
  "public.training_sessions",
  "public.edit_locks",
];

function queryDatabase(databaseUrl) {
  const sql = String.raw`
create temporary table restore_table_counts (
  schema_name text not null,
  table_name text not null,
  row_count bigint not null,
  primary key (schema_name, table_name)
);

create temporary table restore_metadata (
  key text primary key,
  value text
);

do $restore$
declare
  relation record;
  count_value bigint;
  migration_value text;
begin
  for relation in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('public', 'auth', 'storage', 'supabase_migrations')
    order by n.nspname, c.relname
  loop
    execute format('select count(*) from %I.%I', relation.schema_name, relation.table_name)
      into count_value;
    insert into restore_table_counts(schema_name, table_name, row_count)
      values (relation.schema_name, relation.table_name, count_value);
  end loop;

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select max(version)::text from supabase_migrations.schema_migrations'
      into migration_value;
    insert into restore_metadata(key, value)
      values ('latest_migration', migration_value);
  end if;
end
$restore$;

select jsonb_build_object(
  'serverVersion', current_setting('server_version'),
  'schemas', (
    select count(*)
    from pg_catalog.pg_namespace
    where nspname not like 'pg_%' and nspname <> 'information_schema'
  ),
  'tables', (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname not like 'pg_%'
      and n.nspname <> 'information_schema'
  ),
  'publicTables', (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname = 'public'
  ),
  'publicRlsTables', (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname = 'public' and c.relrowsecurity
  ),
  'functions', (
    select count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'auth', 'storage')
  ),
  'triggers', (
    select count(*)
    from pg_catalog.pg_trigger
    where not tgisinternal
  ),
  'latestMigration', (
    select value from restore_metadata where key = 'latest_migration'
  ),
  'tableCounts', coalesce((
    select jsonb_object_agg(schema_name || '.' || table_name, row_count order by schema_name, table_name)
    from restore_table_counts
  ), '{}'::jsonb)
)::text;
`;

  const result = spawnSync(
    "docker",
    [
      "run", "--rm", "-i", "--network", "host", "postgres:17-alpine",
      "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", databaseUrl,
    ],
    { input: sql, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    throw new Error(`Datenbankprüfung fehlgeschlagen: ${result.stderr || result.stdout}`);
  }

  const output = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!output) throw new Error("Datenbankprüfung lieferte kein Ergebnis.");
  return JSON.parse(output);
}

function missingTables(report, required) {
  const existing = new Set(Object.keys(report.tableCounts ?? {}));
  return required.filter((table) => !existing.has(table));
}

function numberValue(report, table) {
  const value = Number(report.tableCounts?.[table] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

const migrationFiles = (await readdir(path.join(backupRoot, "project", "migrations")))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
if (migrationFiles.length === 0) throw new Error("Im Backup wurden keine Migrationen gefunden.");
const expectedMigration = migrationFiles.at(-1).match(/^(\d+)/)?.[1];
if (!expectedMigration) throw new Error("Die neueste Migration besitzt keine Versionsnummer.");

const storageManifest = JSON.parse(
  await readFile(path.join(backupRoot, "storage", "storage-manifest.json"), "utf8"),
);
const manifestBuckets = Array.isArray(storageManifest.buckets) ? storageManifest.buckets : [];
const manifestFiles = manifestBuckets.reduce((sum, bucket) => sum + (bucket.objects?.length ?? 0), 0);
const manifestBytes = manifestBuckets.reduce(
  (bucketSum, bucket) => bucketSum + (bucket.objects ?? []).reduce(
    (objectSum, object) => objectSum + Number(object.localSize ?? 0),
    0,
  ),
  0,
);

const restored = queryDatabase(restoreDatabaseUrl);
const missing = missingTables(restored, requiredTables);
const keyCounts = {
  organizations: numberValue(restored, "public.organizations"),
  organizationMembers: numberValue(restored, "public.organization_members"),
  authUsers: numberValue(restored, "auth.users"),
  athletes: numberValue(restored, "public.athletes"),
  trainers: numberValue(restored, "public.trainers"),
  trainingGroups: numberValue(restored, "public.training_groups"),
  exercises: numberValue(restored, "public.exercises"),
  trainingBlocks: numberValue(restored, "public.training_blocks"),
  trainingSessions: numberValue(restored, "public.training_sessions"),
  storageObjectsMetadata: numberValue(restored, "storage.objects"),
};

const warnings = [];
if (!migrationHistoryRestored) {
  warnings.push(
    "Dieses ältere Backup enthält noch keinen separaten Export der Supabase-Migrationshistorie. "
    + "Der Projektstand wird daher anhand der im Archiv enthaltenen Migrationsdateien dokumentiert.",
  );
}
if (keyCounts.storageObjectsMetadata !== manifestFiles) {
  warnings.push(
    `Storage-Metadaten=${keyCounts.storageObjectsMetadata}, gesicherte Dateien=${manifestFiles}. `
    + "Abweichungen können auf während des Backups laufende Uploads oder verwaiste Metadaten hinweisen.",
  );
}

const failures = [];
if (missing.length > 0) failures.push(`Fehlende Tabellen nach dem Restore: ${missing.join(", ")}`);
if (migrationHistoryRestored && restored.latestMigration !== expectedMigration) {
  failures.push(
    `Migrationsstand stimmt nicht: Restore=${restored.latestMigration ?? "fehlt"}, Backup=${expectedMigration}`,
  );
}
if (keyCounts.organizations < 1) failures.push("Der Restore enthält keine Organisation.");
if (keyCounts.organizationMembers < 1) failures.push("Der Restore enthält keine Organisationsmitgliedschaft.");
if (keyCounts.authUsers < 1) failures.push("Der Restore enthält keinen Auth-Benutzer.");
if (dumpCatalogEntries < 1) failures.push("Der Katalog des zusätzlichen PostgreSQL-Rohdumps ist leer.");

const report = {
  createdAt: new Date().toISOString(),
  backupFile,
  encryptedArchive: {
    sha256: encryptedSha256,
    bytes: encryptedBytes,
  },
  rawDumpCatalogEntries: dumpCatalogEntries,
  expectedMigration,
  migrationFiles: migrationFiles.length,
  migrationHistoryRestored,
  logicalRestore: restored,
  keyCounts,
  storageManifest: {
    buckets: manifestBuckets.length,
    files: manifestFiles,
    bytes: manifestBytes,
  },
  warnings,
  failures,
  status: failures.length === 0 ? "success" : "failed",
};

const markdown = [
  "# E3d Backup-Wiederherstellungsbericht",
  "",
  `- Backup: \`${backupFile}\``,
  `- Ergebnis: **${report.status === "success" ? "erfolgreich" : "fehlgeschlagen"}**`,
  `- Verschlüsseltes Archiv: ${encryptedBytes} Byte`,
  `- SHA-256: \`${encryptedSha256}\``,
  `- Katalogeinträge im zusätzlichen Rohdump: ${dumpCatalogEntries}`,
  `- Migrationen im Backup: ${migrationFiles.length}`,
  `- Neueste Projektmigration: \`${expectedMigration}\``,
  `- Migrationshistorie separat wiederhergestellt: ${migrationHistoryRestored ? "ja" : "nein"}`,
  "",
  "## Logischer Supabase-Restore",
  "",
  `- Tabellen: ${restored.tables}`,
  `- Public-Tabellen: ${restored.publicTables}`,
  `- Public-Tabellen mit RLS: ${restored.publicRlsTables}`,
  `- Funktionen: ${restored.functions}`,
  `- Trigger: ${restored.triggers}`,
  `- Organisationen: ${keyCounts.organizations}`,
  `- Mitglieder: ${keyCounts.organizationMembers}`,
  `- Auth-Benutzer: ${keyCounts.authUsers}`,
  `- Athleten: ${keyCounts.athletes}`,
  `- Trainer: ${keyCounts.trainers}`,
  "",
  "## Storage-Manifest",
  "",
  `- Buckets: ${manifestBuckets.length}`,
  `- Dateien: ${manifestFiles}`,
  `- Datenmenge: ${manifestBytes} Byte`,
  "",
  ...(warnings.length > 0 ? ["## Hinweise", "", ...warnings.map((warning) => `- ${warning}`), ""] : []),
  ...(failures.length > 0 ? ["## Fehler", "", ...failures.map((failure) => `- ${failure}`), ""] : []),
].join("\n");

await mkdir(path.dirname(outputJson), { recursive: true });
await mkdir(path.dirname(outputMarkdown), { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(outputMarkdown, `${markdown}\n`, "utf8");

console.log(markdown);
if (failures.length > 0) process.exitCode = 1;
