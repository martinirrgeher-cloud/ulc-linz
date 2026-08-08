import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const verifyScript = resolve("scripts/release/verify-current-state.mjs");
import {
  RELEASE_VERIFICATION_FORMAT_VERSION,
  RELEASE_VERIFICATION_PROFILE,
  REQUIRED_RELEASE_CHECKS,
  readVerification,
  validateVerification,
  writeVerification,
} from "./release/lib.mjs";

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ulc-verification-"));
  run("git", ["init", "-b", "main"], root);
  run("git", ["config", "user.email", "test@example.invalid"], root);
  run("git", ["config", "user.name", "ULC Test"], root);
  writeFileSync(join(root, "app.txt"), "base\n", "utf8");
  run("git", ["add", "."], root);
  run("git", ["commit", "-m", "base"], root);
  run("git", ["switch", "-c", "feature/test"], root);
  return root;
}

test("vollstaendiger Pruefnachweis ist fuer exakt denselben Arbeitsstand wiederverwendbar", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, "app.txt"), "changed\n", "utf8");
    const record = writeVerification(root, { checks: [...REQUIRED_RELEASE_CHECKS] });
    assert.equal(record.formatVersion, RELEASE_VERIFICATION_FORMAT_VERSION);
    assert.equal(record.verificationProfile, RELEASE_VERIFICATION_PROFILE);
    assert.deepEqual(validateVerification(root, readVerification(root)), { valid: true, reason: "" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("jede nachtraegliche Dateiaenderung macht den Pruefnachweis ungueltig", () => {
  const root = fixture();
  try {
    writeVerification(root, { checks: [...REQUIRED_RELEASE_CHECKS] });
    writeFileSync(join(root, "app.txt"), "after verification\n", "utf8");
    const result = validateVerification(root, readVerification(root));
    assert.equal(result.valid, false);
    assert.match(result.reason, /Arbeitsstand/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("alte oder unvollstaendige Pruefprofile werden nicht wiederverwendet", () => {
  const root = fixture();
  try {
    const old = writeVerification(root, { checks: ["ci:quality"] });
    old.formatVersion = 1;
    assert.equal(validateVerification(root, old).valid, false);

    const incomplete = writeVerification(root, { checks: ["ci:quality"] });
    const result = validateVerification(root, incomplete);
    assert.equal(result.valid, false);
    assert.match(result.reason, /fehlen verbindliche Checks/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("ULC-PRUEFEN-Einstieg ueberspringt die Vollpruefung bei exakt gueltigem Nachweis", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, "app.txt"), "changed\n", "utf8");
    writeVerification(root, { checks: [...REQUIRED_RELEASE_CHECKS] });
    const result = spawnSync(process.execPath, [verifyScript], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /bereits vollstaendig geprueft/);
    assert.doesNotMatch(result.stdout, /Starte deshalb die vollstaendige Release-Pruefung/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
