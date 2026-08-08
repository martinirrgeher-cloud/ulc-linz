import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import {
  currentBranch,
  ensureClean,
  ensureNoConflicts,
  gitText,
  npmCommand,
  repoRoot,
  run,
  sanitizeBranchPart,
  sha256File,
  utcStamp,
} from "./lib.mjs";

const PROTECTED_PREFIXES = [
  ".github/",
  "src/app/",
  "src/components/layout/",
  "src/features/auth/",
  "src/lib/supabase",
  "src/styles/global.css",
  "src/styles/mobile.css",
  "src/styles/mobile-foundation.css",
  "supabase/",
  "scripts/release/",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "playwright.config.mjs",
  "playwright.runtime.config.mjs",
  "vercel.json",
];

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const checkOnly = process.argv.includes("--check-only");

function normalizeRelative(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0")) {
    throw new Error(`Ungueltiger Dateipfad im Manifest: ${value}`);
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsicherer Dateipfad im Manifest: ${value}`);
  }
  return parts.join("/");
}

function inside(root, relativePath) {
  const target = resolve(root, relativePath);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(prefix)) throw new Error(`Pfad verlaesst den Projektordner: ${relativePath}`);
  return target;
}

function isProtected(relativePath) {
  return PROTECTED_PREFIXES.some((prefix) => relativePath === prefix.replace(/\/$/, "") || relativePath.startsWith(prefix));
}

function uniqueLocalBranch(root, prefix) {
  let candidate = prefix;
  let suffix = 2;
  while (
    run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${candidate}`], {
      cwd: root,
      capture: true,
      allowFailure: true,
      quiet: true,
    }).status === 0
  ) {
    candidate = `${prefix}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function hashForEntry(filePath, entry) {
  if (entry.hashMode === "text-lf") {
    const normalized = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  }
  return sha256File(filePath);
}

function fileState(root, packageDir, entry) {
  const target = inside(root, entry.path);
  const payload = entry.mode === "delete" ? null : inside(resolve(packageDir, "payload"), entry.path);
  const exists = existsSync(target);
  const oldMatches = entry.mode === "create"
    ? !exists
    : exists && hashForEntry(target, entry) === entry.oldSha256;
  const newMatches = entry.mode === "delete"
    ? !exists
    : exists && hashForEntry(target, entry) === entry.newSha256;
  return { target, payload, oldMatches, newMatches };
}

function remoteBranchCommit(root, branch) {
  const result = run("git", ["ls-remote", "--heads", "origin", `refs/heads/${branch}`], {
    cwd: root,
    capture: true,
    allowFailure: true,
    quiet: true,
  });
  if (result.status !== 0) throw new Error(`Remote-Branch origin/${branch} konnte nicht gelesen werden.`);
  const line = (result.stdout || "").trim();
  return line ? line.split(/\s+/)[0] : "";
}

function normalizeManifest(raw) {
  if (![1, 2].includes(raw?.formatVersion)) throw new Error("Nicht unterstuetztes Overlay-Format.");
  if (!["module", "release"].includes(raw.packageType)) throw new Error("packageType muss module oder release sein.");
  if (!Array.isArray(raw.files) || raw.files.length === 0) throw new Error("Manifest enthaelt keine Dateien.");

  let target;
  if (raw.formatVersion === 1) {
    if (!raw.baseCommit) throw new Error("baseCommit fehlt im Manifest v1.");
    target = { mode: "fresh-feature", baseCommit: raw.baseCommit, legacy: true };
  } else {
    if (!raw.target || typeof raw.target !== "object") throw new Error("target fehlt im Manifest v2.");
    if (!["fresh-feature", "existing-pr"].includes(raw.target.mode)) {
      throw new Error("target.mode muss fresh-feature oder existing-pr sein.");
    }
    target = { ...raw.target };
    if (target.mode === "fresh-feature") {
      if (!/^[a-f0-9]{40}$/i.test(target.baseCommit || "")) {
        throw new Error("Manifest v2 fresh-feature benoetigt einen vollstaendigen 40-stelligen baseCommit.");
      }
    } else {
      if (!/^feature\//.test(target.expectedBranch || "")) throw new Error("existing-pr benoetigt expectedBranch unter feature/.");
      if (!/^[a-f0-9]{40}$/i.test(target.expectedHead || "")) {
        throw new Error("existing-pr benoetigt einen vollstaendigen 40-stelligen expectedHead.");
      }
      if (target.expectedMain && !/^[a-f0-9]{40}$/i.test(target.expectedMain)) {
        throw new Error("expectedMain muss, falls gesetzt, ein vollstaendiger 40-stelliger Commit sein.");
      }
    }
  }

  const files = raw.files.map((entry) => ({ ...entry, path: normalizeRelative(entry.path), hashMode: entry.hashMode || "raw" }));
  if (new Set(files.map((entry) => entry.path)).size !== files.length) throw new Error("Eine Datei ist mehrfach im Manifest enthalten.");

  return { ...raw, target, files };
}

function changedPaths(root) {
  const output = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root, capture: true }).stdout || "";
  if (!output.trim()) return [];
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const value = line.slice(3).trim();
    const renamed = value.includes(" -> ") ? value.split(" -> ").at(-1) : value;
    return renamed.replace(/^"|"$/g, "");
  });
}

function assertNoUnrelatedChanges(root, manifest) {
  const allowed = new Set(manifest.files.map((entry) => entry.path));
  const unrelated = changedPaths(root).filter((path) => !allowed.has(path.replace(/\\/g, "/")));
  if (unrelated.length > 0) {
    throw new Error(`Neben dem bereits installierten Paket existieren weitere lokale Aenderungen:\n${unrelated.join("\n")}`);
  }
}

function resolveTargetState(root, manifest) {
  ensureNoConflicts(root);
  const branch = currentBranch(root);
  if (!branch) throw new Error("Detached HEAD wird fuer Overlay-Installationen nicht unterstuetzt.");
  if (!branch.startsWith("feature/")) {
    throw new Error(`Overlay-Pakete werden nur auf einem Feature-Branch installiert.\nAktueller Branch: ${branch}`);
  }

  if (manifest.target.mode === "fresh-feature") {
    run("git", ["fetch", "origin", "main", "--prune"], { cwd: root, quiet: checkOnly });
    const baseCommit = gitText(["rev-parse", `${manifest.target.baseCommit}^{commit}`], { cwd: root });
    const remoteMain = gitText(["rev-parse", "origin/main"], { cwd: root });
    if (remoteMain !== baseCommit) {
      throw new Error(
        `Paketbasis ist nicht der aktuelle origin/main.\nPaket: ${baseCommit}\norigin/main: ${remoteMain}\n` +
        "Paket nicht anwenden; Produktionszyklus abschliessen und eine neue Aenderung starten.",
      );
    }
    const currentHead = gitText(["rev-parse", "HEAD"], { cwd: root });
    if (currentHead !== baseCommit) {
      throw new Error(
        `Der vorbereitete Feature-Branch steht nicht exakt auf der Paketbasis.\nBranch: ${branch}\nHEAD: ${currentHead}\nPaketbasis: ${baseCommit}`,
      );
    }
    const remoteFeature = remoteBranchCommit(root, branch);
    if (remoteFeature) {
      throw new Error(
        `Der Fresh-Feature-Branch existiert bereits auf origin (${remoteFeature.slice(0, 12)}). ` +
        "Fuer eine Korrektur eines offenen PR ist target.mode=existing-pr erforderlich.",
      );
    }
    return { branch, rollbackCommit: baseCommit, expectedHead: baseCommit };
  }

  const expectedBranch = manifest.target.expectedBranch;
  if (branch !== expectedBranch) {
    throw new Error(`PR-Korrektur ist nur fuer ${expectedBranch} gueltig. Aktuell: ${branch}`);
  }
  const expectedHead = gitText(["rev-parse", `${manifest.target.expectedHead}^{commit}`], { cwd: root });
  const currentHead = gitText(["rev-parse", "HEAD"], { cwd: root });
  if (currentHead !== expectedHead) {
    throw new Error(`PR-Korrektur erwartet HEAD ${expectedHead}, aktuell ist ${currentHead}.`);
  }
  const remoteHead = remoteBranchCommit(root, branch);
  if (!remoteHead) throw new Error(`Remote-Branch origin/${branch} wurde nicht gefunden.`);
  if (remoteHead !== expectedHead) {
    throw new Error(`PR-Korrektur erwartet remote ${expectedHead}, origin/${branch} steht auf ${remoteHead}.`);
  }
  if (manifest.target.expectedMain) {
    run("git", ["fetch", "origin", "main", "--prune"], { cwd: root, quiet: checkOnly });
    const remoteMain = gitText(["rev-parse", "origin/main"], { cwd: root });
    if (remoteMain !== manifest.target.expectedMain) {
      throw new Error(`PR-Korrektur erwartet origin/main ${manifest.target.expectedMain}, aktuell ist ${remoteMain}.`);
    }
  }
  return { branch, rollbackCommit: expectedHead, expectedHead };
}

const packageDirArg = arg("--package-dir");
if (!packageDirArg) {
  console.error("FEHLER: --package-dir fehlt.");
  process.exit(1);
}

const root = repoRoot(arg("--project") || process.cwd());
const packageDir = resolve(packageDirArg);
const manifestPath = resolve(packageDir, "manifest.json");
let targetBranch = null;
let rollbackCommit = null;
let manifest = null;
let installationStarted = false;

try {
  if (!existsSync(manifestPath)) throw new Error("manifest.json fehlt im entpackten Overlay-Paket.");
  manifest = normalizeManifest(JSON.parse(readFileSync(manifestPath, "utf8")));

  for (const entry of manifest.files) {
    if (!["create", "replace", "delete"].includes(entry.mode)) throw new Error(`Ungueltiger Modus: ${entry.path}`);
    if (!["raw", "text-lf"].includes(entry.hashMode)) throw new Error(`Ungueltiger hashMode: ${entry.path}`);
    if (manifest.packageType === "module" && isProtected(entry.path)) {
      throw new Error(`Modulpaket darf geschuetzte Infrastruktur nicht veraendern: ${entry.path}`);
    }
    if (entry.mode !== "create" && !/^[a-f0-9]{64}$/.test(entry.oldSha256 || "")) {
      throw new Error(`oldSha256 fehlt oder ist ungueltig: ${entry.path}`);
    }
    if (entry.mode !== "delete" && !/^[a-f0-9]{64}$/.test(entry.newSha256 || "")) {
      throw new Error(`newSha256 fehlt oder ist ungueltig: ${entry.path}`);
    }
    if (entry.mode !== "delete") {
      const payload = inside(resolve(packageDir, "payload"), entry.path);
      if (!existsSync(payload)) throw new Error(`Payload fehlt: ${entry.path}`);
      if (hashForEntry(payload, entry) !== entry.newSha256) throw new Error(`Payload-Hash stimmt nicht: ${entry.path}`);
    }
  }

  const target = resolveTargetState(root, manifest);
  targetBranch = target.branch;
  rollbackCommit = target.rollbackCommit;

  const currentStates = manifest.files.map((entry) => fileState(root, packageDir, entry));
  const allNew = currentStates.every((state) => state.newMatches);
  if (allNew) {
    assertNoUnrelatedChanges(root, manifest);
    console.log("Overlay ist auf diesem exakt erwarteten Arbeitsstand bereits vollstaendig vorhanden.");
    if (checkOnly) console.log("APPLICABLE");
    process.exit(0);
  }

  ensureClean(root);
  if (!currentStates.every((state) => state.oldMatches)) {
    const bad = manifest.files.filter((_, index) => !currentStates[index].oldMatches).map((entry) => entry.path);
    throw new Error(`Ausgangsdateien stimmen nicht mit dem Paket ueberein:\n${bad.join("\n")}`);
  }

  if (checkOnly) {
    console.log("APPLICABLE");
    process.exit(0);
  }

  const branchSlug = sanitizeBranchPart(manifest.packageId || "overlay");
  const branchStamp = utcStamp().replace(/Z$/, "").toLowerCase();
  const backupBranch = uniqueLocalBranch(root, `backup/${branchSlug}-before-${branchStamp}`);
  run("git", ["branch", backupBranch, rollbackCommit], { cwd: root });
  console.log(`Verwende Feature-Branch: ${targetBranch}`);
  console.log(`Paketmodus: ${manifest.target.mode}`);
  console.log(`Sicherheitsbranch: ${backupBranch}`);

  installationStarted = true;
  for (let index = 0; index < manifest.files.length; index += 1) {
    const entry = manifest.files[index];
    const { target: fileTarget, payload } = currentStates[index];
    if (entry.mode === "delete") {
      rmSync(fileTarget, { force: true });
    } else {
      mkdirSync(dirname(fileTarget), { recursive: true });
      copyFileSync(payload, fileTarget);
    }
  }

  const finalStates = manifest.files.map((entry) => fileState(root, packageDir, entry));
  if (!finalStates.every((state) => state.newMatches)) throw new Error("Nach dem Kopieren stimmt mindestens ein Dateihash nicht.");

  if (manifest.files.some((entry) => entry.path === "package.json" || entry.path === "package-lock.json")) {
    console.log("\nAbhaengigkeitsdefinition wurde geaendert. Synchronisiere node_modules reproduzierbar mit npm ci...");
    run(npmCommand(), ["ci"], { cwd: root });
  }

  console.log("\nOverlay vollstaendig kopiert. Starte verbindliche Release-Pruefung...");
  run(process.execPath, [resolve(root, "scripts/release/run-release-check.mjs")], { cwd: root });

  console.log("\nERFOLG: Overlay installiert und geprueft.");
  console.log(`Branch: ${targetBranch}`);
  console.log("Noch wurde NICHT committed oder gepusht.");
  console.log("Bitte ULC-LOKAL-ANSEHEN.cmd starten, danach ULC-PRUEFEN.cmd und ULC-FREIGEBEN.cmd.");
  console.log("ULC-PRUEFEN.cmd verwendet die soeben bestandene Vollpruefung wieder, solange keine Datei geaendert wurde.");
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  if (installationStarted && targetBranch && rollbackCommit && manifest?.files) {
    try {
      console.error("Setze die unvollstaendige Installation transaktional zurueck...");
      const trackedPaths = manifest.files.filter((entry) => entry.mode !== "create").map((entry) => entry.path);
      if (trackedPaths.length > 0) {
        run("git", ["restore", "--source", rollbackCommit, "--staged", "--worktree", "--", ...trackedPaths], {
          cwd: root,
          quiet: true,
        });
      }
      for (const entry of manifest.files) {
        if (entry.mode === "create") rmSync(inside(root, entry.path), { force: true });
      }
      ensureClean(root);
      console.error(`Feature-Branch wurde sauber auf den Ausgangscommit zurueckgestellt: ${targetBranch}`);
    } catch (rollbackError) {
      console.error(`WARNUNG: Automatisches Zurueckrollen ist fehlgeschlagen: ${rollbackError.message}`);
    }
  }
  process.exitCode = 1;
}
