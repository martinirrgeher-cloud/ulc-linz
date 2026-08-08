import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "playwright.writing.config.mjs",
  "scripts/seed-e2e-writing.mjs",
  "scripts/run-e2e-writing.ps1",
  "tests/e2e-writing/helpers/test-data.mjs",
  "tests/e2e-writing/helpers/auth.mjs",
  "tests/e2e-writing/core-writing.spec.mjs",
  ".github/workflows/e2e-writing.yml",
  "E1B2-SCHREIBENDE-TESTS.md",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`E1b.2 file is missing: ${file}`);
}

for (const file of requiredFiles.filter((file) => file.endsWith(".mjs"))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const config = readFileSync("playwright.writing.config.mjs", "utf8");
for (const marker of [
  'testDir: "./tests/e2e-writing"',
  "fullyParallel: false",
  "workers: 1",
  "retries: 0",
  "width: 390",
  "height: 844",
  "port 4174",
]) {
  if (!config.includes(marker)) throw new Error(`Writing E2E config marker is missing: ${marker}`);
}

const seed = readFileSync("scripts/seed-e2e-writing.mjs", "utf8");
for (const marker of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "auth.admin.createUser",
  "admin.e1b2@example.test",
  "trainer.e1b2@example.test",
  "athlete.e1b2@example.test",
  "parent.e1b2@example.test",
  "E2E Beschleunigungsblock",
  "SECOND_ATHLETE_ID",
  "Berta",
]) {
  if (!seed.includes(marker)) throw new Error(`Writing E2E seed marker is missing: ${marker}`);
}

const testFile = readFileSync("tests/e2e-writing/core-writing.spec.mjs", "utf8");
for (const marker of [
  "/module/athletes",
  "/module/exercise_catalog",
  "/module/training_blocks",
  "/module/performance_registration",
  "/module/training_planning",
  "/module/user_management",
  "Rechtevorlage",
  "Änderungsprotokoll",
  "Der Datensatz wird bereits bearbeitet.",
  "E2E Leistungsgruppe bearbeiten",
  "Tom E2E bearbeiten",
  "Übung suchen",
  "Neuerer Serverstand vorhanden",
  "Eigene Eingaben behalten",
  "Schwierigkeitsgrad",
  "Neue Variante von",
  "für Vergleich auswählen",
  "Verknüpfte Athleten geändert",
  "Berta E2E",
  'data-realtime-status="subscribed"',
]) {
  if (!testFile.includes(marker)) throw new Error(`Writing E2E test marker is missing: ${marker}`);
}
for (const marker of [
  '{ tag: "@pr" }',
  'getByTestId("masterdata-create-menu-toggle")',
  'getByTestId("editor-save")',
  'getByTestId("editor-close")',
  'getByTestId("exercise-card")',
  'getByTestId("exercise-create")',
  'getByTestId("training-block-create")',
  'getByTestId("exercise-usage")',
]) {
  if (!testFile.includes(marker)) throw new Error(`Writing E2E stable selector/PR marker is missing: ${marker}`);
}
const trainerGroupSequence = /getByLabel\("E-Mail-Adresse"\)[\s\S]{0,300}getByRole\("tab", \{ name: \/Gruppen\/ \}\)\.click\(\)[\s\S]{0,300}getByRole\("checkbox", \{ name: UI_GROUP, exact: true \}\)\.check\(\)/;
if (!trainerGroupSequence.test(testFile)) {
  throw new Error("Trainer creation must open the Gruppen tab before selecting a training group.");
}

const prTagCount = (testFile.match(/tag:\s*"@pr"/g) ?? []).length;
if (prTagCount < 4) {
  throw new Error(`Expected at least 4 PR-tagged writing E2E tests, found ${prTagCount}.`);
}

if (testFile.includes("test.describe.serial")) {
  throw new Error("Writing E2E tests must continue after an individual failure.");
}
const writingTestCount = (testFile.match(/\btest\("/g) ?? []).length;
if (writingTestCount !== 6) {
  throw new Error(`Expected 6 writing E2E tests, found ${writingTestCount}.`);
}

const workflow = readFileSync(".github/workflows/e2e-writing.yml", "utf8");
for (const marker of [
  "supabase start",
  "supabase migration list --local",
  "supabase status -o env",
  "seed-e2e-writing.mjs",
  "Schreibrelevante Aenderungen erkennen",
  "test:e2e:writing:pr",
  "test:e2e:writing:ci",
  "steps.scope.outputs.run == 'true'",
  "supabase stop --no-backup",
]) {
  if (!workflow.includes(marker)) throw new Error(`Writing E2E workflow marker is missing: ${marker}`);
}
if (/\$\{\{\s*secrets\./.test(workflow)) {
  throw new Error("The writing E2E workflow must not use repository or production secrets.");
}
if (/https:\/\/[^\s]+\.supabase\.co/.test(workflow)) {
  throw new Error("The writing E2E workflow must not reference a hosted Supabase project.");
}
if (workflow.includes("supabase db reset")) {
  throw new Error("The writing E2E workflow must not reset Postgres after Realtime has started.");
}
const structureCheckIndex = workflow.indexOf("Teststruktur pruefen");
const supabaseStartIndex = workflow.indexOf("Isolierte lokale Supabase-Umgebung starten");
if (structureCheckIndex < 0 || supabaseStartIndex < 0 || structureCheckIndex > supabaseStartIndex) {
  throw new Error("Writing E2E structure checks must run before the expensive Supabase startup.");
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (!pkg.scripts?.["test:e2e:writing:pr"]?.includes("--grep @pr")) {
  throw new Error("PR writing E2E script must select the @pr core set.");
}
if (!pkg.scripts?.["test:e2e:writing:ci"]) {
  throw new Error("Full writing E2E script is missing.");
}

const runnerBuffer = readFileSync("scripts/run-e2e-writing.ps1");
if ([...runnerBuffer].some((byte) => byte > 127)) {
  throw new Error("The Windows PowerShell runner must contain ASCII characters only.");
}

console.log("E1b.2 writing E2E suite structure verified.");
