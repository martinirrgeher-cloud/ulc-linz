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
  assert.ok(modules.length >= 14, "Es wurden unerwartet wenige Module gefunden.");
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
const restoredDatabaseVerifierSource = await readFile(new URL("./verify-restored-database.mjs", import.meta.url), "utf8");
const backupRestoreCheckerSource = await readFile(new URL("./check-backup-restore-suite.mjs", import.meta.url), "utf8");


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

test("E3d stellt logischen Supabase-Export und Storage isoliert wieder her", () => {
  assert.ok(quarterlyRestoreWorkflowSource.includes('cron: "45 3 1 1,4,7,10 *"'));
  assert.ok(quarterlyRestoreWorkflowSource.includes("supabase init --workdir restore/local-project"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("supabase start"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("pg_restore --list"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("roles.sql"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("schema.sql"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("data.sql"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("SET session_replication_role = replica"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("restore-supabase-storage.mjs"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("--verify"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("actions/upload-artifact@v4"));
  assert.doesNotMatch(quarterlyRestoreWorkflowSource, /secrets\.SUPABASE_(?:DB_URL|URL|SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(quarterlyRestoreWorkflowSource, /ulc_restore_(?:full|portable)/);
  assert.ok(restoreStorageSource.includes("hashRemoteObject"));
  assert.ok(restoreStorageSource.includes("--sync-buckets"));
  assert.ok(restoreStorageSource.includes("--report-json="));
  assert.ok(verifyBackupSource.includes("--json="));
});

test("E3d prüft Migrationsstand und zentrale wiederhergestellte Daten", () => {
  for (const marker of [
    "auth.users",
    "storage.objects",
    "public.organizations",
    "public.organization_members",
    "expectedMigration",
    "migrationHistoryRestored",
    "logicalRestore",
    "rawDumpCatalogEntries",
  ]) {
    assert.ok(restoredDatabaseVerifierSource.includes(marker), `E3d-Prüfung fehlt: ${marker}`);
  }
  assert.ok(backupRestoreCheckerSource.includes("secrets.SUPABASE_DB_URL"));
  assert.ok(backupRestoreCheckerSource.includes("actions/upload-artifact@v4"));
  assert.ok(quarterlyRestoreWorkflowSource.includes("database-restore-report.md"));
  assert.ok(backupWorkflowSource.includes("history_schema.sql"));
  assert.ok(backupWorkflowSource.includes("history_data.sql"));
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
const trainerEditorSource = await readFile(new URL("../src/features/athletes/TrainerEditor.tsx", import.meta.url), "utf8");
const athleteApiSource = await readFile(new URL("../src/features/athletes/api.ts", import.meta.url), "utf8");
const editLocksSource = await readFile(new URL("../src/features/collaboration/edit-locks.ts", import.meta.url), "utf8");
const trainerGroupLockMigrationSource = await readFile(
  new URL("../supabase/migrations/202608020031_trainer_group_edit_locks.sql", import.meta.url),
  "utf8",
);
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
  assert.ok(athleteManagementSource.includes('"Gruppe suchen"'), "Gruppensuche fehlt.");
  assert.ok(athleteManagementSource.includes("masterdata-status-filter"), "Statusfilter besitzt keine eigene kompakte Zeile.");
  assert.ok(athleteManagementSource.includes("Sortierung"), "Sortierauswahl ist nicht beschriftet.");
  assert.doesNotMatch(trainingGroupEditorSource, />\s*Reihenfolge\s*</, "Manuelle Gruppenreihenfolge ist weiterhin sichtbar.");
});

test("Benutzerverwaltung kann nach Rolle filtern", () => {
  assert.ok(userManagementSource.includes("roleFilter"));
  assert.ok(userManagementSource.includes("Alle Rollen"));
  assert.ok(userManagementSource.includes("Benutzer nach Rolle filtern"));
});

test("E2 schützt Trainer und Gruppen atomar vor paralleler Bearbeitung", () => {
  assert.ok(editLocksSource.includes('"training_group"'));
  assert.ok(editLocksSource.includes('"trainer"'));
  assert.ok(athleteManagementSource.includes('entityType: "training_group"'));
  assert.ok(athleteManagementSource.includes('entityType: "trainer"'));
  assert.ok(athleteManagementSource.includes("groupLock.getWriteGuard()"));
  assert.ok(athleteManagementSource.includes("trainerLock.getWriteGuard()"));
  assert.ok(trainingGroupEditorSource.includes("lockNotice"));
  assert.ok(trainingGroupEditorSource.includes("disabled={!canEdit || busy}"));
  assert.ok(trainerEditorSource.includes("lockNotice"));
  assert.ok(trainerEditorSource.includes("disabled={!canEdit || busy}"));
  assert.ok(athleteApiSource.includes('callJsonRpc("update_training_group_v4"'));
  assert.ok(athleteApiSource.includes('callJsonRpc("update_trainer_v4"'));
  assert.ok(trainerGroupLockMigrationSource.includes("public.update_training_group_v4"));
  assert.ok(trainerGroupLockMigrationSource.includes("public.update_trainer_v4"));
  assert.ok(trainerGroupLockMigrationSource.includes("from authenticated, anon, public"));
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
  assert.ok(generatedDatabaseTypesSource.includes("update_training_group_v4: {"));
  assert.ok(generatedDatabaseTypesSource.includes("update_trainer_v4: {"));
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

const databaseTestsWorkflowSource = await readFile(
  new URL("../.github/workflows/database-tests.yml", import.meta.url),
  "utf8",
);
const databaseTestRunnerSource = await readFile(
  new URL("./run-database-tests.ps1", import.meta.url),
  "utf8",
);
const databaseTestFiles = [
  "../supabase/tests/database/00_schema_and_security.test.sql",
  "../supabase/tests/database/10_role_matrix.test.sql",
  "../supabase/tests/database/20_collaboration.test.sql",
  "../supabase/tests/database/30_transactional_import.test.sql",
  "../supabase/tests/database/40_realtime_collaboration.test.sql",
  "../supabase/tests/database/50_catalog_block_intelligence.test.sql",
  "../supabase/tests/database/60_user_management_e5c.test.sql",
  "../supabase/tests/database/61_parent_multi_athlete_links.test.sql",
  "../supabase/tests/database/70_catalog_block_read_models.test.sql",
];

test("E1a baut die Datenbank isoliert neu auf und führt pgTAP-Tests aus", async () => {
  assert.ok(databaseTestsWorkflowSource.includes("supabase start"));
  assert.ok(databaseTestsWorkflowSource.includes("supabase migration list --local"));
  assert.doesNotMatch(databaseTestsWorkflowSource, /supabase db reset/);
  assert.ok(databaseTestsWorkflowSource.includes("supabase test db"));
  assert.ok(databaseTestsWorkflowSource.includes("supabase stop --no-backup"));
  assert.doesNotMatch(databaseTestsWorkflowSource, /SUPABASE_DB_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.ok(databaseTestRunnerSource.includes('"db", "reset"'));
  assert.ok(databaseTestRunnerSource.includes('"test", "db"'));

  for (const relativePath of databaseTestFiles) {
    const repositoryPath = relativePath.replace(/^\.\.\//, "");
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.ok(databaseTestsWorkflowSource.includes(repositoryPath), `Workflow fuehrt ${repositoryPath} nicht aus`);
    assert.ok(databaseTestRunnerSource.includes(repositoryPath), `Lokaler Runner fuehrt ${repositoryPath} nicht aus`);
    assert.ok(source.includes("select plan("), `pgTAP-Plan fehlt in ${relativePath}`);
    assert.ok(source.includes("select * from finish();"), `pgTAP-Abschluss fehlt in ${relativePath}`);
    assert.ok(source.includes("rollback;"), `Test-Rollback fehlt in ${relativePath}`);
  }
});

test("E1a prüft Rollen, Legacy-RPCs, Sperren und Import-Rollback", async () => {
  const schemaTests = await readFile(new URL(databaseTestFiles[0], import.meta.url), "utf8");
  const roleTests = await readFile(new URL(databaseTestFiles[1], import.meta.url), "utf8");
  const collaborationTests = await readFile(new URL(databaseTestFiles[2], import.meta.url), "utf8");
  const importTests = await readFile(new URL(databaseTestFiles[3], import.meta.url), "utf8");

  assert.ok(schemaTests.includes("has_function_privilege"));
  assert.ok(schemaTests.includes("save_training_documentation_v2"));
  assert.ok(roleTests.includes("'admin'"));
  assert.ok(roleTests.includes("'trainer'"));
  assert.ok(roleTests.includes("'athlete'"));
  assert.ok(roleTests.includes("'parent'"));
  assert.ok(roleTests.includes("Benutzer ohne Mitgliedschaft"));
  assert.ok(collaborationTests.includes("acquire_edit_lock"));
  assert.ok(collaborationTests.includes("seit dem Öffnen verändert"));
  assert.ok(importTests.includes("apply_exercise_import_v1"));
  assert.ok(importTests.includes("zurückgerollt"));
  assert.ok(importTests.includes("wird gerade durch"));
});

const resumableUploadSource = await readFile(
  new URL("../src/lib/resumable-upload.ts", import.meta.url),
  "utf8",
);
const e3aExerciseVideoUploadSource = await readFile(
  new URL("../src/features/exercise-catalog/video-upload.ts", import.meta.url),
  "utf8",
);
const exerciseVideoPanelSource = await readFile(
  new URL("../src/features/exercise-catalog/ExerciseVideoPanel.tsx", import.meta.url),
  "utf8",
);
const exerciseVideoApiSource = await readFile(
  new URL("../src/features/exercise-catalog/api.ts", import.meta.url),
  "utf8",
);
const documentationVideoUploadSource = await readFile(
  new URL("../src/features/training-documentation/media-upload.ts", import.meta.url),
  "utf8",
);
const documentationEditorSource = await readFile(
  new URL("../src/features/training-documentation/TrainingDocumentationEditor.tsx", import.meta.url),
  "utf8",
);
const documentationApiSource = await readFile(
  new URL("../src/features/training-documentation/api.ts", import.meta.url),
  "utf8",
);

test("E3a erneuert abgelaufene Upload-Tokens und bewahrt TUS-Sitzungen", () => {
  assert.ok(resumableUploadSource.includes("refreshSession()"));
  assert.ok(resumableUploadSource.includes("error.status !== 401"));
  assert.ok(resumableUploadSource.includes("withResumableUploadAuthRefresh"));
  assert.ok(e3aExerciseVideoUploadSource.includes("withResumableUploadAuthRefresh"));
  assert.ok(documentationVideoUploadSource.includes("withResumableUploadAuthRefresh"));
  assert.ok(e3aExerciseVideoUploadSource.includes("gespeicherte TUS-Sitzung"));
  assert.ok(documentationVideoUploadSource.includes("Resume-Punkt"));
});

test("E3a unterstützt Pause, Fortsetzen und sichere Upload-Bereinigung", () => {
  assert.ok(exerciseVideoPanelSource.includes("Upload pausieren"));
  assert.ok(exerciseVideoPanelSource.includes('"Fortsetzen"'));
  assert.ok(exerciseVideoApiSource.includes("signal?: AbortSignal"));
  assert.ok(documentationEditorSource.includes("pauseVideoUpload"));
  assert.ok(documentationEditorSource.includes("resumeVideoUpload"));
  assert.ok(documentationEditorSource.includes("removeTrainingDocumentationStorageObject"));
  assert.ok(documentationApiSource.includes("removeTrainingDocumentationStorageObject"));
  assert.ok(e3aExerciseVideoUploadSource.includes("ResumableUploadPausedError"));
  assert.ok(documentationVideoUploadSource.includes("ResumableUploadPausedError"));
});

const diagnosticsSource = await readFile(new URL("../src/lib/diagnostics.ts", import.meta.url), "utf8");
const appLayoutDiagnosticsSource = await readFile(new URL("../src/components/layout/AppLayout.tsx", import.meta.url), "utf8");
const appErrorBoundaryDiagnosticsSource = await readFile(new URL("../src/components/errors/AppErrorBoundary.tsx", import.meta.url), "utf8");
const viteConfigDiagnosticsSource = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("E3b erzeugt datensparsame Fehler-IDs und Supportinformationen", () => {
  assert.ok(diagnosticsSource.includes("ULC-${date}-${time}-${randomPart()}"));
  assert.ok(diagnosticsSource.includes("MAX_RECORDS = 8"));
  assert.ok(diagnosticsSource.includes("messageFingerprint"));
  assert.ok(diagnosticsSource.includes("Technische Meldung ausgeblendet"));
  assert.ok(diagnosticsSource.includes("sessionStorage"));
  assert.ok(diagnosticsSource.includes("Enthält keine Namen, E-Mail-Adressen, Trainingsinhalte oder Zugangsdaten."));
  assert.doesNotMatch(diagnosticsSource, /localStorage/);
});

test("E3b zeigt Build-Stand und kopierbare Diagnose an", () => {
  assert.ok(viteConfigDiagnosticsSource.includes("VERCEL_GIT_COMMIT_SHA"));
  assert.ok(viteConfigDiagnosticsSource.includes("__APP_VERSION__"));
  assert.ok(viteConfigDiagnosticsSource.includes("__APP_COMMIT__"));
  assert.ok(appLayoutDiagnosticsSource.includes("env.appBuildLabel"));
  assert.ok(appLayoutDiagnosticsSource.includes("copySupportInformation"));
  assert.ok(appErrorBoundaryDiagnosticsSource.includes("Fehler-ID"));
  assert.ok(appErrorBoundaryDiagnosticsSource.includes("Diagnose kopieren"));
});

const e3cVercelConfigSource = await readFile(new URL("../vercel.json", import.meta.url), "utf8");
const e3cPackageSource = await readFile(new URL("../package.json", import.meta.url), "utf8");
const e3cSecurityCheckerSource = await readFile(
  new URL("./check-security-headers.mjs", import.meta.url),
  "utf8",
);

test("E3c schützt App, Frames und Skriptausführung mit Sicherheitsheadern", () => {
  assert.ok(e3cVercelConfigSource.includes('"Content-Security-Policy"'));
  assert.ok(e3cVercelConfigSource.includes("script-src 'self'"));
  assert.ok(e3cVercelConfigSource.includes("frame-ancestors 'none'"));
  assert.ok(e3cVercelConfigSource.includes("object-src 'none'"));
  assert.ok(e3cVercelConfigSource.includes('"X-Frame-Options"'));
  assert.ok(e3cVercelConfigSource.includes('"X-Content-Type-Options"'));
  assert.doesNotMatch(e3cVercelConfigSource, /script-src[^;]*unsafe-(?:inline|eval)/);
});

test("E3c erlaubt Supabase, Videos, Uploads und Bildschirm-Wachhalten gezielt", () => {
  assert.ok(e3cVercelConfigSource.includes("https://*.storage.supabase.co"));
  assert.ok(e3cVercelConfigSource.includes("wss://*.supabase.co"));
  assert.ok(e3cVercelConfigSource.includes("media-src 'self' blob:"));
  assert.ok(e3cVercelConfigSource.includes("screen-wake-lock=(self)"));
  assert.ok(e3cPackageSource.includes('"check:security-headers"'));
  assert.ok(e3cPackageSource.includes("npm run check:security-headers"));
  assert.ok(e3cSecurityCheckerSource.includes("validateDeployedUrl"));
  assert.ok(e3cSecurityCheckerSource.includes("Globale CSP-Wildcard ist nicht erlaubt"));
});

const e4RealtimeMigrationSource = await readFile(
  new URL("../supabase/migrations/202608020032_realtime_collaboration.sql", import.meta.url),
  "utf8",
);
const organizationRealtimeHookSource = await readFile(
  new URL("../src/features/collaboration/useOrganizationRealtime.ts", import.meta.url),
  "utf8",
);
const e4EditLockHookSource = await readFile(
  new URL("../src/features/collaboration/useEditLock.ts", import.meta.url),
  "utf8",
);
const remoteChangeNoticeSource = await readFile(
  new URL("../src/components/collaboration/RemoteChangeNotice.tsx", import.meta.url),
  "utf8",
);
const collaborationConflictSource = await readFile(
  new URL("../src/features/collaboration/conflicts.ts", import.meta.url),
  "utf8",
);
const e4AthletePageSource = await readFile(
  new URL("../src/pages/AthleteManagementPage.tsx", import.meta.url),
  "utf8",
);
const e4ExercisePageSource = await readFile(
  new URL("../src/pages/ExerciseCatalogPage.tsx", import.meta.url),
  "utf8",
);
const e4TrainingBlockPageSource = await readFile(
  new URL("../src/pages/TrainingBlocksPage.tsx", import.meta.url),
  "utf8",
);
const e4TrainingPlanningPageSource = await readFile(
  new URL("../src/pages/TrainingPlanningPage.tsx", import.meta.url),
  "utf8",
);
const e4TrainingDocumentationPageSource = await readFile(
  new URL("../src/pages/TrainingDocumentationPage.tsx", import.meta.url),
  "utf8",
);

test("E4 veröffentlicht alle Kerndatensätze sicher über Supabase Realtime", () => {
  for (const table of [
    "athletes",
    "training_groups",
    "trainers",
    "exercises",
    "training_blocks",
    "athlete_training_plans",
    "athlete_training_sessions",
  ]) {
    assert.ok(e4RealtimeMigrationSource.includes(`'${table}'`), `Realtime-Tabelle fehlt: ${table}`);
  }
  assert.ok(e4RealtimeMigrationSource.includes("supabase_realtime"));
  assert.ok(e4RealtimeMigrationSource.includes("replica identity full"));
  assert.ok(organizationRealtimeHookSource.includes('"postgres_changes"'));
  assert.ok(organizationRealtimeHookSource.includes("organization_id=eq."));
  assert.ok(organizationRealtimeHookSource.includes('"reconnected"'));
  assert.ok(organizationRealtimeHookSource.includes('"online"'));
  assert.ok(!organizationRealtimeHookSource.includes('window.addEventListener("focus"'));
});

test("E4 aktualisiert Listen und schützt lokale Entwürfe vor Überschreiben", () => {
  for (const source of [
    e4AthletePageSource,
    e4ExercisePageSource,
    e4TrainingBlockPageSource,
    e4TrainingPlanningPageSource,
    e4TrainingDocumentationPageSource,
  ]) {
    assert.ok(source.includes("useOrganizationRealtime"));
    assert.ok(source.includes("RemoteChangeNotice"));
    assert.ok(source.includes("applyRemoteServerState") || source.includes("keepLocalDraftAfterRemoteChange"));
  }
  assert.ok(remoteChangeNoticeSource.includes("Serverstand laden"));
  assert.ok(remoteChangeNoticeSource.includes("Eigene Eingaben behalten"));
  assert.ok(collaborationConflictSource.includes("collaborationVersionsDiffer"));
  assert.ok(e4TrainingDocumentationPageSource.includes("writeLocalDraft"));
  assert.ok(e4TrainingDocumentationPageSource.includes("localWriteUntilRef"));
  assert.ok(e4TrainingPlanningPageSource.includes("localWriteUntilRef"));
  assert.ok(e4EditLockHookSource.includes("acceptRecordVersion"));
  assert.ok(e4TrainingPlanningPageSource.includes("acceptRecordVersion"));
  assert.ok(e4TrainingDocumentationPageSource.includes("acceptRecordVersion"));
});

test("E4 meldet Formularänderungen in allen gemeinsam bearbeiteten Stammdaten", async () => {
  for (const relativePath of [
    "../src/features/athletes/AthleteEditor.tsx",
    "../src/features/athletes/TrainerEditor.tsx",
    "../src/features/athletes/TrainingGroupEditor.tsx",
    "../src/features/exercise-catalog/ExerciseEditor.tsx",
    "../src/features/training-blocks/TrainingBlockEditor.tsx",
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.ok(source.includes("useDraftDirtyState"), `Entwurfsstatus fehlt in ${relativePath}`);
    assert.ok(source.includes("onDirtyChange"), `Dirty-Callback fehlt in ${relativePath}`);
  }
});


const e5CatalogMigrationSource = await readFile(
  new URL("../supabase/migrations/202608020033_catalog_block_intelligence.sql", import.meta.url),
  "utf8",
);
const e5ExerciseEditorSource = await readFile(
  new URL("../src/features/exercise-catalog/ExerciseEditor.tsx", import.meta.url),
  "utf8",
);
const e5ExercisePageSource = await readFile(
  new URL("../src/pages/ExerciseCatalogPage.tsx", import.meta.url),
  "utf8",
);
const e5TrainingBlockPageSource = await readFile(
  new URL("../src/pages/TrainingBlocksPage.tsx", import.meta.url),
  "utf8",
);
const e5TrainingBlockEditorSource = await readFile(
  new URL("../src/features/training-blocks/TrainingBlockEditor.tsx", import.meta.url),
  "utf8",
);
const e5NameSimilaritySource = await readFile(
  new URL("../src/features/exercise-catalog/name-similarity.ts", import.meta.url),
  "utf8",
);

test("E5a ergänzt Schwierigkeitsgrad, Dubletten, ähnliche Übungen und Verwendung", () => {
  assert.ok(e5CatalogMigrationSource.includes("difficulty_key"));
  assert.ok(e5CatalogMigrationSource.includes("exercise_similarities"));
  assert.ok(e5CatalogMigrationSource.includes("exercise_duplicate_candidates"));
  assert.ok(e5ExerciseEditorSource.includes("Schwierigkeitsgrad"));
  assert.ok(e5ExerciseEditorSource.includes("Ähnliche Übungen"));
  assert.ok(e5ExerciseEditorSource.includes("Mögliche Dublette"));
  assert.ok(e5ExercisePageSource.includes("ExerciseUsageDialog"));
  assert.ok(e5ExercisePageSource.includes("Archiv"));
  assert.ok(e5NameSimilaritySource.includes("exerciseNameSimilarity"));
});

test("E5b ergänzt Varianten, Versionen, Favoriten und Blockvergleich", () => {
  assert.ok(e5CatalogMigrationSource.includes("training_block_versions"));
  assert.ok(e5CatalogMigrationSource.includes("training_block_user_favorites"));
  assert.ok(e5CatalogMigrationSource.includes("create_training_block_variant"));
  assert.ok(e5TrainingBlockPageSource.includes("TrainingBlockCompareDialog"));
  assert.ok(e5TrainingBlockPageSource.includes("Neue Variante erstellen"));
  assert.ok(e5TrainingBlockPageSource.includes("Letzte Nutzung"));
  assert.ok(e5TrainingBlockPageSource.includes("TrainingBlockVersionHistory"));
  assert.ok(e5TrainingBlockPageSource.includes("Tatsächlich verwendet von"));
});

test("E5b warnt vor inaktiven Übungen ohne historische Verwendungen zu verändern", () => {
  assert.ok(e5TrainingBlockEditorSource.includes("Inaktive Übungen im Block"));
  assert.ok(e5TrainingBlockEditorSource.includes("Bestehende Verwendungen bleiben erhalten"));
  assert.ok(e5CatalogMigrationSource.includes("exercise_is_active"));
  assert.ok(e5CatalogMigrationSource.includes("snapshot"));
});

const p2aMigrationSource = await readFile(
  new URL("../supabase/migrations/202608030036_catalog_block_read_models.sql", import.meta.url),
  "utf8",
);
const p2aExerciseApiSource = await readFile(
  new URL("../src/features/exercise-catalog/api.ts", import.meta.url),
  "utf8",
);
const p2aUsageDialogSource = await readFile(
  new URL("../src/features/exercise-catalog/ExerciseUsageDialog.tsx", import.meta.url),
  "utf8",
);
const p2aTrainingBlockApiSource = await readFile(
  new URL("../src/features/training-blocks/api.ts", import.meta.url),
  "utf8",
);
const p2aVersionHistorySource = await readFile(
  new URL("../src/features/training-blocks/TrainingBlockVersionHistory.tsx", import.meta.url),
  "utf8",
);
const p2aRefreshSource = await readFile(
  new URL("../src/features/collaboration/useCoalescedAsyncRefresh.ts", import.meta.url),
  "utf8",
);

 test("P2a lädt Verwendungen und Blockversionen nur bei Bedarf", () => {
  for (const marker of [
    "exercise_catalog_overview_v4",
    "exercise_usage_overview",
    "training_block_overview_v4",
    "training_block_versions_overview",
    "block_usage_count",
    "plan_usage_count",
    "version_count",
  ]) {
    assert.ok(p2aMigrationSource.includes(marker), `P2a-Migrationsmarker fehlt: ${marker}`);
  }
  assert.ok(p2aExerciseApiSource.includes('callJsonRpc("exercise_catalog_overview_v4"'));
  assert.ok(p2aUsageDialogSource.includes("loadExerciseUsage"));
  assert.ok(p2aTrainingBlockApiSource.includes('callJsonRpc("training_block_overview_v4"'));
  assert.ok(p2aVersionHistorySource.includes("loadTrainingBlockVersions"));
});

 test("P2a bündelt Realtime-Neuladevorgänge und verhindert parallele Vollabfragen", () => {
  assert.ok(p2aRefreshSource.includes("inFlightRef"));
  assert.ok(p2aRefreshSource.includes("queuedRef"));
  assert.ok(p2aRefreshSource.includes("scheduleRefresh"));
  assert.ok(e5ExercisePageSource.includes("useCoalescedAsyncRefresh"));
  assert.ok(e5TrainingBlockPageSource.includes("useCoalescedAsyncRefresh"));
});

const e5cMigrationSource = await readFile(
  new URL("../supabase/migrations/202608020034_user_management_e5c.sql", import.meta.url),
  "utf8",
);
const e5cPageSource = await readFile(
  new URL("../src/pages/UserManagementPage.tsx", import.meta.url),
  "utf8",
);
const e5cEditorSource = await readFile(
  new URL("../src/features/user-management/MemberEditor.tsx", import.meta.url),
  "utf8",
);
const e5cTemplatesSource = await readFile(
  new URL("../src/features/user-management/permission-templates.ts", import.meta.url),
  "utf8",
);
const e5cEdgeSource = await readFile(
  new URL("../supabase/functions/invite-member/index.ts", import.meta.url),
  "utf8",
);

 test("E5c ergänzt Einladungsstatus, Verknüpfungen und Kontowarnungen", () => {
  for (const marker of [
    "Einladung offen",
    "Erneut senden",
    "Ohne Verknüpfung",
    "Mit Warnung",
    "invitationLastSentAt",
    "linkedAthletes",
    "linkedTrainerName",
  ]) {
    assert.ok(e5cPageSource.includes(marker), `E5c-Anzeige fehlt: ${marker}`);
  }
  assert.ok(e5cMigrationSource.includes("invitation_last_sent_at"));
  assert.ok(e5cMigrationSource.includes("invitation_send_count"));
  assert.ok(e5cEdgeSource.includes('payload.action === "resend"'));
});

test("E5c Rechtevorlagen bleiben individuell anpassbar", () => {
  for (const template of ["Kindertrainer", "Leistungstrainer", "Athlet", "Elternteil"]) {
    assert.ok(e5cTemplatesSource.includes(template), `Rechtevorlage fehlt: ${template}`);
  }
  assert.ok(e5cEditorSource.includes("Einzelne Rechte bleiben danach frei anpassbar"));
  assert.ok(e5cEditorSource.includes("PermissionEditor"));
});

test("E5c nutzt Audit, Bearbeitungssperre und Realtime ohne globale CSS-Änderung", () => {
  assert.ok(e5cMigrationSource.includes("admin_member_audit_overview"));
  assert.ok(e5cMigrationSource.includes("organization_member"));
  assert.ok(e5cPageSource.includes('entityType: "organization_member"'));
  assert.ok(e5cPageSource.includes("useOrganizationRealtime"));
  assert.ok(e5cPageSource.includes("RemoteChangeNotice"));
  assert.ok(e5cPageSource.includes('import "@/styles/user-management-e5c.css"'));
  assert.doesNotMatch(e5cMigrationSource, /password|access_token|refresh_token/i);
});

const e5c3MigrationSource = await readFile(
  new URL("../supabase/migrations/202608020035_parent_multi_athlete_links.sql", import.meta.url),
  "utf8",
);
const e5c3TypesSource = await readFile(
  new URL("../src/features/user-management/types.ts", import.meta.url),
  "utf8",
);
const e5c3ApiSource = await readFile(
  new URL("../src/features/user-management/api.ts", import.meta.url),
  "utf8",
);
const e5c3AuditSource = await readFile(
  new URL("../src/features/user-management/MemberAuditLog.tsx", import.meta.url),
  "utf8",
);

test("E5c3 speichert Eltern-Athleten mehrfach und Athletenkonten weiterhin eindeutig", () => {
  for (const marker of [
    "organization_member_athlete_links",
    "relation_type in ('self', 'managed')",
    "admin_member_overview_v3",
    "admin_update_organization_member_v3",
    "p_linked_athlete_ids uuid[]",
    "Ein Athletenkonto kann nur mit einem Athleten verknuepft werden",
  ]) {
    assert.ok(e5c3MigrationSource.includes(marker), `E5c3-Migrationsmarker fehlt: ${marker}`);
  }
  assert.ok(e5c3TypesSource.includes("linkedAthletes: ManagedAthleteLink[]"));
  assert.ok(e5c3ApiSource.includes('supabase.rpc("admin_member_overview_v3"'));
  assert.ok(e5c3ApiSource.includes('supabase.rpc("admin_update_organization_member_v3"'));
});

test("E5c3 bietet eine mobile Eltern-Mehrfachauswahl mit Audit", () => {
  for (const marker of [
    "Verknüpfte Athleten",
    "Mehrere Kinder können gleichzeitig ausgewählt werden",
    "Athletenverknüpfungen",
    "ausgewählt",
  ]) {
    assert.ok(e5cEditorSource.includes(marker) || e5c3MigrationSource.includes(marker), `E5c3-UI-Marker fehlt: ${marker}`);
  }
  assert.ok(e5c3AuditSource.includes('"member.athlete_links_changed"'));
  assert.ok(e5c3MigrationSource.includes("jsonb_build_object('athlete_ids'"));
  assert.doesNotMatch(e5c3MigrationSource, /password|access_token|refresh_token/i);
});

const p2bManifestSource = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const p2bIndexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const p2bServiceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const p2bHelpContent = JSON.parse(await readFile(new URL("../src/features/help/help-content.json", import.meta.url), "utf8"));
const p2bHelpRouteContexts = JSON.parse(await readFile(new URL("../src/features/help/help-route-contexts.json", import.meta.url), "utf8"));
const p2bHelpPageSource = await readFile(new URL("../src/pages/HelpPage.tsx", import.meta.url), "utf8");
const p2bLayoutSource = await readFile(new URL("../src/components/layout/AppLayout.tsx", import.meta.url), "utf8");

test("P2b stellt eine installierbare Standalone-App mit Vereinslogo bereit", () => {
  assert.equal(p2bManifestSource.name, "ULC Linz Oberbank");
  assert.equal(p2bManifestSource.display, "standalone");
  assert.ok(p2bManifestSource.icons.some((icon) => icon.src === "/icons/icon-512.png"));
  assert.ok(p2bManifestSource.icons.some((icon) => icon.purpose === "maskable"));
  assert.ok(p2bIndexSource.includes('rel="manifest"'));
  assert.ok(p2bIndexSource.includes('rel="apple-touch-icon"'));
  assert.ok(p2bServiceWorkerSource.includes('addEventListener("install"'));
  assert.ok(p2bServiceWorkerSource.includes('addEventListener("activate"'));
  assert.doesNotMatch(p2bServiceWorkerSource, /addEventListener\(["']fetch["']|caches\.open|cache\.put/i);
  assert.doesNotMatch(p2bServiceWorkerSource, /supabase|access_token|refresh_token/i);
});

test("P2b bietet vollständiges Handbuch, Suche und kontextbezogene Hilfe", () => {
  assert.ok(p2bHelpContent.chapters.length >= 5);
  assert.ok(p2bHelpContent.topics.length >= 20);
  assert.ok(p2bHelpRouteContexts.length >= 25);
  assert.ok(p2bHelpPageSource.includes("Hilfe durchsuchen"));
  assert.ok(p2bHelpPageSource.includes("HELP_CHAPTERS"));
  assert.ok(p2bLayoutSource.includes("Hilfe für diese Seite"));
  assert.ok(p2bLayoutSource.includes("Hilfe & Handbuch"));
});


test("Statistik ist Bestandteil der Trainingsmodule", async () => {
  const statisticsPageSource = await readFile(new URL("../src/pages/KindertrainingStatisticsPage.tsx", import.meta.url), "utf8");
  const groupStatisticsPageSource = await readFile(new URL("../src/pages/GroupTrainingStatisticsPage.tsx", import.meta.url), "utf8");
  const templatesSource = await readFile(new URL("../src/features/user-management/permission-templates.ts", import.meta.url), "utf8");
  const migrationSource = await readFile(new URL("../supabase/migrations/202608040037_statistics_permissions_training_modules.sql", import.meta.url), "utf8");
  const databaseRunnerSource = await readFile(new URL("./run-database-tests.ps1", import.meta.url), "utf8");

  for (const obsoleteKey of ["kindertraining_statistics", "u12_statistics", "u14_statistics"]) {
    assert.doesNotMatch(modulesSource, new RegExp(`key:\\s*[\"']${obsoleteKey}[\"']`));
    assert.doesNotMatch(templatesSource, new RegExp(`[\"']${obsoleteKey}[\"']`));
  }
  assert.match(appSource, /<ProtectedRoute\s+moduleKey=["']kindertraining["']>\s*<KindertrainingStatisticsPage\s*\/>/);
  assert.match(appSource, /<ProtectedRoute\s+moduleKey=["']u12["']>\s*<GroupTrainingStatisticsPage[\s\S]*?\/>\s*<\/ProtectedRoute>/);
  assert.match(appSource, /<ProtectedRoute\s+moduleKey=["']u14["']>\s*<GroupTrainingStatisticsPage[\s\S]*?\/>\s*<\/ProtectedRoute>/);
  assert.doesNotMatch(statisticsPageSource, /kindertraining_statistics/);
  assert.doesNotMatch(groupStatisticsPageSource, /statisticsModuleKey/);
  for (const marker of [
    "set is_active = false",
    "delete from public.member_module_permissions",
    "public.has_module_access(target_organization_id, 'kindertraining', false)",
    "public.has_module_access(p_organization_id, p_module_key, false)",
  ]) {
    assert.ok(migrationSource.includes(marker), `Statistikrechte-Migrationsmarker fehlt: ${marker}`);
  }
  assert.ok(databaseRunnerSource.includes("71_statistics_permissions_training_modules.test.sql"));
});

test("Kontext-Hilfe liegt im Seiteninhalt statt in der Kopfzeile", async () => {
  const layoutSource = await readFile(new URL("../src/components/layout/AppLayout.tsx", import.meta.url), "utf8");
  const headerPart = layoutSource.split('<header className="app-header">')[1]?.split('</header>')[0] ?? "";
  assert.doesNotMatch(headerPart, /Hilfe für diese Seite/);
  assert.ok(layoutSource.includes('className="icon-button page-context-help-button"'));
});

const athleteManagementP2cSource = await readFile(
  new URL("../src/pages/AthleteManagementPage.tsx", import.meta.url),
  "utf8",
);
const athleteEditorP2cSource = await readFile(
  new URL("../src/features/athletes/AthleteEditor.tsx", import.meta.url),
  "utf8",
);
const trainerEditorP2cSource = await readFile(
  new URL("../src/features/athletes/TrainerEditor.tsx", import.meta.url),
  "utf8",
);
const groupEditorP2cSource = await readFile(
  new URL("../src/features/athletes/TrainingGroupEditor.tsx", import.meta.url),
  "utf8",
);
const managementCssP2cSource = await readFile(
  new URL("../src/styles/management.css", import.meta.url),
  "utf8",
);

test("P2c vereinheitlicht Stammdatenanlage, Filter und Wischreiter", () => {
  assert.ok(athleteManagementP2cSource.includes("ManagementCreateMenu"));
  assert.ok(athleteManagementP2cSource.includes("ManagementFilterPanel"));
  assert.ok(athleteManagementP2cSource.includes("useSwipeTabs"));
  assert.ok(athleteManagementP2cSource.includes('"Gruppe suchen"'));
  assert.ok(athleteManagementP2cSource.includes("groupModuleFilter"));
  assert.ok(athleteManagementP2cSource.includes("trainerSortMode"));
});

test("P2c verwendet in allen Stammdateneditoren eine feste obere Aktionsleiste", () => {
  for (const [name, source] of [
    ["Athlet", athleteEditorP2cSource],
    ["Trainer", trainerEditorP2cSource],
    ["Gruppe", groupEditorP2cSource],
  ]) {
    assert.ok(source.includes("StickyEditorActions"), `${name}: feste Aktionsleiste fehlt.`);
    assert.ok(source.includes("useSwipeTabs"), `${name}: Wischreiter fehlen.`);
    assert.doesNotMatch(source, /className="management-actions/);
  }
  assert.ok(managementCssP2cSource.includes(".management-editor-sticky-header"));
  assert.ok(managementCssP2cSource.includes(".masterdata-filter-panel"));
});
