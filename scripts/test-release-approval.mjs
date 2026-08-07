import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeVerification } from "./release/lib.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const approveScript = resolve(projectRoot, "scripts", "release", "approve-change.mjs");

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input: options.input,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "ULC Test",
      GIT_AUTHOR_EMAIL: "ulc-test@example.invalid",
      GIT_COMMITTER_NAME: "ULC Test",
      GIT_COMMITTER_EMAIL: "ulc-test@example.invalid",
    },
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} fehlgeschlagen\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function git(args, cwd) {
  return run("git", args, cwd).stdout.trim();
}

function setupRepo() {
  const root = mkdtempSync(join(tmpdir(), "ulc-release-approval-"));
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  mkdirSync(work);
  run("git", ["init", "--bare", remote], root);
  run("git", ["init", "-b", "main"], work);
  git(["config", "user.name", "ULC Test"], work);
  git(["config", "user.email", "ulc-test@example.invalid"], work);
  writeFileSync(join(work, "app.txt"), "stable\n", "utf8");
  git(["add", "app.txt"], work);
  git(["commit", "-m", "stable"], work);
  git(["remote", "add", "origin", remote], work);
  git(["push", "-u", "origin", "main"], work);
  git(["switch", "-c", "feature/test"], work);
  return { root, remote, work };
}

function runApprove(work, input = "", args = []) {
  return run(process.execPath, [approveScript, ...args], work, { input, allowFailure: true });
}

test("Freigabe committed und pusht einen geprueften schmutzigen Arbeitsstand", () => {
  const { work } = setupRepo();
  writeFileSync(join(work, "app.txt"), "changed\n", "utf8");
  writeVerification(work, { checks: ["test"] });

  const result = runApprove(work, "JA\n", ["test: release approval"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /committed und gepusht/i);
  assert.equal(git(["status", "--porcelain"], work), "");
  assert.equal(git(["rev-parse", "HEAD"], work), git(["rev-parse", "origin/feature/test"], work));
});

test("Freigabe pusht einen bereits committeden und danach erneut geprueften Stand", () => {
  const { work } = setupRepo();
  writeFileSync(join(work, "app.txt"), "committed\n", "utf8");
  git(["add", "app.txt"], work);
  git(["commit", "-m", "manual commit"], work);
  writeVerification(work, { checks: ["test"] });

  const result = runApprove(work, "JA\n");
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /gepruefter commit wurde gepusht/i);
  assert.equal(git(["rev-parse", "HEAD"], work), git(["rev-parse", "origin/feature/test"], work));
});

test("Freigabe erkennt einen bereits gepushten geprueften Commit als Erfolg", () => {
  const { work } = setupRepo();
  writeFileSync(join(work, "app.txt"), "already pushed\n", "utf8");
  git(["add", "app.txt"], work);
  git(["commit", "-m", "already pushed"], work);
  git(["push", "-u", "origin", "feature/test"], work);
  writeVerification(work, { checks: ["test"] });

  const result = runApprove(work);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /bereits auf dem remote-branch vorhanden/i);
  assert.equal(git(["status", "--porcelain"], work), "");
});
