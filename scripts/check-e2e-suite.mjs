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

for (const marker of ["Hilfe für diese Seite", "Hilfe durchsuchen", "exercise-catalog"]) {
  if (!testFile.includes(marker)) throw new Error(`Help E2E marker is missing: ${marker}`);
}

console.log("E1b.1 E2E suite structure verified.");
