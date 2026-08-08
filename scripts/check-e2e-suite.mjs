import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "playwright.config.mjs",
  "tests/e2e/helpers/supabase-mock.mjs",
  "tests/e2e/mobile-readonly.spec.mjs",
  "scripts/run-e2e-readonly.ps1",
  ".github/workflows/e2e-readonly.yml",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`E2E file is missing: ${file}`);
}

for (const file of requiredFiles.filter((file) => file.endsWith(".mjs"))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const config = readFileSync("playwright.config.mjs", "utf8");
for (const width of [360, 390, 430, 1280]) {
  if (!config.includes(`width: ${width}`)) throw new Error(`E2E viewport is missing: ${width}px`);
}

const testFile = readFileSync("tests/e2e/mobile-readonly.spec.mjs", "utf8");
for (const route of [
  "/module/athletes",
  "/module/kindertraining/statistik",
  "/module/u12/statistik",
  "/module/exercise_catalog",
  "/module/training_blocks",
  "/module/training_overview",
  "/module/training_planning",
  "/module/user_management",
  "/module/countdown",
  "/hilfe",
]) {
  if (!testFile.includes(route)) throw new Error(`Read-only route test is missing: ${route}`);
}

const workflow = readFileSync(".github/workflows/e2e-readonly.yml", "utf8");
if (!workflow.includes("https://e2e.supabase.co")) throw new Error("The E2E workflow must use the isolated mock origin.");
if (/SUPABASE_SERVICE_ROLE|BACKUP_ENCRYPTION|RCLONE_CONFIG/.test(workflow)) {
  throw new Error("The read-only E2E workflow must not use production or backup secrets.");
}
for (const marker of [
  "test:e2e:readonly:pr",
  "test:e2e:readonly:ci",
  "github.event_name == 'pull_request'",
  "github.event_name != 'pull_request'",
]) {
  if (!workflow.includes(marker)) throw new Error(`Read-only E2E CI split marker is missing: ${marker}`);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (!pkg.scripts?.["test:e2e:readonly:pr"]?.includes("--project=mobile-390")) {
  throw new Error("PR read-only E2E must use the representative mobile-390 project.");
}
if (!pkg.scripts?.["test:e2e:readonly:ci"]) {
  throw new Error("Full read-only E2E script is missing.");
}

for (const marker of [
  'data-testid="exercise-card"',
  'data-testid="exercise-actions"',
  'data-testid="exercise-primary"',
  'data-testid="exercise-usage"',
]) {
  const source = readFileSync("src/pages/ExerciseCatalogPage.tsx", "utf8");
  if (!source.includes(marker)) throw new Error(`Stable exercise catalog test anchor is missing: ${marker}`);
}
for (const marker of ['getByTestId("exercise-card")', 'getByTestId("exercise-usage")']) {
  if (!testFile.includes(marker)) throw new Error(`Read-only stable selector is missing: ${marker}`);
}

for (const marker of [
  "Hilfe für diese Seite",
  "Hilfe durchsuchen",
  "exercise-catalog",
  "Stammdaten bündeln Anlage, Filter und Editoraktionen",
  "Stammdaten und Editorreiter wechseln auf Touchgeräten per Wischgeste",
]) {
  if (!testFile.includes(marker)) throw new Error(`Help E2E marker is missing: ${marker}`);
}

console.log("E1b.1 E2E suite structure verified.");
