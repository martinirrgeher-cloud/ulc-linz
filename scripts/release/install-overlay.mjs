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
  gitText,
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

const packageDirArg = arg("--package-dir");
if (!packageDirArg) {
  console.error("FEHLER: --package-dir fehlt.");
  process.exit(1);
}

const root = repoRoot(arg("--project") || process.cwd());
const packageDir = resolve(packageDirArg);
const manifestPath = resolve(packageDir, "manifest.json");
let createdBranch = null;
let originalBranch = null;
let baseCommit = null;
let manifest = null;

try {
  if (!existsSync(manifestPath)) throw new Error("manifest.json fehlt im entpackten Overlay-Paket.");
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.formatVersion !== 1) throw new Error("Nicht unterstuetztes Overlay-Format.");
  if (!["module", "release"].includes(manifest.packageType)) throw new Error("packageType muss module oder release sein.");
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error("Manifest enthaelt keine Dateien.");

  manifest.files = manifest.files.map((entry) => ({ ...entry, path: normalizeRelative(entry.path) }));
  if (new Set(manifest.files.map((entry) => entry.path)).size !== manifest.files.length) {
    throw new Error("Eine Datei ist mehrfach im Manifest enthalten.");
  }

  for (const entry of manifest.files) {
    if (!["create", "replace", "delete"].includes(entry.mode)) throw new Error(`Ungueltiger Modus: ${entry.path}`);
    if (!["raw", "text-lf"].includes(entry.hashMode || "raw")) throw new Error(`Ungueltiger hashMode: ${entry.path}`);
    entry.hashMode = entry.hashMode || "raw";
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

  const currentStates = manifest.files.map((entry) => fileState(root, packageDir, entry));
  const allNew = currentStates.every((state) => state.newMatches);
  if (allNew) {
    const changedPaths = gitText(["status", "--porcelain"], { cwd: root });
    console.log("Overlay ist auf diesem Arbeitsstand bereits vollstaendig vorhanden.");
    if (changedPaths) console.log(changedPaths);
    process.exit(0);
  }

  ensureClean(root);
  originalBranch = currentBranch(root);
  if (!originalBranch) throw new Error("Detached HEAD wird fuer Overlay-Installationen nicht unterstuetzt.");

  run("git", ["fetch", "origin", "main", "--prune"], { cwd: root });
  baseCommit = gitText(["rev-parse", `${manifest.baseCommit}^{commit}`], { cwd: root });
  const remoteMain = gitText(["rev-parse", "origin/main"], { cwd: root });
  if (remoteMain !== baseCommit) {
    throw new Error(
      `Paketbasis ist nicht der aktuelle origin/main.\nPaket: ${baseCommit}\norigin/main: ${remoteMain}\n` +
      "Paket nicht anwenden; zuerst einen neuen Paketstand auf Basis des aktuellen stabilen main erstellen.",
    );
  }

  const branchSlug = sanitizeBranchPart(manifest.packageId || "overlay");
  const branch = `feature/${branchSlug}-${utcStamp().slice(0, 13).toLowerCase()}`;
  run("git", ["branch", `backup/${branchSlug}-before-${utcStamp().slice(0, 13).toLowerCase()}`, baseCommit], { cwd: root });
  run("git", ["switch", "-c", branch, baseCommit], { cwd: root });
  createdBranch = branch;

  const states = manifest.files.map((entry) => fileState(root, packageDir, entry));
  if (!states.every((state) => state.oldMatches)) {
    const bad = manifest.files.filter((_, index) => !states[index].oldMatches).map((entry) => entry.path);
    throw new Error(`Ausgangsdateien stimmen nicht mit dem Paket ueberein:\n${bad.join("\n")}`);
  }

  for (let index = 0; index < manifest.files.length; index += 1) {
    const entry = manifest.files[index];
    const { target, payload } = states[index];
    if (entry.mode === "delete") {
      rmSync(target, { force: true });
    } else {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(payload, target);
    }
  }

  const finalStates = manifest.files.map((entry) => fileState(root, packageDir, entry));
  if (!finalStates.every((state) => state.newMatches)) throw new Error("Nach dem Kopieren stimmt mindestens ein Dateihash nicht.");

  console.log("\nOverlay vollstaendig kopiert. Starte verbindliche Release-Pruefung...");
  run(process.execPath, [resolve(root, "scripts/release/run-release-check.mjs")], { cwd: root });

  console.log("\nERFOLG: Overlay installiert und geprueft.");
  console.log(`Branch: ${createdBranch}`);
  console.log("Noch wurde NICHT committed oder gepusht. Bitte die Funktion kurz pruefen und danach ULC-FREIGEBEN.cmd starten.");
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  if (createdBranch && baseCommit) {
    try {
      console.error("Setze die unvollstaendige Installation vollstaendig zurueck...");
      run("git", ["reset", "--hard", baseCommit], { cwd: root, quiet: true });
      if (manifest?.files) {
        for (const entry of manifest.files) {
          if (entry.mode === "create") rmSync(inside(root, entry.path), { force: true });
        }
      }
      if (originalBranch) run("git", ["switch", originalBranch], { cwd: root, quiet: true });
      run("git", ["branch", "-D", createdBranch], { cwd: root, quiet: true, allowFailure: true });
    } catch (rollbackError) {
      console.error(`WARNUNG: Automatisches Zurueckrollen ist fehlgeschlagen: ${rollbackError.message}`);
    }
  }
  process.exitCode = 1;
}
