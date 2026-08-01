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
const restoreStorageSource = await readFile(new URL("./restore-supabase-storage.mjs", import.meta.url), "utf8");
const verifyBackupSource = await readFile(new URL("./verify-backup-archive.mjs", import.meta.url), "utf8");
const quarterlyRestoreWorkflowSource = await readFile(new URL("../.github/workflows/quarterly-backup-restore-test.yml", import.meta.url), "utf8");


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
  assert.ok(importSource.includes("applyExerciseImport"), "Übungsimport verwendet den transaktionalen Batch-RPC nicht.");
  assert.ok(importSource.includes("applyAthleteImport"), "Athletenimport verwendet den transaktionalen Batch-RPC nicht.");
});


test("Wöchentliches Backup ist verschlüsselt und vollständig rückgeprüft", () => {
  assert.ok(backupWorkflowSource.includes('cron: "15 2 * * 1"'));
  assert.ok(backupWorkflowSource.includes("supabase db dump"));
  assert.ok(backupWorkflowSource.includes("full-database.dump"));
  assert.ok(backupWorkflowSource.includes("backup-supabase-storage.mjs"));
  assert.ok(backupWorkflowSource.includes("verify-backup-archive.mjs"));
  assert.ok(backupWorkflowSource.includes("Google-Drive-Kopie zurückladen und vollständig prüfen"));
  assert.ok(backupWorkflowSource.includes("--cipher-algo AES256"));
  assert.ok(backupWorkflowSource.includes("RCLONE_CONFIG_B64"));
  assert.ok(backupWorkflowSource.includes("gdrive:ULC-Linz-App-Backups"));
  assert.ok(backupStorageSource.includes("listBuckets"));
  assert.ok(backupStorageSource.includes("storage-manifest.json"));
  assert.ok(backupStorageSource.includes("sha256"));
  assert.ok(verifyBackupSource.includes("SHA256SUMS"));
  assert.ok(verifyBackupSource.includes("PGDMP"));
});

test("Vierteljährliche Wiederherstellungsprobe bleibt vom Produktivsystem getrennt", () => {
  assert.ok(quarterlyRestoreWorkflowSource.includes('cron: "45 3 1 1,4,7,10 *"'));
  assert.ok(quarterlyRestoreWorkflowSource.includes("ulc_restore_test"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("supabase start"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("pg_restore"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("restore-supabase-storage.mjs"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("--verify"));
  assert.doesNotMatch(quarterlyRestoreWorkflowSource, /SUPABASE_DB_URL/);
  assert.ok(restoreStorageSource.includes("hashRemoteObject"));
  assert.ok(restoreStorageSource.includes("--sync-buckets"));
});

const trainingDocumentationPageSource = await readFile(new URL("../src/pages/TrainingDocumentationPage.tsx", import.meta.url), "utf8");
const trainingDocumentationApiSource = await readFile(new URL("../src/features/training-documentation/api.ts", import.meta.url), "utf8");
const versionedAutosaveMigrationSource = await readFile(new URL("../supabase/migrations/202607290027_training_documentation_versioned_autosave.sql", import.meta.url), "utf8");
const documentationEditLockMigrationSource = await readFile(new URL("../supabase/migrations/202607290028_training_documentation_edit_lock.sql", import.meta.url), "utf8");

test("Trainingsdokumentation speichert seriell und versionsgesichert", () => {
  assert.ok(trainingDocumentationPageSource.includes("saveQueueRef"), "Speicherwarteschlange fehlt.");
  assert.ok(trainingDocumentationPageSource.includes("inFlightSaveRef"), "Laufender Speichervorgang wird nicht verfolgt.");
  assert.ok(trainingDocumentationPageSource.includes("serverUpdatedAtBySessionRef"), "Serverversionen werden nicht je Dokumentation verwaltet.");
  assert.ok(trainingDocumentationPageSource.includes("versionConflict"), "Versionskonflikte werden in der Oberfläche nicht behandelt.");
  assert.ok(trainingDocumentationApiSource.includes('callJsonRpc("save_training_documentation_v3"'));
  assert.ok(trainingDocumentationApiSource.includes("p_expected_updated_at"));
  assert.ok(versionedAutosaveMigrationSource.includes("pg_advisory_xact_lock"));
  assert.ok(versionedAutosaveMigrationSource.includes("for update"));
  assert.ok(versionedAutosaveMigrationSource.includes("TRAINING_DOCUMENTATION_VERSION_CONFLICT"));
  assert.ok(versionedAutosaveMigrationSource.includes("p_expected_updated_at"));
});


test("Trainingsdokumentation ist aktiv gegen parallele Bearbeitung geschützt", () => {
  assert.ok(trainingDocumentationPageSource.includes('entityType: "training_documentation"'));
  assert.ok(trainingDocumentationPageSource.includes("EditLockNotice"));
  assert.ok(trainingDocumentationPageSource.includes("getWriteGuard"));
  assert.ok(trainingDocumentationApiSource.includes("p_lock_token"));
  assert.ok(documentationEditLockMigrationSource.includes("'training_documentation'"));
  assert.ok(documentationEditLockMigrationSource.includes("public.save_training_documentation_v3"));
  assert.ok(documentationEditLockMigrationSource.includes("public.assert_edit_lock_for_write"));
});

const authContextSource = await readFile(new URL("../src/features/auth/AuthContext.tsx", import.meta.url), "utf8");
const protectedRouteSource = await readFile(new URL("../src/features/auth/ProtectedRoute.tsx", import.meta.url), "utf8");
const connectionErrorPageSource = await readFile(new URL("../src/pages/ConnectionErrorPage.tsx", import.meta.url), "utf8");

test("Auth-Kontext trennt fehlende Berechtigung von Verbindungsfehlern", () => {
  for (const status of [
    '"ready"',
    '"offline"',
    '"technical_error"',
    '"no_membership"',
  ]) {
    assert.ok(authContextSource.includes(status), `Auth-Status fehlt: ${status}`);
  }
  assert.ok(authContextSource.includes("contextRequestIdRef"), "Veraltete Kontextabfragen werden nicht abgefangen.");
  assert.ok(authContextSource.includes("setContextStatus(connectionStatus())"));
  assert.ok(authContextSource.includes("retryFailedContext"), "Automatischer Retry nach Wiederverbindung fehlt.");
  assert.ok(authContextSource.includes("Einen bereits gültig geladenen Vereinskontext nicht"));
  assert.ok(protectedRouteSource.includes('to="/verbindungsfehler"'));
  assert.ok(connectionErrorPageSource.includes("Erneut versuchen"));
  assert.ok(appSource.includes('path="/verbindungsfehler"'));
});

const dataImportApiSource = await readFile(new URL("../src/features/data-import/api.ts", import.meta.url), "utf8");
const dataImportPageSource = await readFile(new URL("../src/pages/DataImportPage.tsx", import.meta.url), "utf8");
const workbookSource = await readFile(new URL("../src/features/data-import/workbook.ts", import.meta.url), "utf8");
const transactionalImportMigrationSource = await readFile(new URL("../supabase/migrations/202607290029_transactional_data_import.sql", import.meta.url), "utf8");

test("Datenimport ist begrenzt, idempotent und transaktional", () => {
  assert.ok(dataImportApiSource.includes('apply_exercise_import_v1'));
  assert.ok(dataImportApiSource.includes('apply_athlete_import_v1'));
  assert.ok(dataImportPageSource.includes("importRunId"), "Idempotente Import-ID fehlt.");
  assert.doesNotMatch(dataImportPageSource, /\.xls,/);
  assert.ok(workbookSource.includes("MAX_IMPORT_FILE_BYTES"));
  assert.ok(workbookSource.includes("MAX_UNCOMPRESSED_BYTES"));
  assert.ok(workbookSource.includes("MAX_WORKBOOK_ROWS"));
  assert.ok(transactionalImportMigrationSource.includes("public.data_import_runs"));
  assert.ok(transactionalImportMigrationSource.includes("public.assert_import_entity_available"));
  assert.ok(transactionalImportMigrationSource.includes("pg_advisory_xact_lock"));
  assert.ok(transactionalImportMigrationSource.includes("apply_exercise_import_v1"));
  assert.ok(transactionalImportMigrationSource.includes("apply_athlete_import_v1"));
  assert.ok(transactionalImportMigrationSource.includes("Der gesamte Import wurde abgebrochen"));
});


const clientSessionDataSource = await readFile(new URL("../src/lib/client-session-data.ts", import.meta.url), "utf8");
const documentationMediaUploadSource = await readFile(new URL("../src/features/training-documentation/media-upload.ts", import.meta.url), "utf8");
const exerciseVideoUploadSource = await readFile(new URL("../src/features/exercise-catalog/video-upload.ts", import.meta.url), "utf8");

test("Lokale sensible Daten sind benutzergebunden und zeitlich begrenzt", () => {
  assert.ok(clientSessionDataSource.includes("48 * 60 * 60 * 1000"), "48-Stunden-Frist fehlt.");
  assert.ok(clientSessionDataSource.includes('ulc-training-documentation:v2:'), "Versionierter Entwurfsschlüssel fehlt.");
  assert.ok(clientSessionDataSource.includes('ulc-training-doc-video:v2:'), "Versionierter Dokumentations-Uploadschlüssel fehlt.");
  assert.ok(clientSessionDataSource.includes('ulc-exercise-video-tus:v2:'), "Versionierter Übungsvideo-Uploadschlüssel fehlt.");
  assert.ok(clientSessionDataSource.includes("ownerUserId"), "Benutzerbindung fehlt.");
  assert.ok(clientSessionDataSource.includes("purgeSensitiveSessionData"), "Bereinigung sensibler Browserdaten fehlt.");
  assert.ok(authContextSource.includes("purgeSensitiveSessionData(nextUserId)"), "Bereinigung beim Wiederherstellen der Sitzung fehlt.");
  assert.ok(authContextSource.includes("purgeSensitiveSessionData(nextSession.user.id)"), "Bereinigung beim Benutzerwechsel fehlt.");
  assert.ok(trainingDocumentationPageSource.includes("appContext?.authUser.id"), "Dokumentationsentwürfe sind nicht an den Benutzer gebunden.");
  assert.ok(documentationMediaUploadSource.includes("RESUMABLE_UPLOAD_MAX_AGE_MS"));
  assert.ok(documentationMediaUploadSource.includes("ownerUserId"));
  assert.ok(exerciseVideoUploadSource.includes("RESUMABLE_UPLOAD_MAX_AGE_MS"));
  assert.ok(exerciseVideoUploadSource.includes("ownerUserId"));
});

const appLayoutSource = await readFile(new URL("../src/components/layout/AppLayout.tsx", import.meta.url), "utf8");
const athleteManagementSource = await readFile(new URL("../src/pages/AthleteManagementPage.tsx", import.meta.url), "utf8");
const trainingGroupEditorSource = await readFile(new URL("../src/features/athletes/TrainingGroupEditor.tsx", import.meta.url), "utf8");
const userManagementSource = await readFile(new URL("../src/pages/UserManagementPage.tsx", import.meta.url), "utf8");
const exerciseCatalogCssSource = await readFile(new URL("../src/styles/exercise-catalog.css", import.meta.url), "utf8");
const trainingBlocksPageSource = await readFile(new URL("../src/pages/TrainingBlocksPage.tsx", import.meta.url), "utf8");
const trainingBlockEditorSource = await readFile(new URL("../src/features/training-blocks/TrainingBlockEditor.tsx", import.meta.url), "utf8");
const trainingBlockInfoSource = await readFile(new URL("../src/features/training-blocks/TrainingBlockExerciseInfoDialog.tsx", import.meta.url), "utf8");

test("Mobile Stammdaten und Kopfzeile sind gegen Fehlbedienung optimiert", () => {
  assert.ok(appLayoutSource.includes("app-user-menu-panel"), "Sicheres Benutzermenü fehlt.");
  assert.ok(appLayoutSource.includes("Benutzermenü öffnen"), "Benutzermenü ist nicht zugänglich beschriftet.");
  assert.ok(appLayoutSource.includes("app-user-menu-signout"), "Abmelden wurde nicht in das Benutzermenü verschoben.");
  assert.ok(athleteManagementSource.includes("const editorOpen = Boolean"), "Stammdatenlisten werden während der Bearbeitung nicht ausgeblendet.");
  assert.ok(athleteManagementSource.includes('tab !== "groups"'), "Gruppensuche wurde nicht entfernt.");
  assert.ok(athleteManagementSource.includes("masterdata-status-filter"), "Statusfilter besitzt keine eigene kompakte Zeile.");
  assert.ok(athleteManagementSource.includes("Sortierung"), "Sortierauswahl ist nicht beschriftet.");
  assert.doesNotMatch(trainingGroupEditorSource, />\s*Reihenfolge\s*</, "Manuelle Gruppenreihenfolge ist weiterhin sichtbar.");
});

test("Benutzerverwaltung kann nach Rolle filtern", () => {
  assert.ok(userManagementSource.includes("roleFilter"));
  assert.ok(userManagementSource.includes("Alle Rollen"));
  assert.ok(userManagementSource.includes("Benutzer nach Rolle filtern"));
});

test("Übungs- und Trainingsblockinformationen nutzen die mobile Breite einheitlich", () => {
  assert.ok(exerciseCatalogCssSource.includes("Kartenbreite unter den Aktionssymbolen vollständig nutzen"));
  assert.ok(exerciseCatalogCssSource.includes("position: absolute"));
  assert.ok(trainingBlocksPageSource.includes("training-block-overview-info-button"));
  assert.ok(trainingBlockEditorSource.includes("TrainingBlockExerciseInfoDialog"));
  assert.ok(trainingBlockInfoSource.includes("Trainerhinweise"));
  assert.ok(trainingBlockInfoSource.includes("Häufige Fehler"));
  assert.ok(trainingBlockInfoSource.includes("Planungsparameter"));
  assert.ok(trainingBlockInfoSource.includes("loadTrainingBlockExerciseVideos"));
});

const trainingOverviewSource = await readFile(new URL("../src/pages/TrainingOverviewPage.tsx", import.meta.url), "utf8");
const trainingPlanEditorSource = await readFile(new URL("../src/features/training-planning/TrainingPlanEditor.tsx", import.meta.url), "utf8");
const trainingPlanningInfoSource = await readFile(new URL("../src/features/training-planning/TrainingPlanningExerciseInfoDialog.tsx", import.meta.url), "utf8");

test("Kopfzeile und Trainingsplan-Uebersicht sind kompakt und filterbar", () => {
  assert.doesNotMatch(appLayoutSource, /brand-user-line/, "Name und Rolle werden weiterhin doppelt in der Kopfzeile angezeigt.");
  assert.ok(trainingOverviewSource.includes('type AthleteFilter = "all" | "coming" | "maybe"'));
  assert.ok(trainingOverviewSource.includes('coming: "Angemeldet"'));
  assert.ok(trainingOverviewSource.includes("desktopAthletes"));
  assert.ok(trainingOverviewSource.includes("mobileAthletes"));
  assert.ok(trainingOverviewSource.includes("training-overview-navigation-actions"));
  assert.doesNotMatch(trainingOverviewSource, /training-overview-summary/, "Die redundante Wochenzusammenfassung ist weiterhin vorhanden.");
});

test("Trainingsplanung unterscheidet Block- und Uebungsebene und zeigt vollstaendige Infos", () => {
  assert.ok(trainingPlanEditorSource.includes('training-plan-section-${section.sectionType}'));
  assert.ok(trainingPlanEditorSource.includes('const sectionCode ='));
  assert.ok(trainingPlanEditorSource.includes('{sectionCode}.{itemIndex + 1}'));
  assert.ok(trainingPlanEditorSource.includes("training-plan-block-exercises-label"));
  assert.ok(trainingPlanEditorSource.includes("training-plan-item-info"));
  assert.ok(trainingPlanEditorSource.includes("TrainingPlanningExerciseInfoDialog"));
  assert.ok(trainingPlanningInfoSource.includes("Trainerhinweise"));
  assert.ok(trainingPlanningInfoSource.includes("Haeufige Fehler") || trainingPlanningInfoSource.includes("Häufige Fehler"));
  assert.ok(trainingPlanningInfoSource.includes("Planungsparameter"));
  assert.ok(trainingPlanningInfoSource.includes("loadTrainingBlockExerciseVideos"));
});

const repositoryConsolidationSource = await readFile(
  new URL("../supabase/migrations/202607300030_repository_state_consolidation.sql", import.meta.url),
  "utf8",
);
const generatedDatabaseTypesSource = await readFile(
  new URL("../src/types/database.generated.ts", import.meta.url),
  "utf8",
);
const dataImportApiTypedSource = await readFile(
  new URL("../src/features/data-import/api.ts", import.meta.url),
  "utf8",
);
const projectArchiveScriptSource = await readFile(
  new URL("../scripts/create-project-archive.ps1", import.meta.url),
  "utf8",
);

test("E0 konsolidiert alte ungeschützte Schreibfunktionen im Migrationsstand", () => {
  for (const functionName of [
    "save_exercise_catalog_item",
    "save_exercise_catalog_item_v2",
    "save_training_block",
    "update_athlete",
    "update_athlete_v2",
    "update_athlete_v3",
    "save_athlete_training_plan",
    "save_training_documentation",
    "save_training_documentation_v2",
  ]) {
    assert.ok(
      repositoryConsolidationSource.includes(`public.${functionName}`),
      `Legacy-RPC fehlt in der Abschlussmigration: ${functionName}`,
    );
  }
  assert.ok(repositoryConsolidationSource.includes("from authenticated, anon, public"));
});

test("E0 hält Import-Schema, Supabase-Typen und API konsistent", () => {
  assert.ok(generatedDatabaseTypesSource.includes("data_import_runs: {"));
  assert.ok(generatedDatabaseTypesSource.includes("apply_exercise_import_v1: {"));
  assert.ok(generatedDatabaseTypesSource.includes("apply_athlete_import_v1: {"));
  assert.ok(generatedDatabaseTypesSource.includes("assert_import_entity_available: {"));
  assert.doesNotMatch(dataImportApiTypedSource, /supabase\.rpc\.bind/);
  assert.doesNotMatch(dataImportApiTypedSource, /name:\s*string,/);
  assert.ok(dataImportApiTypedSource.includes('rpc("apply_exercise_import_v1"'));
  assert.ok(dataImportApiTypedSource.includes('rpc("apply_athlete_import_v1"'));
});

test("Projektarchiv schließt Altlasten aus und behält env.example", () => {
  assert.ok(projectArchiveScriptSource.includes('"_v1"'));
  assert.ok(projectArchiveScriptSource.includes('"apply-patch.ps1"'));
  assert.doesNotMatch(projectArchiveScriptSource, /"\.env\.\*"/);
  assert.ok(projectArchiveScriptSource.includes('Where-Object { $_.Name -ne ".env.example" }'));
});
