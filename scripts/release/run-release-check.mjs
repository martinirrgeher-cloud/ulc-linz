import { resolve } from "node:path";
import {
  ensureNoConflicts,
  npmCommand,
  repoRoot,
  run,
  writeVerification,
} from "./lib.mjs";

const root = repoRoot();

try {
  ensureNoConflicts(root);

  console.log("=== 1/2 Vollstaendige Qualitaetspruefung und Produktions-Build ===");
  run(npmCommand(), ["run", "ci:quality"], { cwd: root });

  console.log("\n=== 2/2 Isolierter echter Browser-Runtime-Test ===");
  // Wichtig: Nicht direkt Playwright auf den bereits vorhandenen dist-Ordner
  // starten. run-runtime-smoke erzeugt zuerst einen separaten Build mit der
  // deterministischen E2E-Supabase-Umgebung. Dadurch koennen lokale .env-Werte
  // den Auth-Test nicht mehr unbemerkt beeinflussen.
  run(process.execPath, [resolve(root, "scripts", "release", "run-runtime-smoke.mjs")], { cwd: root });

  const record = writeVerification(root, {
    checks: ["ci:quality", "runtime-smoke-isolated"],
  });

  console.log("\n============================================================");
  console.log("ERFOLG: Release-Pruefung bestanden.");
  console.log(`Branch: ${record.branch}`);
  console.log(`Arbeitsstand-Fingerabdruck: ${record.worktreeFingerprint}`);
  console.log("Dieser exakt gepruefte Stand kann jetzt freigegeben werden.");
  console.log("============================================================");
} catch (error) {
  console.error(`\nFEHLER: Release-Pruefung abgebrochen.\n${error.message}`);
  process.exitCode = 1;
}
