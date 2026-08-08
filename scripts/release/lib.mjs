import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export const PLAYWRIGHT_VERSION = "1.62.1";
export const RELEASE_VERIFICATION_FORMAT_VERSION = 2;
export const RELEASE_VERIFICATION_PROFILE = "full-release-v2";
export const REQUIRED_RELEASE_CHECKS = Object.freeze([
  "ci:quality",
  "runtime-smoke-isolated",
]);

function displayCommand(command, args) {
  return [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

export function run(command, args = [], options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    capture = false,
    allowFailure = false,
    quiet = false,
  } = options;

  if (!quiet && !capture) console.log(`> ${displayCommand(command, args)}`);

  const isCmd = process.platform === "win32" && /\.cmd$/i.test(command);
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: isCmd,
  });

  if (result.error) {
    throw new Error(`${displayCommand(command, args)} konnte nicht gestartet werden: ${result.error.message}`);
  }

  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? `\n${(result.stderr || result.stdout || "").trim()}` : "";
    throw new Error(`${displayCommand(command, args)} ist mit Code ${result.status} fehlgeschlagen.${detail}`);
  }

  return result;
}

export function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

export function git(args, options = {}) {
  return run("git", args, { ...options, capture: options.capture ?? true });
}

export function gitText(args, options = {}) {
  return git(args, { ...options, capture: true }).stdout.trim();
}

export function repoRoot(start = process.cwd()) {
  const result = run("git", ["rev-parse", "--show-toplevel"], { cwd: start, capture: true });
  return resolve(result.stdout.trim());
}

export function gitDir(root) {
  const value = gitText(["rev-parse", "--git-dir"], { cwd: root });
  return resolve(root, value);
}

export function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

export function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function currentBranch(root) {
  return gitText(["branch", "--show-current"], { cwd: root });
}

export function currentCommit(root) {
  return gitText(["rev-parse", "HEAD"], { cwd: root });
}

export function ensureNoConflicts(root) {
  const conflicts = gitText(["diff", "--name-only", "--diff-filter=U"], { cwd: root });
  if (conflicts) throw new Error(`Es bestehen noch Mergekonflikte:\n${conflicts}`);
}

export function ensureClean(root) {
  const status = gitText(["status", "--porcelain"], { cwd: root });
  if (status) throw new Error(`Das Arbeitsverzeichnis ist nicht sauber:\n${status}`);
}

export function worktreeFingerprint(root) {
  const hash = createHash("sha256");
  hash.update(`HEAD\0${currentCommit(root)}\0`);

  const diff = run("git", ["diff", "--binary", "HEAD", "--"], { cwd: root, capture: true });
  hash.update(diff.stdout || "", "utf8");

  const status = gitText(["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root });
  hash.update(`\0STATUS\0${status}\0`, "utf8");

  const untrackedRaw = run("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    capture: true,
  }).stdout;

  for (const relativePath of untrackedRaw.split("\0").filter(Boolean).sort()) {
    const absolutePath = resolve(root, relativePath);
    hash.update(`\0UNTRACKED\0${relativePath}\0${sha256File(absolutePath)}\0`, "utf8");
  }

  return hash.digest("hex");
}

export function verificationFile(root) {
  return resolve(gitDir(root), "ulc-release", "verification.json");
}

export function writeVerification(root, extra = {}) {
  const filePath = verificationFile(root);
  mkdirSync(dirname(filePath), { recursive: true });
  const record = {
    formatVersion: RELEASE_VERIFICATION_FORMAT_VERSION,
    verificationProfile: RELEASE_VERIFICATION_PROFILE,
    branch: currentBranch(root),
    head: currentCommit(root),
    worktreeFingerprint: worktreeFingerprint(root),
    verifiedAt: new Date().toISOString(),
    ...extra,
  };
  writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export function readVerification(root) {
  const filePath = verificationFile(root);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function clearVerification(root) {
  rmSync(verificationFile(root), { force: true });
}

export function validateVerification(root, verification, options = {}) {
  const { requireCurrentState = true } = options;
  if (!verification || typeof verification !== "object") {
    return { valid: false, reason: "Es existiert kein gueltiger Pruefnachweis." };
  }
  if (verification.formatVersion !== RELEASE_VERIFICATION_FORMAT_VERSION) {
    return { valid: false, reason: "Der Pruefnachweis verwendet eine alte Formatversion." };
  }
  if (verification.verificationProfile !== RELEASE_VERIFICATION_PROFILE) {
    return { valid: false, reason: "Der Pruefnachweis stammt nicht aus dem aktuellen vollstaendigen Releaseprofil." };
  }
  const checks = Array.isArray(verification.checks) ? verification.checks : [];
  const missingChecks = REQUIRED_RELEASE_CHECKS.filter((check) => !checks.includes(check));
  if (missingChecks.length > 0) {
    return { valid: false, reason: `Im Pruefnachweis fehlen verbindliche Checks: ${missingChecks.join(", ")}.` };
  }
  if (!requireCurrentState) return { valid: true, reason: "" };

  const branch = currentBranch(root);
  if (verification.branch !== branch) {
    return { valid: false, reason: `Branch hat sich geaendert (${verification.branch} -> ${branch || "detached HEAD"}).` };
  }
  const head = currentCommit(root);
  if (verification.head !== head) {
    return { valid: false, reason: "HEAD-Commit hat sich seit der Pruefung geaendert." };
  }
  const fingerprint = worktreeFingerprint(root);
  if (verification.worktreeFingerprint !== fingerprint) {
    return { valid: false, reason: "Der Arbeitsstand hat sich seit der Pruefung geaendert." };
  }
  return { valid: true, reason: "" };
}

export async function prompt(question) {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export function sanitizeBranchPart(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function utcStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
