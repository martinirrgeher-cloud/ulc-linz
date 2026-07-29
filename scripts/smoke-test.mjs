import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modulesSource = await readFile(new URL("../src/config/modules.tsx", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app/App.tsx", import.meta.url), "utf8");
const countdownSource = await readFile(new URL("../src/pages/CountdownPage.tsx", import.meta.url), "utf8");
const permissionEditorSource = await readFile(new URL("../src/features/user-management/PermissionEditor.tsx", import.meta.url), "utf8");
const moduleListSource = modulesSource.split("export const APP_MODULES")[1] ?? "";
const moduleMatches = [...moduleListSource.matchAll(/key:\s*"([a-z0-9_]+)"[\s\S]*?route:\s*"([^"]+)"/g)];
const modules = moduleMatches.map((match) => ({ key: match[1], route: match[2] }));

test("Modulschlüssel und Routen sind eindeutig", () => {
  assert.ok(modules.length >= 17, "Es wurden unerwartet wenige Module gefunden.");
  assert.equal(new Set(modules.map((module) => module.key)).size, modules.length);
  assert.equal(new Set(modules.map((module) => module.route)).size, modules.length);
});

test("Jedes konfigurierte Modul besitzt eine Route", () => {
  for (const module of modules) {
    assert.ok(
      appSource.includes(`path="${module.route.slice(1)}"`),
      `Route für ${module.key} (${module.route}) fehlt in App.tsx.`,
    );
  }
});

test("Seiten werden per Lazy Loading geladen", () => {
  assert.ok(appSource.includes("lazy(async"));
  assert.ok(appSource.includes("<Suspense"));
  assert.doesNotMatch(appSource, /import\s+\{[^}]+\}\s+from\s+"@\/pages\//);
});

test("Countdown enthält die vereinbarten Kernfunktionen", () => {
  for (const expectedText of [
    "Belastung",
    "Pause",
    "Übungen",
    "Zwischenansage Belastung",
    "Zwischenansage Pause",
    "verbleibende Übungen ansagen",
    "Pausieren",
    "Fortsetzen",
    "Bildschirm bleibt aktiv",
  ]) {
    assert.ok(countdownSource.includes(expectedText), `Countdown-Funktion fehlt: ${expectedText}`);
  }
});


test("Countdown-Eingaben sind frei bearbeitbar", () => {
  assert.ok(countdownSource.includes("numberDrafts"));
  assert.ok(countdownSource.includes('numberFieldHandlers("workAnnouncementInterval")'));
  assert.ok(countdownSource.includes('numberFieldHandlers("restAnnouncementInterval")'));
  assert.doesNotMatch(countdownSource, /<select[\s\S]*?Zwischenansage/);
});

test("Benutzerrechte folgen der Modulgruppierung", () => {
  assert.ok(permissionEditorSource.includes("APP_MODULE_GROUPS"));
  assert.ok(permissionEditorSource.includes('className="permission-group"'));
  assert.ok(permissionEditorSource.includes("group.modules.map"));
});

const editLockApiSource = await readFile(new URL("../src/features/collaboration/edit-locks.ts", import.meta.url), "utf8");
const editLockHookSource = await readFile(new URL("../src/features/collaboration/useEditLock.ts", import.meta.url), "utf8");
const editLockMigrationSource = await readFile(new URL("../supabase/migrations/202607270024_collaboration_edit_locks.sql", import.meta.url), "utf8");
const atomicEditLockMigrationSource = await readFile(new URL("../supabase/migrations/202607290025_atomic_edit_lock_writes.sql", import.meta.url), "utf8");
const importSource = await readFile(new URL("../src/features/data-import/importer.ts", import.meta.url), "utf8");
const backupWorkflowSource = await readFile(new URL("../.github/workflows/weekly-encrypted-backup.yml", import.meta.url), "utf8");
const backupStorageSource = await readFile(new URL("./backup-supabase-storage.mjs", import.meta.url), "utf8");


test("Bearbeitungsschutz reserviert, verlängert und prüft Datensätze", () => {
  for (const functionName of [
    "acquire_edit_lock",
    "renew_edit_lock",
    "release_edit_lock",
    "assert_edit_lock",
  ]) {
    assert.ok(editLockApiSource.includes(functionName), `RPC fehlt: ${functionName}`);
    assert.ok(editLockMigrationSource.includes(`public.${functionName}`), `Migration fehlt: ${functionName}`);
  }
  assert.ok(editLockHookSource.includes("30_000"), "Heartbeat-Intervall fehlt.");
  assert.ok(editLockHookSource.includes("15_000"), "Automatische Freigabeprüfung fehlt.");
  assert.ok(editLockHookSource.includes("getWriteGuard"), "Schreibschutz für atomare Speicheraufrufe fehlt.");
});


test("Bearbeitungsschutz ist in den gemeinsamen Editoren aktiv", async () => {
  for (const relativePath of [
    "../src/pages/ExerciseCatalogPage.tsx",
    "../src/pages/TrainingBlocksPage.tsx",
    "../src/pages/AthleteManagementPage.tsx",
    "../src/pages/TrainingPlanningPage.tsx",
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.ok(source.includes("useEditLock"), `Bearbeitungsschutz fehlt in ${relativePath}`);
    assert.ok(source.includes("getWriteGuard"), `Atomarer Schreibschutz fehlt in ${relativePath}`);
  }
});


test("Speicher-RPCs prüfen Sperre und Version atomar", () => {
  for (const functionName of [
    "assert_edit_lock_for_write",
    "save_exercise_catalog_item_v3",
    "save_training_block_v2",
    "update_athlete_v4",
    "save_athlete_training_plan_v2",
  ]) {
    assert.ok(atomicEditLockMigrationSource.includes(`public.${functionName}`), `Atomare RPC fehlt: ${functionName}`);
  }
  assert.ok(atomicEditLockMigrationSource.includes("pg_advisory_xact_lock"));
  assert.ok(atomicEditLockMigrationSource.includes("for update"));
  assert.ok(atomicEditLockMigrationSource.includes("p_expected_updated_at"));
  assert.ok(importSource.includes("withImportEditLock"), "Datenimport berücksichtigt Bearbeitungssperren nicht.");
});


test("Wöchentliches Backup ist verschlüsselt und enthält Datenbank sowie Storage", () => {
  assert.ok(backupWorkflowSource.includes('cron: "15 2 * * 1"'));
  assert.ok(backupWorkflowSource.includes("supabase db dump"));
  assert.ok(backupWorkflowSource.includes("full-database.dump"));
  assert.ok(backupWorkflowSource.includes("backup-supabase-storage.mjs"));
  assert.ok(backupWorkflowSource.includes("--cipher-algo AES256"));
  assert.ok(backupWorkflowSource.includes("RCLONE_CONFIG_B64"));
  assert.ok(backupWorkflowSource.includes("gdrive:ULC-Linz-App-Backups"));
  assert.ok(backupStorageSource.includes("listBuckets"));
  assert.ok(backupStorageSource.includes("storage-manifest.json"));
});
