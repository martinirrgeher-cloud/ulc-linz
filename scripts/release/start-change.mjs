import { resolve } from "node:path";
import {
  clearVerification,
  currentBranch,
  currentCommit,
  ensureClean,
  gitText,
  prompt,
  repoRoot,
  run,
  sanitizeBranchPart,
} from "./lib.mjs";

const root = repoRoot();
let createdBranch = null;

function remoteProductionTagsPointingAt(commit) {
  const result = run("git", ["ls-remote", "--tags", "origin", "refs/tags/production-*"], {
    cwd: root,
    capture: true,
    allowFailure: true,
  });
  if (result.status !== 0) throw new Error("Produktions-Tags auf origin konnten nicht gelesen werden.");

  const direct = new Map();
  const peeled = new Map();
  for (const line of (result.stdout || "").split(/\r?\n/).filter(Boolean)) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (!sha || !ref) continue;
    if (ref.endsWith("^{}")) peeled.set(ref.slice(0, -3), sha);
    else direct.set(ref, sha);
  }

  const matches = [];
  for (const [ref, sha] of direct.entries()) {
    const target = peeled.get(ref) || sha;
    if (target === commit) matches.push(ref.replace("refs/tags/", ""));
  }
  return matches.sort();
}

function remoteBranchExists(branch) {
  const result = run("git", ["ls-remote", "--heads", "origin", `refs/heads/${branch}`], {
    cwd: root,
    capture: true,
    allowFailure: true,
  });
  if (result.status !== 0) throw new Error(`Remote-Branch ${branch} konnte nicht geprueft werden.`);
  return Boolean((result.stdout || "").trim());
}

try {
  ensureClean(root);

  const branchBefore = currentBranch(root);
  if (branchBefore !== "main") {
    throw new Error(
      `Eine neue Aenderung darf nur vom abgeschlossenen lokalen main gestartet werden.\nAktueller Branch: ${branchBefore || "detached HEAD"}\n` +
      "Bitte zuerst den vorherigen Zyklus mit ULC-PRODUKTION-MARKIEREN.cmd abschliessen.",
    );
  }

  console.log("Aktualisiere origin/main und Produktions-Tags...");
  run("git", ["fetch", "origin", "main", "--tags", "--prune"], { cwd: root });

  const localMain = currentCommit(root);
  const remoteMain = gitText(["rev-parse", "origin/main"], { cwd: root });
  if (localMain !== remoteMain) {
    throw new Error(
      `Lokaler main und origin/main sind nicht identisch.\nLokal:  ${localMain}\nRemote: ${remoteMain}\n` +
      "ULC-AENDERUNG-STARTEN nimmt keine automatische Korrektur vor. Bitte zuerst den Produktionszyklus sauber abschliessen.",
    );
  }

  const productionTags = remoteProductionTagsPointingAt(remoteMain);
  if (productionTags.length === 0) {
    throw new Error(
      `Der aktuelle main ${remoteMain.slice(0, 12)} besitzt auf origin keine production-*-Markierung.\n` +
      "Neue Entwicklung ist erst nach ULC-PRODUKTION-MARKIEREN.cmd erlaubt.",
    );
  }
  console.log(`Bestaetigter Produktionsstand: ${productionTags.at(-1)}`);

  let name = process.argv.slice(2).join(" ").trim();
  if (!name) name = await prompt("Kurzer Name der Aenderung (z.B. trainingsplanung-filter): ");
  const slug = sanitizeBranchPart(name);
  if (!slug) throw new Error("Kein gueltiger Aenderungsname angegeben.");

  const branch = `feature/${slug}`;
  const existing = run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
    cwd: root,
    capture: true,
    allowFailure: true,
  });
  if (existing.status === 0) throw new Error(`Branch ${branch} existiert lokal bereits.`);
  if (remoteBranchExists(branch)) throw new Error(`Branch origin/${branch} existiert bereits. Bitte einen neuen eindeutigen Aenderungsnamen verwenden.`);

  run("git", ["switch", "-c", branch, "origin/main"], { cwd: root });
  createdBranch = branch;
  clearVerification(root);

  console.log("\nERFOLG: Neuer sauberer Feature-Branch erstellt.");
  console.log(`Branch: ${currentBranch(root)}`);
  console.log(`Basis:  ${currentCommit(root)}`);

  if (process.platform === "win32") {
    console.log("\nErzeuge automatisch eine Git-basierte Projekt-ZIP auf dem Desktop...");
    const archiveArgs = [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve(root, "scripts/create-project-archive.ps1"),
      "-ProjectRoot",
      root,
    ];
    const archiveOutputDirectory = process.env.ULC_PROJECT_ARCHIVE_OUTPUT_DIRECTORY?.trim();
    if (archiveOutputDirectory) {
      archiveArgs.push("-OutputDirectory", resolve(archiveOutputDirectory));
    }
    run("powershell.exe", archiveArgs, { cwd: root });
  } else {
    console.log("\nHinweis: Die automatische Projekt-ZIP wird nur unter Windows erzeugt.");
  }
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  if (createdBranch) {
    try {
      console.error("Start des Entwicklungszyklus wird zurueckgerollt...");
      run("git", ["switch", "main"], { cwd: root, quiet: true });
      run("git", ["branch", "-D", createdBranch], { cwd: root, quiet: true });
      clearVerification(root);
      console.error("Lokaler Stand ist wieder sauber auf main.");
    } catch (rollbackError) {
      console.error(`WARNUNG: Rueckkehr zu main ist fehlgeschlagen: ${rollbackError.message}`);
    }
  }
  process.exitCode = 1;
}
