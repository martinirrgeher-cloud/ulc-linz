import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve("scripts/release/start-change.mjs");
const archiveScript = resolve("scripts/create-project-archive.ps1");

function run(command, args, cwd, allowFailure = false, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "ULC Test",
      GIT_AUTHOR_EMAIL: "ulc-test@example.invalid",
      GIT_COMMITTER_NAME: "ULC Test",
      GIT_COMMITTER_EMAIL: "ulc-test@example.invalid",
      ...extraEnv,
    },
  });
  if (!allowFailure && result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

function setup() {
  const base = mkdtempSync(join(tmpdir(), "ulc-start-change-"));
  const remote = join(base, "origin.git");
  const repo = join(base, "repo");
  run("git", ["init", "--bare", remote], base);
  run("git", ["init", "-b", "main", repo], base);
  run("git", ["config", "user.name", "ULC Test"], repo);
  run("git", ["config", "user.email", "ulc-test@example.invalid"], repo);
  writeFileSync(join(repo, "app.txt"), "stable\n", "utf8");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  copyFileSync(archiveScript, join(repo, "scripts", "create-project-archive.ps1"));
  mkdirSync(join(repo, "supabase", "functions"), { recursive: true });
  writeFileSync(join(repo, "supabase", "functions", ".env.example"), "EXAMPLE_ONLY=true\n", "utf8");
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "stable"], repo);
  run("git", ["remote", "add", "origin", remote], repo);
  run("git", ["push", "-u", "origin", "main"], repo);
  return { base, remote, repo };
}


test("Git-Archivfilter erlaubt verschachtelte .env.example, blockiert aber echte .env-Dateien", () => {
  const source = readFileSync(archiveScript, "utf8");
  assert.match(source, /\(\^\|\/\)\\\.env\\\.example\$/);
  assert.doesNotMatch(source, /\$Normalized\s+-ne\s+["']\.env\.example["']/);
  assert.ok(source.includes("supabase-local.env"));
});


test("echte verschachtelte .env-Datei bleibt unter Windows im Projektarchiv strikt blockiert", { skip: process.platform !== "win32" }, () => {
  const f = setup();
  try {
    writeFileSync(join(f.repo, "supabase", "functions", ".env"), "REAL_SECRET=do-not-archive\n", "utf8");
    run("git", ["add", "."], f.repo);
    run("git", ["commit", "-m", "unsafe env fixture"], f.repo);
    run("git", ["push", "origin", "main"], f.repo);
    const commit = run("git", ["rev-parse", "HEAD"], f.repo).stdout.trim();
    run("git", ["tag", "-a", "production-unsafe-env-test", commit, "-m", "production"], f.repo);
    run("git", ["push", "origin", "production-unsafe-env-test"], f.repo);

    const archiveOutput = join(f.base, "archive-output-unsafe");
    mkdirSync(archiveOutput, { recursive: true });
    const result = run(
      process.execPath,
      [script, "unsafe-env"],
      f.repo,
      true,
      { ULC_PROJECT_ARCHIVE_OUTPUT_DIRECTORY: archiveOutput },
    );
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Unsafe generated\/environment files/);
    assert.match(`${result.stdout}\n${result.stderr}`, /supabase\/functions\/\.env/);
    assert.equal(run("git", ["branch", "--show-current"], f.repo).stdout.trim(), "main");
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});

test("neuer Entwicklungszyklus wird ohne Produktionsmarkierung blockiert", () => {
  const f = setup();
  try {
    const result = run(process.execPath, [script, "blocked"], f.repo, true);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /production-\*-Markierung/);
    assert.equal(run("git", ["branch", "--show-current"], f.repo).stdout.trim(), "main");
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});

test("bestaetigter sauberer main darf exakt einen neuen Feature-Branch starten", () => {
  const f = setup();
  try {
    const commit = run("git", ["rev-parse", "HEAD"], f.repo).stdout.trim();
    run("git", ["tag", "-a", "production-test", commit, "-m", "production"], f.repo);
    run("git", ["push", "origin", "production-test"], f.repo);

    const archiveOutput = join(f.base, "archive-output");
    mkdirSync(archiveOutput, { recursive: true });
    const result = run(
      process.execPath,
      [script, "release-flow"],
      f.repo,
      true,
      { ULC_PROJECT_ARCHIVE_OUTPUT_DIRECTORY: archiveOutput },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(run("git", ["branch", "--show-current"], f.repo).stdout.trim(), "feature/release-flow");
    assert.equal(run("git", ["rev-parse", "HEAD"], f.repo).stdout.trim(), commit);

    if (process.platform === "win32") {
      const archives = readdirSync(archiveOutput).filter((name) => /^ULC-Linz-App-Aktuell_.*\.zip$/i.test(name));
      assert.equal(archives.length, 1, `Erwartete exakt eine Projekt-ZIP, gefunden: ${archives.join(", ") || "keine"}`);
      assert.equal(existsSync(join(archiveOutput, archives[0])), true);
    }
  } finally {
    rmSync(f.base, { recursive: true, force: true });
  }
});
