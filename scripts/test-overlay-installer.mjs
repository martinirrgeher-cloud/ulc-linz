import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const installer = resolve("scripts/release/install-overlay.mjs");

function run(command, args, cwd, allowFailure = false) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function sha(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, "utf8");
}

function createFixture({ releaseCheckExit = 0 } = {}) {
  const base = mkdtempSync(resolve(tmpdir(), "ulc-overlay-test-"));
  const repo = resolve(base, "repo");
  const remote = resolve(base, "origin.git");
  mkdirSync(repo, { recursive: true });

  run("git", ["init", "--bare", remote], base);
  run("git", ["init", "-b", "main"], repo);
  run("git", ["config", "user.email", "test@example.test"], repo);
  run("git", ["config", "user.name", "ULC Test"], repo);
  write(resolve(repo, "src/features/demo/value.txt"), "alt\r\n");
  write(resolve(repo, "scripts/release/run-release-check.mjs"), `process.exit(${releaseCheckExit});\n`);
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "base"], repo);
  run("git", ["remote", "add", "origin", remote], repo);
  run("git", ["push", "-u", "origin", "main"], repo);
  const baseCommit = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();

  const packageDir = resolve(base, "package");
  const payloadValue = "neu\n";
  write(resolve(packageDir, "payload/src/features/demo/value.txt"), payloadValue);
  write(resolve(packageDir, "manifest.json"), `${JSON.stringify({
    formatVersion: 1,
    packageId: "test-demo",
    packageType: "module",
    baseCommit,
    files: [{
      path: "src/features/demo/value.txt",
      mode: "replace",
      oldSha256: sha("alt\n"),
      hashMode: "text-lf",
      newSha256: sha(payloadValue),
    }],
  }, null, 2)}\n`);

  return { base, repo, packageDir, baseCommit };
}

function invokeInstaller(repo, packageDir) {
  return run(process.execPath, [installer, "--project", repo, "--package-dir", packageDir], repo, true);
}

test("Overlay-Installer kopiert vollständige Dateien und erkennt Wiederholung", () => {
  const fixture = createFixture();
  try {
    const first = invokeInstaller(fixture.repo, fixture.packageDir);
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    assert.equal(readFileSync(resolve(fixture.repo, "src/features/demo/value.txt"), "utf8"), "neu\n");
    assert.match(run("git", ["branch", "--show-current"], fixture.repo).stdout.trim(), /^feature\/test-demo-/);
    assert.match(run("git", ["status", "--porcelain"], fixture.repo).stdout, /src\/features\/demo\/value\.txt/);

    const second = invokeInstaller(fixture.repo, fixture.packageDir);
    assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
    assert.match(second.stdout, /bereits vollstaendig vorhanden/);
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("Overlay-Installer rollt bei fehlgeschlagener Release-Prüfung vollständig zurück", () => {
  const fixture = createFixture({ releaseCheckExit: 7 });
  try {
    const result = invokeInstaller(fixture.repo, fixture.packageDir);
    assert.notEqual(result.status, 0);
    assert.equal(run("git", ["branch", "--show-current"], fixture.repo).stdout.trim(), "main");
    assert.equal(run("git", ["status", "--porcelain"], fixture.repo).stdout.trim(), "");
    assert.equal(readFileSync(resolve(fixture.repo, "src/features/demo/value.txt"), "utf8"), "alt\r\n");
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});
