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

function createBase({ releaseCheckExit = 0 } = {}) {
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
  return { base, repo, remote, baseCommit };
}

function packageDir(base, manifest, payloadValue = "neu\n") {
  const dir = resolve(base, `package-${Math.random().toString(16).slice(2)}`);
  write(resolve(dir, "payload/src/features/demo/value.txt"), payloadValue);
  write(resolve(dir, "manifest.json"), `${JSON.stringify({
    formatVersion: 2,
    packageId: "test-demo",
    packageType: "module",
    ...manifest,
    files: [{
      path: "src/features/demo/value.txt",
      mode: "replace",
      oldSha256: sha("alt\n"),
      hashMode: "text-lf",
      newSha256: sha(payloadValue),
    }],
  }, null, 2)}\n`);
  return dir;
}

function invoke(repo, pkg, extra = []) {
  return run(process.execPath, [installer, "--project", repo, "--package-dir", pkg, ...extra], repo, true);
}

test("Manifest v2 fresh-feature kopiert Dateien, prueft exakt origin/main und erkennt Wiederholung", () => {
  const f = createBase();
  try {
    const pkg = packageDir(f.base, { target: { mode: "fresh-feature", baseCommit: f.baseCommit } });
    run("git", ["switch", "-c", "feature/test-demo", f.baseCommit], f.repo);

    const probe = invoke(f.repo, pkg, ["--check-only"]);
    assert.equal(probe.status, 0, `${probe.stdout}\n${probe.stderr}`);
    assert.match(probe.stdout, /APPLICABLE/);
    assert.equal(run("git", ["status", "--porcelain"], f.repo).stdout.trim(), "");

    const first = invoke(f.repo, pkg);
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    assert.equal(readFileSync(resolve(f.repo, "src/features/demo/value.txt"), "utf8"), "neu\n");
    assert.match(run("git", ["status", "--porcelain"], f.repo).stdout, /src\/features\/demo\/value\.txt/);

    const second = invoke(f.repo, pkg);
    assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
    assert.match(second.stdout, /bereits vollstaendig vorhanden/);
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});

test("fresh-feature rollt bei fehlgeschlagener Release-Pruefung vollstaendig zurueck", () => {
  const f = createBase({ releaseCheckExit: 7 });
  try {
    const pkg = packageDir(f.base, { target: { mode: "fresh-feature", baseCommit: f.baseCommit } });
    run("git", ["switch", "-c", "feature/test-demo", f.baseCommit], f.repo);
    const result = invoke(f.repo, pkg);
    assert.notEqual(result.status, 0);
    assert.equal(run("git", ["branch", "--show-current"], f.repo).stdout.trim(), "feature/test-demo");
    assert.equal(run("git", ["status", "--porcelain"], f.repo).stdout.trim(), "");
    assert.equal(readFileSync(resolve(f.repo, "src/features/demo/value.txt"), "utf8"), "alt\r\n");
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});

test("fresh-feature lehnt main und bereits gepushten Feature-Branch ab", () => {
  const f = createBase();
  try {
    const pkg = packageDir(f.base, { target: { mode: "fresh-feature", baseCommit: f.baseCommit } });
    const onMain = invoke(f.repo, pkg);
    assert.notEqual(onMain.status, 0);
    assert.match(`${onMain.stdout}\n${onMain.stderr}`, /nur auf einem Feature-Branch/);

    run("git", ["switch", "-c", "feature/test-demo", f.baseCommit], f.repo);
    run("git", ["push", "-u", "origin", "feature/test-demo"], f.repo);
    const pushed = invoke(f.repo, pkg);
    assert.notEqual(pushed.status, 0);
    assert.match(`${pushed.stdout}\n${pushed.stderr}`, /existing-pr/);
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});

test("Manifest v2 existing-pr korrigiert exakt den bereits gepushten PR-Commit ohne neuen Feature-Branch", () => {
  const f = createBase();
  try {
    run("git", ["switch", "-c", "feature/pr-fix", f.baseCommit], f.repo);
    run("git", ["push", "-u", "origin", "feature/pr-fix"], f.repo);
    const expectedHead = run("git", ["rev-parse", "HEAD"], f.repo).stdout.trim();
    const pkg = packageDir(f.base, {
      target: {
        mode: "existing-pr",
        expectedBranch: "feature/pr-fix",
        expectedHead,
        expectedMain: f.baseCommit,
      },
    });

    const result = invoke(f.repo, pkg);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(run("git", ["branch", "--show-current"], f.repo).stdout.trim(), "feature/pr-fix");
    assert.equal(run("git", ["rev-parse", "HEAD"], f.repo).stdout.trim(), expectedHead);
    assert.equal(readFileSync(resolve(f.repo, "src/features/demo/value.txt"), "utf8"), "neu\n");
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});

test("existing-pr lehnt einen lokal oder remote abweichenden PR-Stand ab", () => {
  const f = createBase();
  try {
    run("git", ["switch", "-c", "feature/pr-fix", f.baseCommit], f.repo);
    run("git", ["push", "-u", "origin", "feature/pr-fix"], f.repo);
    const expectedHead = run("git", ["rev-parse", "HEAD"], f.repo).stdout.trim();
    const pkg = packageDir(f.base, {
      target: { mode: "existing-pr", expectedBranch: "feature/pr-fix", expectedHead },
    });

    write(resolve(f.repo, "other.txt"), "local commit\n");
    run("git", ["add", "other.txt"], f.repo);
    run("git", ["commit", "-m", "local divergence"], f.repo);
    const result = invoke(f.repo, pkg);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /erwartet HEAD/);
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});

test("Manifest v1 bleibt fuer bereits erzeugte Alt-Pakete rueckwaertskompatibel", () => {
  const f = createBase();
  try {
    const dir = resolve(f.base, "legacy-package");
    write(resolve(dir, "payload/src/features/demo/value.txt"), "neu\n");
    write(resolve(dir, "manifest.json"), `${JSON.stringify({
      formatVersion: 1,
      packageId: "legacy",
      packageType: "module",
      baseCommit: f.baseCommit,
      files: [{
        path: "src/features/demo/value.txt",
        mode: "replace",
        oldSha256: sha("alt\n"),
        hashMode: "text-lf",
        newSha256: sha("neu\n"),
      }],
    }, null, 2)}\n`);
    run("git", ["switch", "-c", "feature/legacy", f.baseCommit], f.repo);
    const result = invoke(f.repo, dir);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});
