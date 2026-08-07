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
  "scripts/test-release-approval.mjs",
  "ULC-AENDERUNG-STARTEN.cmd",
  "ULC-PRUEFEN.cmd",
  "ULC-FREIGEBEN.cmd",
  "ULC-LOKAL-ANSEHEN.cmd",
  "scripts/check-simulation-safety.mjs",
];

for (const file of requiredFiles) assert.ok(existsSync(file), `Release-Infrastruktur fehlt: ${file}`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of ["test:runtime", "test:runtime:ci", "release:check", "release:check:ci", "test:release-approval"]) {
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

const releaseCheck = readFileSync("scripts/release/run-release-check.mjs", "utf8");
assert.match(
  releaseCheck,
  /run-runtime-smoke\.mjs/,
  "Release-Check muss den isolierten Runtime-Build ausfuehren und darf Playwright nicht direkt auf einem alten dist starten.",
);

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
