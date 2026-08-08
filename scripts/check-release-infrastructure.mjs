import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "playwright.runtime.config.mjs",
  "tests/runtime/app-runtime.spec.mjs",
  "scripts/release/install-overlay.mjs",
  "scripts/release/run-release-check.mjs",
  "scripts/release/run-runtime-smoke.mjs",
  "scripts/release/serve-runtime-build.mjs",
  "scripts/release/approve-change.mjs",
  "scripts/release/mark-production.mjs",
  "scripts/test-release-approval.mjs",
  "ULC-AENDERUNG-STARTEN.cmd",
  "ULC-PRUEFEN.cmd",
  "ULC-FREIGEBEN.cmd",
  "ULC-LOKAL-ANSEHEN.cmd",
  "ULC-PRODUKTION-MARKIEREN.cmd",
  "scripts/check-simulation-safety.mjs",
  ".github/workflows/mobile-patch.yml",
  ".devcontainer/devcontainer.json",
  "MOBILE-ENTWICKLUNG.md",
];

for (const file of requiredFiles) assert.ok(existsSync(file), `Release-Infrastruktur fehlt: ${file}`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of [
  "test:runtime",
  "test:runtime:ci",
  "release:check",
  "release:check:ci",
  "test:release-approval",
  "test:e2e:readonly:pr",
  "test:e2e:writing:pr",
  "ci:preview",
]) {
  assert.ok(pkg.scripts?.[script], `package.json Script fehlt: ${script}`);
}
assert.match(pkg.scripts["ci:quality"], /test:release-approval/, "CI-Qualitaetspruefung muss die Freigaberoutine selbst testen.");
assert.match(pkg.scripts["ci:quality"], /check:simulation-safety/, "CI-Qualitaetspruefung muss den Simulations-Schreibschutz pruefen.");
assert.equal(
  pkg.scripts["release:check"],
  pkg.scripts["release:check:ci"],
  "Lokale und CI-Release-Pruefung muessen denselben Einstieg verwenden.",
);

const qualityWorkflow = readFileSync(".github/workflows/quality-check.yml", "utf8");
assert.match(qualityWorkflow, /npm run release:check:ci/, "Quality-Workflow muss den echten Runtime-Gate ausfuehren.");
assert.match(qualityWorkflow, /playwright install --with-deps chromium/, "Quality-Workflow muss Chromium installieren.");

const readonlyWorkflow = readFileSync(".github/workflows/e2e-readonly.yml", "utf8");
const writingWorkflow = readFileSync(".github/workflows/e2e-writing.yml", "utf8");
for (const [label, workflow] of [["Read-only E2E", readonlyWorkflow], ["Writing E2E", writingWorkflow]]) {
  assert.match(workflow, /actions\/checkout@v6/, `${label} muss die Node-24-kompatible Checkout-Action verwenden.`);
  assert.match(workflow, /actions\/setup-node@v6/, `${label} muss die Node-24-kompatible Setup-Node-Action verwenden.`);
  assert.match(workflow, /actions\/upload-artifact@v7/, `${label} muss die aktuelle Node-24-Artefakt-Action verwenden.`);
}
assert.match(writingWorkflow, /supabase\/setup-cli@v2/, "Writing E2E muss die aktuelle Supabase Setup-CLI-Action verwenden.");

const mobileWorkflow = readFileSync(".github/workflows/mobile-patch.yml", "utf8");
assert.match(mobileWorkflow, /mobile-patch\/\*\*/, "Mobile-Workflow muss auf mobile-patch-Branches begrenzt bleiben.");
assert.match(mobileWorkflow, /npm run ci:preview/, "Mobiler Patch muss das schnelle Preview-Gate verwenden.");
assert.doesNotMatch(mobileWorkflow, /npm run ci:quality/, "Mobiler Patch soll die teure Vollpruefung nicht vor jeder Preview doppelt ausfuehren.");
assert.match(mobileWorkflow, /Vercel-Preview/, "Mobile-Workflow muss den Preview-Schritt sichtbar erklaeren.");
assert.match(mobileWorkflow, /Produktion bleibt/, "Mobile-Workflow muss die Produktionsgrenze sichtbar machen.");
assert.match(mobileWorkflow, /actions\/checkout@v6/, "Mobile-Workflow muss Checkout auf Node 24 verwenden.");
assert.match(mobileWorkflow, /actions\/setup-node@v6/, "Mobile-Workflow muss Setup-Node auf Node 24 verwenden.");
assert.match(mobileWorkflow, /actions\/upload-artifact@v7/, "Mobile-Workflow muss Upload-Artifact auf Node 24 verwenden.");
assert.match(mobileWorkflow, /actions\/download-artifact@v7/, "Mobile-Workflow muss Download-Artifact auf Node 24 verwenden.");

const devcontainer = JSON.parse(readFileSync(".devcontainer/devcontainer.json", "utf8"));
assert.match(devcontainer.image ?? "", /javascript-node:1-22-bookworm/, "Codespaces muss die Node-22-Umgebung verwenden.");
assert.equal(devcontainer.postCreateCommand, "npm ci", "Codespaces muss Abhaengigkeiten reproduzierbar mit npm ci installieren.");
assert.ok(devcontainer.forwardPorts?.includes(5173), "Codespaces muss den Vite-Port 5173 weiterleiten.");

const mobileDocs = readFileSync("MOBILE-ENTWICKLUNG.md", "utf8");
for (const marker of ["MOBILE-PATCH-", "mobile-patch/", "Vercel Preview", "Squash and merge", "Codespaces"]) {
  assert.match(mobileDocs, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Mobile-Dokumentation fehlt: ${marker}`);
}

const productionMarker = readFileSync("scripts/release/mark-production.mjs", "utf8");
assert.match(productionMarker, /git[\s\S]*switch[\s\S]*main/, "Produktionsmarkierung muss lokal auf main wechseln.");
assert.match(productionMarker, /merge[\s\S]*--ff-only[\s\S]*origin\/main/, "Produktionsmarkierung muss main ausschliesslich per Fast-Forward synchronisieren.");
assert.doesNotMatch(productionMarker, /reset[\s\S]*--hard/, "Produktionsmarkierung darf den lokalen Stand nicht hart zuruecksetzen.");
assert.match(productionMarker, /resolved !== remoteMain/, "Nur der aktuelle origin/main darf als Produktion bestaetigt werden.");

const overlayInstaller = readFileSync("scripts/release/install-overlay.mjs", "utf8");
assert.match(overlayInstaller, /targetBranch\.startsWith\("feature\/"\)/, "Overlay-Installer muss zwingend den von ULC-AENDERUNG-STARTEN erzeugten Feature-Branch verwenden.");
assert.match(overlayInstaller, /currentHead !== baseCommit/, "Vorbereiteter Feature-Branch darf nur auf exakt der Paketbasis verwendet werden.");
assert.doesNotMatch(overlayInstaller, /switch[\s\S]*-c[\s\S]*feature\//, "Overlay-Installer darf keinen zweiten Feature-Branch erzeugen.");
assert.match(overlayInstaller, /git[\s\S]*restore[\s\S]*--source/, "Rollback muss die Paketdateien gezielt aus der Basis wiederherstellen.");
assert.doesNotMatch(overlayInstaller, /reset[\s\S]*--hard/, "Overlay-Installer darf fuer den Rollback keinen Hard-Reset verwenden.");
assert.match(overlayInstaller, /uniqueLocalBranch/, "Overlay-Installer muss Backup-Branches kollisionsfrei erzeugen.");

const releaseDocs = readFileSync("DEVELOPMENT-RELEASE.md", "utf8");
assert.match(releaseDocs, /ULC-AENDERUNG-STARTEN\.cmd[\s\S]*Projekt-ZIP/, "Release-Dokumentation muss die automatische Projekt-ZIP beim Aenderungsstart beschreiben.");
assert.match(releaseDocs, /Fast-Forward[\s\S]*main/, "Release-Dokumentation muss die sichere main-Synchronisierung nach Produktion festhalten.");
assert.match(releaseDocs, /zwingend[\s\S]*`ULC-AENDERUNG-STARTEN\.cmd`[\s\S]*feature\//, "Release-Dokumentation muss den einen verbindlichen Feature-Branch festhalten.");
assert.match(releaseDocs, /Download-Ordner/, "Release-Dokumentation muss ZIP und START-CMD im Download-Ordner belassen.");

const releaseCheck = readFileSync("scripts/release/run-release-check.mjs", "utf8");
assert.match(
  releaseCheck,
  /run-runtime-smoke\.mjs/,
  "Release-Check muss den isolierten Runtime-Build ausfuehren und darf Playwright nicht direkt auf einem alten dist starten.",
);

const performanceBudget = readFileSync("scripts/check-performance-budget.mjs", "utf8");
assert.match(performanceBudget, /const hardChecks = \[/, "Performance-Budget muss harte Laufzeitgrenzen explizit ausweisen.");
assert.match(performanceBudget, /const advisoryChecks = \[[\s\S]*gesamtes CSS roh[\s\S]*gesamtes CSS gzip/, "Gesamtes CSS muss als informativer Richtwert berichtet werden.");
assert.doesNotMatch(performanceBudget.match(/const hardChecks = \[[\s\S]*?\n\];/)?.[0] ?? "", /gesamtes CSS/, "Gesamtes CSS darf kein hartes Release-Gate mehr sein.");
assert.match(performanceBudget, /check-css-architecture\.mjs/, "Performance-Budget muss auf die separate CSS-Architekturpruefung als Wachstumsgrenze verweisen.");

const runtimeRunner = readFileSync("scripts/release/run-runtime-smoke.mjs", "utf8");
assert.match(runtimeRunner, /VITE_SUPABASE_URL:\s*"https:\/\/e2e\.supabase\.co"/, "Runtime-Build muss die Fake-Supabase-URL fest setzen.");
assert.match(runtimeRunner, /\.ulc-runtime-dist/, "Runtime-Build muss einen isolierten Ausgabeordner verwenden.");
assert.match(runtimeRunner, /vite\.js[\s\S]*"build"/, "Runtime-Runner muss vor Playwright einen eigenen Vite-Build erzeugen.");

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
assert.match(runtimeTest, /unerwartet zum Login umgeleitet/, "Runtime-Test muss einen fehlerhaften Auth-Testaufbau eindeutig diagnostizieren.");

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

console.log("Release-Infrastruktur: Runtime-Build, Local/CI-Flow, Router-Kompatibilitaet, Browser-Gate und Freigaberoutine sind vollstaendig abgesichert.");
