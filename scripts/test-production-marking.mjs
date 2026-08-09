import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const markProductionScript = resolve("scripts/release/mark-production.mjs");

function run(command, args, cwd, allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "ULC Test",
      GIT_AUTHOR_EMAIL: "ulc-test@example.invalid",
      GIT_COMMITTER_NAME: "ULC Test",
      GIT_COMMITTER_EMAIL: "ulc-test@example.invalid",
    },
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function setup() {
  const base = mkdtempSync(join(tmpdir(), "ulc-production-marking-"));
  const remote = join(base, "origin.git");
  const repo = join(base, "repo");
  run("git", ["init", "--bare", remote], base);
  run("git", ["init", "-b", "main", repo], base);
  run("git", ["config", "user.name", "ULC Test"], repo);
  run("git", ["config", "user.email", "ulc-test@example.invalid"], repo);
  writeFileSync(join(repo, "app.txt"), "old\n", "utf8");
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "old"], repo);
  const previousCommit = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
  writeFileSync(join(repo, "app.txt"), "stable\n", "utf8");
  run("git", ["add", "."], repo);
  run("git", ["commit", "-m", "stable"], repo);
  run("git", ["remote", "add", "origin", remote], repo);
  run("git", ["push", "-u", "origin", "main"], repo);
  const commit = run("git", ["rev-parse", "HEAD"], repo).stdout.trim();
  return { base, remote, repo, commit, previousCommit };
}

test("Produktionsmarkierung blockiert einen Commit ohne verifizierte Produktionsdatenbank", () => {
  const fixture = setup();
  try {
    const result = run(process.execPath, [markProductionScript, fixture.commit], fixture.repo, true);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Produktionsdatenbank ist fuer diesen Commit noch nicht verifiziert/);
    assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(`database-verified-${fixture.commit}`));
    const productionTags = run("git", ["tag", "--list", "production-*"], fixture.repo).stdout.trim();
    assert.equal(productionTags, "");
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});


test("Produktionsmarkierung lehnt einen DB-Verifikations-Tag auf einem anderen Commit ab", () => {
  const fixture = setup();
  try {
    const dbTag = `database-verified-${fixture.commit}`;
    run("git", ["tag", dbTag, fixture.previousCommit], fixture.repo);
    run("git", ["push", "origin", `refs/tags/${dbTag}`], fixture.repo);

    const result = run(process.execPath, [markProductionScript, fixture.commit], fixture.repo, true);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /Datenbank-Verifikationsnachweis zeigt auf einen unerwarteten Commit/);
    const productionTags = run("git", ["tag", "--list", "production-*"], fixture.repo).stdout.trim();
    assert.equal(productionTags, "");
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("Produktionsmarkierung akzeptiert nur den exakten DB-Verifikations-Tag von origin/main", () => {
  const fixture = setup();
  try {
    const dbTag = `database-verified-${fixture.commit}`;
    run("git", ["tag", dbTag, fixture.commit], fixture.repo);
    run("git", ["push", "origin", `refs/tags/${dbTag}`], fixture.repo);

    const result = run(process.execPath, [markProductionScript, fixture.commit], fixture.repo);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /ERFOLG: Produktionsstand markiert:/);

    const remoteProductionTags = run("git", ["ls-remote", "--tags", "origin", "refs/tags/production-*"], fixture.repo).stdout.trim();
    assert.notEqual(remoteProductionTags, "");
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});
