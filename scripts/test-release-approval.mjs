import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { REQUIRED_RELEASE_CHECKS, readVerification, writeVerification } from "./release/lib.mjs";

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

function setupRepo({ pushFeature = false } = {}) {
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
  git(["remote", "set-head", "origin", "main"], work);
  git(["switch", "-c", "feature/test"], work);
  if (pushFeature) git(["push", "-u", "origin", "feature/test"], work);
  return { root, remote, work };
}

function runApprove(work, input = "", args = []) {
  return run(process.execPath, [approveScript, ...args], work, { input, allowFailure: true });
}

function verify(work) {
  return writeVerification(work, { checks: [...REQUIRED_RELEASE_CHECKS] });
}

function remoteHead(work) {
  return git(["ls-remote", "--heads", "origin", "refs/heads/feature/test"], work).split(/\s+/)[0] || "";
}

test("Freigabe committed und pusht einen geprueften geaenderten Arbeitsstand", () => {
  const { work } = setupRepo();
  const oldHead = git(["rev-parse", "HEAD"], work);
  writeFileSync(join(work, "app.txt"), "changed\n", "utf8");
  verify(work);

  const result = runApprove(work, "JA\n", ["test: release approval"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /committed, gepusht und remote verifiziert/i);
  assert.notEqual(git(["rev-parse", "HEAD"], work), oldHead);
  assert.equal(git(["status", "--porcelain"], work), "");
  assert.equal(git(["rev-parse", "HEAD"], work), remoteHead(work));
});

test("HEAD darf trotz identischem Remote-Commit bei dirty Worktree niemals als bereits freigegeben gelten", () => {
  const { work } = setupRepo({ pushFeature: true });
  const oldHead = git(["rev-parse", "HEAD"], work);
  assert.equal(remoteHead(work), oldHead);
  writeFileSync(join(work, "app.txt"), "dirty after push\n", "utf8");
  verify(work);

  const result = runApprove(work, "JA\n", ["test: dirty remote-equal"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /nichts mehr zu committen/i);
  assert.notEqual(git(["rev-parse", "HEAD"], work), oldHead);
  assert.equal(git(["status", "--porcelain"], work), "");
  assert.equal(git(["rev-parse", "HEAD"], work), remoteHead(work));
});

test("Freigabe nimmt auch untracked Dateien in den Commit auf", () => {
  const { work } = setupRepo({ pushFeature: true });
  writeFileSync(join(work, "new-file.txt"), "new\n", "utf8");
  verify(work);

  const result = runApprove(work, "JA\n", ["test: untracked"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(git(["status", "--porcelain"], work), "");
  assert.equal(git(["show", "HEAD:new-file.txt"], work), "new");
  assert.equal(git(["rev-parse", "HEAD"], work), remoteHead(work));
});

test("Freigabe committed auch bereits gestagte Aenderungen", () => {
  const { work } = setupRepo({ pushFeature: true });
  writeFileSync(join(work, "app.txt"), "staged\n", "utf8");
  git(["add", "app.txt"], work);
  verify(work);

  const result = runApprove(work, "JA\n", ["test: staged"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(git(["status", "--porcelain"], work), "");
  assert.equal(git(["rev-parse", "HEAD"], work), remoteHead(work));
});

test("Freigabe pusht einen bereits committeden und danach erneut geprueften Stand", () => {
  const { work } = setupRepo();
  writeFileSync(join(work, "app.txt"), "committed\n", "utf8");
  git(["add", "app.txt"], work);
  git(["commit", "-m", "manual commit"], work);
  verify(work);

  const result = runApprove(work, "JA\n");
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /gepruefter commit wurde gepusht und remote verifiziert/i);
  assert.equal(git(["rev-parse", "HEAD"], work), remoteHead(work));
});

test("Freigabe erkennt nur einen sauberen bereits gepushten geprueften Commit als Erfolg", () => {
  const { work } = setupRepo();
  writeFileSync(join(work, "app.txt"), "already pushed\n", "utf8");
  git(["add", "app.txt"], work);
  git(["commit", "-m", "already pushed"], work);
  git(["push", "-u", "origin", "feature/test"], work);
  verify(work);

  const result = runApprove(work);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /arbeitsverzeichnis ist sauber/i);
  assert.match(result.stdout, /bereits auf dem remote-branch vorhanden/i);
  assert.equal(git(["status", "--porcelain"], work), "");
});

test("Nach fehlgeschlagenem Push bleibt der lokale Commit erhalten und fuer einen erneuten Push verifiziert", () => {
  const { work, remote } = setupRepo({ pushFeature: true });
  writeFileSync(join(work, "app.txt"), "push retry\n", "utf8");
  verify(work);

  git(["remote", "set-url", "origin", join(remote, "missing")], work);
  const first = runApprove(work, "JA\n", ["test: push retry"]);
  assert.notEqual(first.status, 0);
  assert.equal(git(["status", "--porcelain"], work), "");
  const committedHead = git(["rev-parse", "HEAD"], work);
  const verification = readVerification(work);
  assert.ok(verification);
  assert.equal(verification.head, committedHead);

  git(["remote", "set-url", "origin", remote], work);
  const second = runApprove(work, "JA\n");
  assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
  assert.equal(remoteHead(work), committedHead);
});
