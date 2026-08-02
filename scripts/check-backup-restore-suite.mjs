import { readFile } from "node:fs/promises";

const workflow = await readFile(
  new URL("../.github/workflows/quarterly-backup-restore-test.yml", import.meta.url),
  "utf8",
);
const weeklyWorkflow = await readFile(
  new URL("../.github/workflows/weekly-encrypted-backup.yml", import.meta.url),
  "utf8",
);
const databaseVerifier = await readFile(
  new URL("./verify-restored-database.mjs", import.meta.url),
  "utf8",
);
const archiveVerifier = await readFile(
  new URL("./verify-backup-archive.mjs", import.meta.url),
  "utf8",
);
const storageRestore = await readFile(
  new URL("./restore-supabase-storage.mjs", import.meta.url),
  "utf8",
);

for (const marker of [
  "supabase init --workdir restore/local-project",
  "Offiziellen logischen Supabase-Export wiederherstellen",
  "roles.sql",
  "schema.sql",
  "data.sql",
  "SET session_replication_role = replica",
  "verify-restored-database.mjs",
  "restore-report",
  "actions/upload-artifact@v4",
  "pg_restore --list",
  "--report-json=restore/report/storage-restore.json",
  "supabase stop --workdir restore/local-project --no-backup",
]) {
  if (!workflow.includes(marker)) throw new Error(`E3d Workflow-Marker fehlt: ${marker}`);
}

for (const forbidden of [
  "secrets.SUPABASE_DB_URL",
  "secrets.SUPABASE_URL",
  "secrets.SUPABASE_SERVICE_ROLE_KEY",
  "ulc_restore_full",
  "ulc_restore_portable",
  "pg_restore \\\n              --dbname",
]) {
  if (workflow.includes(forbidden)) {
    throw new Error(`Unzulässige E3d-Konfiguration gefunden: ${forbidden}`);
  }
}

if (!workflow.includes("BACKUP_ENCRYPTION_PASSWORD") || !workflow.includes("RCLONE_CONFIG_B64")) {
  throw new Error("Die bestehenden Backup-Secrets werden nicht verwendet.");
}
for (const marker of [
  "history_schema.sql",
  "history_data.sql",
  "--schema supabase_migrations",
  'storage.buckets_vectors',
  'storage.vector_indexes',
]) {
  if (!weeklyWorkflow.includes(marker)) {
    throw new Error(`Der zukünftige Backup-Export fehlt: ${marker}`);
  }
}
if (!weeklyWorkflow.includes("verify-restored-database.mjs")) {
  throw new Error("Das Backup enthält das E3d-Prüfskript nicht als Wiederherstellungshilfe.");
}
if (!archiveVerifier.includes("migrationHistoryExport")) {
  throw new Error("Die Archivprüfung erkennt den optionalen Migrationshistorien-Export nicht.");
}
if (!archiveVerifier.includes("--json=")) {
  throw new Error("Die Archivprüfung erzeugt keinen JSON-Bericht.");
}
if (!storageRestore.includes("--report-json=")) {
  throw new Error("Die Storage-Wiederherstellung erzeugt keinen JSON-Bericht.");
}
for (const marker of [
  "auth.users",
  "storage.objects",
  "public.organizations",
  "expectedMigration",
  "migrationHistoryRestored",
  "logicalRestore",
  "rawDumpCatalogEntries",
]) {
  if (!databaseVerifier.includes(marker)) {
    throw new Error(`E3d Datenbankprüfung fehlt: ${marker}`);
  }
}

console.log("E3d Backup-Wiederherstellungssuite ist vollständig konfiguriert.");
