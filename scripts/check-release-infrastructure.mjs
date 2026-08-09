import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "playwright.runtime.config.mjs",
  "tests/runtime/app-runtime.spec.mjs",
  "scripts/release/install-overlay.mjs",
  "scripts/release/install-update-package.ps1",
  "scripts/release/run-release-check.mjs",
  "scripts/release/verify-current-state.mjs",
  "scripts/release/run-runtime-smoke.mjs",
  "scripts/release/serve-runtime-build.mjs",
  "scripts/release/approve-change.mjs",
  "scripts/release/start-change.mjs",
  "scripts/release/mark-production.mjs",
  "scripts/test-overlay-installer.mjs",
  "scripts/test-release-approval.mjs",
  "scripts/test-release-verification.mjs",
  "scripts/test-start-change.mjs",
  "scripts/test-production-marking.mjs",
  "ULC-AENDERUNG-STARTEN.cmd",
  "ULC-UPDATE-INSTALLIEREN.cmd",
  "ULC-PRUEFEN.cmd",
  "ULC-FREIGEBEN.cmd",
  "ULC-LOKAL-ANSEHEN.cmd",
  "ULC-PRODUKTION-MARKIEREN.cmd",
  "scripts/check-simulation-safety.mjs",
  "scripts/check-test-interaction-architecture.mjs",
  "scripts/check-writing-test-isolation.mjs",
  "scripts/test-writing-test-isolation.mjs",
  "scripts/lib/writing-test-isolation.mjs",
  "scripts/check-test-layering.mjs",
  "scripts/check-training-module-architecture.mjs",
  "scripts/check-css-ownership.mjs",
  "scripts/check-route-css-ownership.mjs",
  ".github/workflows/production-database.yml",
  ".github/workflows/production-database-baseline-recovery.yml",
  "scripts/ci/recover-production-migration-baseline.sh",
  ".devcontainer/devcontainer.json",
];
for (const file of requiredFiles) assert.ok(existsSync(file), `Release-Infrastruktur fehlt: ${file}`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const expectedNodeVersion = "22.20.0";
const expectedNpmVersion = "10.9.3";
assert.equal(readFileSync(".nvmrc", "utf8").trim(), expectedNodeVersion, ".nvmrc muss die verbindliche Node-Version pinnen.");
assert.equal(readFileSync(".node-version", "utf8").trim(), expectedNodeVersion, ".node-version muss dieselbe Node-Version pinnen.");
assert.equal(pkg.packageManager, `npm@${expectedNpmVersion}`, "packageManager muss die verbindliche npm-Version pinnen.");
assert.equal(pkg.engines?.node, expectedNodeVersion, "package.json engines.node muss exakt gepinnt sein.");
assert.equal(pkg.engines?.npm, expectedNpmVersion, "package.json engines.npm muss exakt gepinnt sein.");
for (const script of [
  "test:runtime",
  "test:runtime:ci",
  "release:check",
  "release:check:ci",
  "test:release-approval",
  "test:release-verification",
  "test:start-change",
  "test:production-marking",
  "test:e2e:readonly:pr",
  "test:e2e:writing:pr",
  "check:test-interactions",
  "check:writing-test-isolation",
  "test:writing-test-isolation",
  "check:test-layering",
  "ci:preview",
  "check:route-css-ownership",
]) assert.ok(pkg.scripts?.[script], `package.json Script fehlt: ${script}`);
assert.equal(pkg.devDependencies?.["@playwright/test"], "1.62.1", "Playwright Test muss exakt im Projekt gepinnt sein.");
assert.match(pkg.scripts["ci:quality"], /test:release-approval/, "CI muss die Freigaberoutine testen.");
assert.match(pkg.scripts["ci:quality"], /test:release-verification/, "CI muss die Wiederverwendung von Pruefnachweisen testen.");
assert.match(pkg.scripts["ci:quality"], /test:start-change/, "CI muss den Start eines Entwicklungszyklus testen.");
assert.match(pkg.scripts["ci:quality"], /test:production-marking/, "CI muss den DB-Nachweis vor der Produktionsmarkierung testen.");
assert.match(pkg.scripts["ci:quality"], /check:simulation-safety/, "CI muss den Simulations-Schreibschutz pruefen.");
assert.match(pkg.scripts["ci:quality"], /check:test-interactions/, "CI muss die stabilen Test-Interaktionsanker pruefen.");
assert.match(pkg.scripts["ci:quality"], /check:writing-test-isolation/, "CI muss die isolierten Writing-Testdomaenen pruefen.");
assert.match(pkg.scripts["ci:quality"], /test:writing-test-isolation/, "CI muss die Writing-Isolationslogik mit echten Unit-Tests pruefen.");
assert.match(pkg.scripts["ci:preview"], /check:writing-test-isolation/, "Preview-Gate muss die Writing-Testisolation statisch pruefen.");
assert.match(pkg.scripts["ci:quality"], /check:route-css-ownership/, "CI muss routeunabhaengige CSS-Ownership pruefen.");
assert.match(pkg.scripts["ci:preview"], /check:route-css-ownership/, "Preview-Gate muss routeunabhaengige CSS-Ownership pruefen.");
assert.match(pkg.scripts["ci:quality"], /check:test-layering/, "CI muss die Testschichten absichern.");
assert.match(pkg.scripts["ci:preview"], /check:test-layering/, "Preview-Gate muss die Testschichten absichern.");
assert.match(pkg.scripts["ci:preview"], /check:test-interactions/, "Preview-Gate muss die stabilen Test-Interaktionsanker pruefen.");
assert.equal(pkg.scripts["release:check"], pkg.scripts["release:check:ci"], "Lokale und CI-Release-Pruefung muessen denselben Einstieg verwenden.");
const apiFoundationCheck = readFileSync("scripts/check-api-foundation.mjs", "utf8");
assert.match(apiFoundationCheck, /check-training-module-architecture\.mjs/, "API-Foundation muss die S3c-Trainingsmodulgrenzen einschliessen.");
const cssArchitectureCheck = readFileSync("scripts/check-css-architecture.mjs", "utf8");
assert.match(cssArchitectureCheck, /check-css-ownership\.mjs/, "CSS-Architekturcheck muss die S3b-Ownership-Pruefung einschliessen.");

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
assert.equal(lock.packages?.[""]?.engines?.node, expectedNodeVersion, "package-lock engines.node muss exakt zum Toolchain-Pin passen.");
assert.equal(lock.packages?.[""]?.engines?.npm, expectedNpmVersion, "package-lock engines.npm muss exakt zum Toolchain-Pin passen.");
assert.equal(lock.packages?.[""]?.devDependencies?.["@playwright/test"], "1.62.1", "package-lock muss Playwright exakt am Root pinnen.");
assert.equal(lock.packages?.["node_modules/@playwright/test"]?.version, "1.62.1", "package-lock muss Playwright Test 1.62.1 enthalten.");
assert.equal(lock.packages?.["node_modules/playwright"]?.version, "1.62.1", "package-lock muss Playwright 1.62.1 enthalten.");
assert.equal(lock.packages?.["node_modules/playwright-core"]?.version, "1.62.1", "package-lock muss Playwright Core 1.62.1 enthalten.");

const qualityWorkflow = readFileSync(".github/workflows/quality-check.yml", "utf8");
const readonlyWorkflow = readFileSync(".github/workflows/e2e-readonly.yml", "utf8");
const writingWorkflow = readFileSync(".github/workflows/e2e-writing.yml", "utf8");
const productionDatabaseWorkflow = readFileSync(".github/workflows/production-database.yml", "utf8");
const productionDatabaseRecoveryWorkflow = readFileSync(".github/workflows/production-database-baseline-recovery.yml", "utf8");
const productionDatabaseRecoveryScript = readFileSync("scripts/ci/recover-production-migration-baseline.sh", "utf8");
for (const [label, workflow] of [["Quality", qualityWorkflow], ["Read-only E2E", readonlyWorkflow], ["Writing E2E", writingWorkflow]]) {
  assert.match(workflow, /actions\/checkout@v6/, `${label} muss Checkout v6 verwenden.`);
  assert.match(workflow, /actions\/setup-node@v6/, `${label} muss Setup-Node v6 verwenden.`);
  assert.doesNotMatch(workflow, /npm install --no-save --package-lock=false @playwright\/test/, `${label} darf Playwright nicht dynamisch neben package-lock installieren.`);
}
assert.match(qualityWorkflow, /quality-core:[\s\S]*npm run ci:quality/, "Quality-Workflow muss die Kernpruefung in einem eigenen Job ausfuehren.");
assert.match(qualityWorkflow, /runtime:[\s\S]*test:runtime:pr[\s\S]*test:runtime:ci/, "Quality-Workflow muss PR-Runtime und Vollregression getrennt ausfuehren.");
assert.match(qualityWorkflow, /quality:[\s\S]*name:\s*TypeScript, Tests, Build und Runtime[\s\S]*needs:[\s\S]*quality-core[\s\S]*runtime/, "Bestehendes verpflichtendes Quality-Gate muss als Aggregator erhalten bleiben.");
assert.match(qualityWorkflow, /playwright install --with-deps chromium/, "Runtime-Job muss Chromium samt Systemabhaengigkeiten installieren.");
assert.match(qualityWorkflow, /actions\/upload-artifact@v7/, "Quality muss Upload-Artifact v7 verwenden.");
assert.match(readonlyWorkflow, /actions\/upload-artifact@v7/, "Read-only E2E muss Upload-Artifact v7 verwenden.");
assert.match(writingWorkflow, /actions\/upload-artifact@v7/, "Writing E2E muss Upload-Artifact v7 verwenden.");
assert.match(writingWorkflow, /supabase\/setup-cli@v2/, "Writing E2E muss die aktuelle Supabase Setup-CLI-Action verwenden.");
assert.match(writingWorkflow, /scripts\/ci\/prepare-writing-e2e\.sh/, "Writing E2E muss Supabase und Chromium ueber den parallelen Vorbereitungsblock starten.");
assert.doesNotMatch(writingWorkflow, /- name: Isolierte lokale Supabase-Umgebung starten/, "Der alte serielle Supabase-Start darf nicht mehr im Workflow stehen.");
assert.doesNotMatch(writingWorkflow, /- name: Chromium und Systemabhaengigkeiten installieren/, "Die alte serielle Chromium-Installation darf nicht mehr im Workflow stehen.");

for (const marker of [
  "push:",
  "branches:",
  "main",
  "SUPABASE_DB_URL",
  "supabase db push --db-url",
  "--dry-run",
  "supabase_migrations.schema_migrations",
  "database-verified-${GITHUB_SHA}",
]) {
  assert.ok(productionDatabaseWorkflow.includes(marker), `Produktionsdatenbank-Workflow fehlt: ${marker}`);
}
assert.match(productionDatabaseWorkflow, /permissions:[\s\S]*contents:\s*write/, "Produktionsdatenbank-Workflow braucht Schreibrecht nur fuer den Verifikations-Tag.");
assert.doesNotMatch(productionDatabaseWorkflow, /migration\s+repair/, "Produktionsworkflow darf Migrationshistorie nie automatisch reparieren.");
assert.doesNotMatch(productionDatabaseWorkflow, /db\s+reset/, "Produktionsworkflow darf die Produktionsdatenbank nie resetten.");
assert.doesNotMatch(productionDatabaseWorkflow, /seed/i, "Produktionsworkflow darf keine Seed-Daten nach Produktion schreiben.");

assert.match(productionDatabaseRecoveryWorkflow, /workflow_dispatch:/, "Baseline-Diagnose darf nur manuell gestartet werden.");
assert.match(productionDatabaseRecoveryWorkflow, /BASELINE-DIAGNOSE/, "Baseline-Diagnose muss eine explizite Bestaetigung verlangen.");
assert.match(productionDatabaseRecoveryWorkflow, /refs\/heads\/main/, "Baseline-Diagnose darf ausschliesslich auf main laufen.");
assert.match(productionDatabaseRecoveryWorkflow, /recover-production-migration-baseline\.sh/, "Baseline-Diagnose muss den zentralen Diagnose-Guard verwenden.");
assert.match(productionDatabaseRecoveryWorkflow, /actions\/upload-artifact@v7/, "Baseline-Diagnose muss den vollstaendigen Diagnosebericht als Artefakt sichern.");
assert.match(productionDatabaseRecoveryWorkflow, /permissions:[\s\S]*contents:\s*read/, "Baseline-Diagnose darf keine Schreibrechte auf Repository-Inhalte besitzen.");
assert.doesNotMatch(productionDatabaseRecoveryWorkflow, /database-verified-|git\s+tag|git\s+push/, "Baseline-Diagnose darf den regulaeren DB-Verifikations-Tag nicht selbst erzeugen.");
assert.doesNotMatch(productionDatabaseRecoveryWorkflow, /supabase\s+db\s+reset|supabase\s+migration\s+repair|supabase\s+db\s+push/, "Baseline-Diagnose darf weder DB-Reset, Historienreparatur noch DB-Push ausfuehren.");
assert.doesNotMatch(productionDatabaseRecoveryWorkflow, /include-seed|seed\s+buckets/i, "Baseline-Diagnose darf keine Seed-Daten schreiben.");
assert.match(productionDatabaseRecoveryScript, /BASELINE_VERSION="202608080039"/, "Diagnose muss den historischen Baseline-Cutoff fest pinnen.");
assert.match(productionDatabaseRecoveryScript, /FIRST_PENDING_VERSION="202608090040"/, "Diagnose muss Migration 040 als erste noch nicht baselinede Migration fest pinnen.");
assert.match(productionDatabaseRecoveryScript, /vollstaendig leere Remote-Migrationshistorie/, "Diagnose muss bei bereits vorhandener Remote-Historie abbrechen.");
assert.match(productionDatabaseRecoveryScript, /supabase db diff --db-url "\$DB_URL" --schema public --use-migra > "\$FORWARD_SQL"/, "Diagnose muss den Baseline-zu-Produktion-Diff mit der gepinnten Supabase CLI 2.109.1 direkt aus stdout erfassen.");
assert.match(productionDatabaseRecoveryScript, /baseline-001-039-to-production\.sql/, "Diagnose muss die Diff-Richtung Baseline 001-039 zu Produktion eindeutig benennen.");
assert.match(productionDatabaseRecoveryScript, /supabase db dump[\s\S]*--schema public/, "Diagnose muss einen schema-only public-Dump fuer die spaetere Bewertung sichern.");
assert.doesNotMatch(productionDatabaseRecoveryScript, /--from\b|--to\b|--output\b/, "Diagnose darf keine mit Supabase CLI 2.109.1 inkompatiblen db-diff-Flags verwenden.");
assert.doesNotMatch(productionDatabaseRecoveryScript, /supabase\s+migration\s+repair|supabase\s+db\s+push|supabase\s+db\s+reset/, "Diagnose-Skript muss strikt read-only bleiben.");
assert.doesNotMatch(productionDatabaseRecoveryScript, /include-seed|seed\s+buckets/i, "Diagnose-Skript darf keine Seed-Daten schreiben.");

const writingPreparation = readFileSync("scripts/ci/prepare-writing-e2e.sh", "utf8");
assert.match(writingPreparation, /supabase start[\s\S]*&/, "Writing-Vorbereitung muss Supabase im Hintergrund starten.");
assert.match(writingPreparation, /playwright install --with-deps chromium/, "Writing-Vorbereitung muss parallel Chromium samt Systemabhaengigkeiten installieren.");
assert.match(writingPreparation, /wait "\$SUPABASE_PID"/, "Writing-Vorbereitung muss den Supabase-Prozess verbindlich abwarten.");
assert.match(writingPreparation, /supabase status/, "Writing-Vorbereitung muss nach dem Parallelstart den Supabase-Status pruefen.");

const writingConfig = readFileSync("playwright.writing.config.mjs", "utf8");
assert.match(writingConfig, /fullyParallel:\s*false/, "Writing-E2E darf Tests innerhalb einer Domaenendatei nicht automatisch parallelisieren.");
assert.match(writingConfig, /workers:\s*process\.env\.CI\s*\?\s*2\s*:\s*1/, "Writing-E2E muss in CI genau zwei Datei-Worker und lokal einen Worker nutzen.");
assert.doesNotMatch(writingConfig, /fullyParallel:\s*true/, "Globale Writing-Parallelisierung ist ohne Domaenenisolation verboten.");


for (const retiredFile of [".github/workflows/mobile-patch.yml", "MOBILE-ENTWICKLUNG.md"]) {
  assert.equal(existsSync(retiredFile), false, `Veralteter Mobile-Patch-Workflow darf nicht zurueckkehren: ${retiredFile}`);
}

const devcontainer = JSON.parse(readFileSync(".devcontainer/devcontainer.json", "utf8"));
assert.match(devcontainer.image ?? "", /javascript-node:1-22-bookworm/, "Codespaces muss Node 22 verwenden.");
assert.equal(devcontainer.postCreateCommand, "npm ci", "Codespaces muss Abhaengigkeiten reproduzierbar mit npm ci installieren.");
assert.ok(devcontainer.forwardPorts?.includes(5173), "Codespaces muss den Vite-Port 5173 weiterleiten.");

const startChange = readFileSync("scripts/release/start-change.mjs", "utf8");
assert.match(startChange, /branchBefore !== "main"/, "Neue Aenderungen duerfen nur von lokalem main starten.");
assert.match(startChange, /localMain !== remoteMain/, "Lokaler main muss exakt origin\/main entsprechen.");
assert.match(startChange, /production-\*/, "Start muss einen bestaetigten production-Tag verlangen.");
assert.match(startChange, /remoteBranchExists/, "Start muss gleichnamige Remote-Feature-Branches blockieren.");
assert.match(startChange, /Start des Entwicklungszyklus wird zurueckgerollt/, "Fehler nach Branch-Erstellung muessen den Start transaktional zurueckrollen.");
assert.match(startChange, /ULC_PROJECT_ARCHIVE_OUTPUT_DIRECTORY/, "Start muss fuer isolierte Tests ein separates Archiv-Ausgabeverzeichnis unterstuetzen.");

const startChangeTest = readFileSync("scripts/test-start-change.mjs", "utf8");
assert.match(startChangeTest, /copyFileSync\(archiveScript/, "Start-Test muss die reale Archivroutine in sein isoliertes Test-Repository kopieren.");
assert.match(startChangeTest, /ULC_PROJECT_ARCHIVE_OUTPUT_DIRECTORY/, "Start-Test darf Projektarchive nicht auf den echten Benutzer-Desktop schreiben.");
assert.match(startChangeTest, /ULC-Linz-App-Aktuell_/, "Windows-Erfolgsfall muss die erzeugte Projekt-ZIP verifizieren.");
assert.match(startChangeTest, /unsafe-env/, "Start-Test muss echte verschachtelte .env-Dateien weiterhin als unsicher pruefen.");

const archive = readFileSync("scripts/create-project-archive.ps1", "utf8");
assert.match(archive, /git -C \$ProjectRoot archive/, "Projekt-ZIP muss direkt aus dem Git-Commit erzeugt werden.");
assert.match(archive, /ULC-SOURCE-METADATA\.json/, "Projekt-ZIP muss eindeutige Source-Metadaten enthalten.");
assert.match(archive, /rev-parse\s+["\']?HEAD\^\{tree\}["\']?/, "Projekt-ZIP muss den Git-Tree dokumentieren.");
assert.doesNotMatch(archive, /robocopy/i, "Projekt-ZIP darf nicht mehr per Dateisystem-Kopie erzeugt werden.");
assert.match(archive, /supabase-local\.env/, "Archivroutine muss lokale Supabase-Zugangsdaten explizit blockieren.");
assert.match(archive, /\(\^\|\/\)\\\.env\\\.example\$/, "Archivroutine muss verschachtelte .env.example-Vorlagen erlauben.");
assert.doesNotMatch(archive, /\$Normalized\s+-ne\s+["']\.env\.example["']/, "Archivroutine darf .env.example nicht nur im Projektstamm erlauben.");

const updateCmd = readFileSync("ULC-UPDATE-INSTALLIEREN.cmd", "utf8");
const updatePs = readFileSync("scripts/release/install-update-package.ps1", "utf8");
assert.match(updateCmd, /install-update-package\.ps1/, "Permanente Update-CMD muss den zentralen Paketfinder verwenden.");
assert.doesNotMatch(updateCmd, /-ProjectRoot\s+"%~dp0"/, "Permanente Update-CMD darf den mit Backslash endenden %~dp0-Pfad nicht als PowerShell-Argument uebergeben.");
assert.doesNotMatch(updateCmd, /-ProjectRoot\b/, "Permanente Update-CMD soll den Projektroot vom PowerShell-Installer selbst aus dessen Speicherort bestimmen lassen.");
assert.match(updatePs, /ULC-Linz-App-UPDATE-\*\.zip/, "Update-Installer darf nur den festen Paketnamensraum im Download-Ordner pruefen.");
assert.match(updatePs, /--check-only/, "Update-Installer muss Pakete vor der Auswahl gegen den aktuellen Git-Stand pruefen.");
assert.match(updatePs, /PreviousErrorActionPreference[\s\S]*ErrorActionPreference = "Continue"[\s\S]*ProbeExitCode = \$LASTEXITCODE/, "Windows-PowerShell-5.1-Probes muessen erfolgreiche native stderr-Ausgaben tolerieren und nach Exitcode entscheiden.");
assert.doesNotMatch(updatePs, /--check-only\s+\*>\s*\$null/, "Applicability-Probe darf unter Windows PowerShell 5.1 nicht alle nativen Streams bei ErrorActionPreference=Stop verwerfen.");
assert.match(updatePs, /Gepruefte Pakete und Ablehnungsgruende/, "Paketfinder muss konkrete Ablehnungsgruende sichtbar machen, falls kein Update passt.");
assert.match(updatePs, /Get-FileHash[\s\S]*SHA256/, "Identische Browser-Downloads muessen ueber SHA-256 erkannt werden.");
assert.doesNotMatch(updatePs, /Get-ChildItem[^\n]*-Recurse/, "Update-Paket darf nicht rekursiv im Dateisystem gesucht werden.");

const overlayInstaller = readFileSync("scripts/release/install-overlay.mjs", "utf8");
assert.match(overlayInstaller, /\[1, 2\]\.includes/, "Overlay-Installer muss Manifest v1 und v2 verarbeiten.");
assert.match(overlayInstaller, /fresh-feature/, "Manifest v2 muss fresh-feature unterstuetzen.");
assert.match(overlayInstaller, /existing-pr/, "Manifest v2 muss bestehende PR-Korrekturen unterstuetzen.");
assert.match(overlayInstaller, /remoteBranchCommit/, "PR-Korrekturen muessen den Remote-Feature-Commit pruefen.");
assert.match(overlayInstaller, /--check-only/, "Paket-Anwendbarkeit muss ohne Installation pruefbar sein.");
assert.doesNotMatch(overlayInstaller, /switch[\s\S]*-c[\s\S]*feature\//, "Overlay-Installer darf keinen zweiten Feature-Branch erzeugen.");
assert.match(overlayInstaller, /git[\s\S]*restore[\s\S]*--source/, "Rollback muss Paketdateien gezielt aus dem Ausgangscommit wiederherstellen.");
assert.doesNotMatch(overlayInstaller, /reset[\s\S]*--hard/, "Overlay-Installer darf keinen Hard-Reset verwenden.");
assert.match(overlayInstaller, /uniqueLocalBranch/, "Overlay-Installer muss kollisionsfreie Backup-Branches erzeugen.");
assert.match(overlayInstaller, /npmCommand\(\)[\s\S]*\["ci"\]/, "Aenderungen an package.json\/lock muessen node_modules reproduzierbar synchronisieren.");

const verifyScript = readFileSync("scripts/release/verify-current-state.mjs", "utf8");
const lib = readFileSync("scripts/release/lib.mjs", "utf8");
const approve = readFileSync("scripts/release/approve-change.mjs", "utf8");
const verifyCmd = readFileSync("ULC-PRUEFEN.cmd", "utf8");
assert.match(verifyCmd, /verify-current-state\.mjs/, "ULC-PRUEFEN muss zuerst einen vorhandenen Pruefnachweis wiederverwenden koennen.");
assert.match(verifyScript, /validateVerification/, "Schnellpruefung muss Branch, HEAD, Fingerprint und Profil validieren.");
assert.match(verifyScript, /run-release-check\.mjs/, "Bei ungueltigem Nachweis muss automatisch die Vollpruefung laufen.");
assert.match(lib, /RELEASE_VERIFICATION_PROFILE/, "Pruefnachweis muss ein versioniertes Releaseprofil besitzen.");
assert.match(lib, /REQUIRED_RELEASE_CHECKS/, "Pruefnachweis muss die verbindlichen Checks explizit ausweisen.");
assert.match(approve, /validateVerification/, "ULC-FREIGEBEN muss dasselbe strenge Pruefprofil verlangen.");

const productionMarker = readFileSync("scripts/release/mark-production.mjs", "utf8");
assert.match(productionMarker, /git[\s\S]*switch[\s\S]*main/, "Produktionsmarkierung muss lokal auf main wechseln.");
assert.match(productionMarker, /merge[\s\S]*--ff-only[\s\S]*origin\/main/, "Produktionsmarkierung muss main ausschliesslich per Fast-Forward synchronisieren.");
assert.doesNotMatch(productionMarker, /reset[\s\S]*--hard/, "Produktionsmarkierung darf den lokalen Stand nicht hart zuruecksetzen.");
assert.match(productionMarker, /resolved !== remoteMain/, "Nur der aktuelle origin/main darf als Produktion bestaetigt werden.");
assert.match(productionMarker, /database-verified-\$\{resolved\}/, "Produktionsmarkierung muss den DB-Verifikations-Tag des exakten Commits verlangen.");
assert.match(productionMarker, /Produktionsdatenbank migrieren/, "Produktionsmarkierung muss bei fehlendem DB-Nachweis auf den GitHub-Workflow verweisen.");

const releaseDocs = readFileSync("DEVELOPMENT-RELEASE.md", "utf8");
for (const marker of ["ULC-UPDATE-INSTALLIEREN.cmd", "Manifestformat v2", "existing-pr", "ULC-SOURCE-METADATA.json", "Prüfnachweis wiederverwenden"]) {
  assert.match(releaseDocs, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Release-Dokumentation fehlt: ${marker}`);
}
assert.match(releaseDocs, /Fast-Forward[\s\S]*main/, "Release-Dokumentation muss die sichere main-Synchronisierung nach Produktion festhalten.");
assert.match(releaseDocs, /Produktionsdatenbank migrieren[\s\S]*database-verified-<commit>/, "Release-Dokumentation muss das Produktionsdatenbank-Gate vor der Produktionsmarkierung festhalten.");

const releaseCheck = readFileSync("scripts/release/run-release-check.mjs", "utf8");
assert.match(releaseCheck, /run-runtime-smoke\.mjs/, "Release-Check muss den isolierten Runtime-Build ausfuehren.");

const performanceBudget = readFileSync("scripts/check-performance-budget.mjs", "utf8");
assert.match(performanceBudget, /const hardChecks = \[/, "Performance-Budget muss harte Laufzeitgrenzen explizit ausweisen.");
assert.match(performanceBudget, /const advisoryChecks = \[[\s\S]*gesamtes CSS roh[\s\S]*gesamtes CSS gzip/, "Gesamtes CSS muss als Richtwert berichtet werden.");
assert.doesNotMatch(performanceBudget.match(/const hardChecks = \[[\s\S]*?\n\];/)?.[0] ?? "", /gesamtes CSS/, "Gesamtes CSS darf kein hartes Release-Gate sein.");

const runtimeRunner = readFileSync("scripts/release/run-runtime-smoke.mjs", "utf8");
const playwrightEnsure = readFileSync("scripts/release/ensure-playwright.mjs", "utf8");
assert.match(runtimeRunner, /VITE_SUPABASE_URL:\s*"https:\/\/e2e\.supabase\.co"/, "Runtime-Build muss die Fake-Supabase-URL fest setzen.");
assert.match(runtimeRunner, /\.ulc-runtime-dist/, "Runtime-Build muss einen isolierten Ausgabeordner verwenden.");
assert.match(runtimeRunner, /--profile=/, "Runtime-Runner muss ein explizites PR-/Full-Profil unterstuetzen.");
assert.match(runtimeRunner, /--grep", "@pr"/, "PR-Runtime muss ausschliesslich markierte kritische Runtime-Tests ausfuehren.");
assert.doesNotMatch(playwrightEnsure, /install[\s\S]*--no-save[\s\S]*@playwright\/test/, "Playwright darf lokal nicht mehr dynamisch in package.json vorbei installiert werden.");
assert.match(playwrightEnsure, /npmCommand\(\)[\s\S]*\["ci"\]/, "Bei unsynchronisierten Abhaengigkeiten muss npm ci verwendet werden.");

const runtimeConfig = readFileSync("playwright.runtime.config.mjs", "utf8");
assert.match(runtimeConfig, /serve-runtime-build\.mjs/, "Runtime-Test muss den isolierten Build ausliefern.");
assert.match(runtimeConfig, /reuseExistingServer:\s*false/, "Runtime-Test darf keinen alten lokalen Server wiederverwenden.");

const gitignore = readFileSync(".gitignore", "utf8");
assert.match(gitignore, /^\.ulc-runtime-dist\/$/m, "Isolierter Runtime-Build muss ignoriert werden.");

const runtimeTest = readFileSync("tests/runtime/app-runtime.spec.mjs", "utf8");
assert.match(runtimeTest, /pageerror/, "Runtime-Test muss pageerror ueberwachen.");
assert.match(runtimeTest, /console\.error/, "Runtime-Test muss console.error ueberwachen.");
assert.match(runtimeTest, /app-error-boundary/, "Runtime-Test muss den React Error Boundary pruefen.");
assert.match(runtimeTest, /\/module\/athletes/, "Runtime-Test muss mindestens eine authentifizierte Modulroute oeffnen.");
assert.equal((runtimeTest.match(/tag:\s*"@pr"/g) ?? []).length, 7, "Runtime-Suite muss exakt sieben kritische PR-Tests markieren.");

const appSource = readFileSync("src/app/App.tsx", "utf8");
if (/\bBrowserRouter\b/.test(appSource)) {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const stack = ["src"];
  const blockerUsers = [];
  while (stack.length) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (/\.[cm]?[jt]sx?$/.test(name) && /\buseBlocker\b/.test(readFileSync(full, "utf8"))) blockerUsers.push(full);
    }
  }
  assert.deepEqual(blockerUsers, [], `BrowserRouter ist mit useBlocker nicht kompatibel: ${blockerUsers.join(", ")}`);
}

console.log("Release-Infrastruktur S1: reproduzierbare Source-ZIP, permanenter Update-Installer, Manifest v2, Pruefnachweis-Reuse und lokale/CI-Gates sind abgesichert.");
