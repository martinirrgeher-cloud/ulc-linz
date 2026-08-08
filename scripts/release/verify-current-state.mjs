import { resolve } from "node:path";
import {
  ensureNoConflicts,
  readVerification,
  repoRoot,
  run,
  validateVerification,
} from "./lib.mjs";

const root = repoRoot();

try {
  ensureNoConflicts(root);
  const verification = readVerification(root);
  const validation = validateVerification(root, verification);

  if (validation.valid) {
    console.log("============================================================");
    console.log("ERFOLG: Dieser exakte Arbeitsstand wurde bereits vollstaendig geprueft.");
    console.log(`Pruefung vom: ${verification.verifiedAt}`);
    console.log(`Branch: ${verification.branch}`);
    console.log(`Arbeitsstand-Fingerabdruck: ${verification.worktreeFingerprint}`);
    console.log("Die teuren Build- und Browser-Tests werden nicht unnoetig wiederholt.");
    console.log("============================================================");
    process.exit(0);
  }

  console.log(`Vorhandene Pruefung kann nicht wiederverwendet werden: ${validation.reason}`);
  console.log("Starte deshalb die vollstaendige Release-Pruefung...\n");
  run(process.execPath, [resolve(root, "scripts", "release", "run-release-check.mjs")], { cwd: root });
} catch (error) {
  console.error(`\nFEHLER: Pruefung abgebrochen.\n${error.message}`);
  process.exitCode = 1;
}
