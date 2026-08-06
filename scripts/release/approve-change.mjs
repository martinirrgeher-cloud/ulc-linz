import {
  clearVerification,
  currentBranch,
  currentCommit,
  ensureNoConflicts,
  gitText,
  prompt,
  readVerification,
  repoRoot,
  run,
  worktreeFingerprint,
} from "./lib.mjs";

const root = repoRoot();

try {
  ensureNoConflicts(root);
  const branch = currentBranch(root);
  if (!branch || ["main", "master"].includes(branch)) {
    throw new Error(`Freigabe direkt auf '${branch || "detached HEAD"}' ist gesperrt. Verwende einen Feature- oder Recovery-Branch.`);
  }

  const status = gitText(["status", "--porcelain"], { cwd: root });
  if (!status) throw new Error("Es gibt keine Aenderungen zur Freigabe.");

  const verification = readVerification(root);
  if (!verification) {
    throw new Error("Keine gueltige Release-Pruefung gefunden. Bitte zuerst ULC-PRUEFEN.cmd ausfuehren.");
  }

  const fingerprint = worktreeFingerprint(root);
  if (
    verification.branch !== branch ||
    verification.head !== currentCommit(root) ||
    verification.worktreeFingerprint !== fingerprint
  ) {
    throw new Error(
      "Der Arbeitsstand wurde seit der letzten erfolgreichen Pruefung veraendert. Bitte ULC-PRUEFEN.cmd erneut ausfuehren.",
    );
  }

  console.log("=== Gepruefte Aenderungen ===");
  run("git", ["status", "--short"], { cwd: root });
  console.log("");
  run("git", ["diff", "--stat", "HEAD"], { cwd: root });

  let message = process.argv.slice(2).join(" ").trim();
  if (!message) message = await prompt("\nCommit-Nachricht: ");
  if (!message) throw new Error("Commit-Nachricht darf nicht leer sein.");

  const confirmation = (await prompt("Mit exakt diesem geprueften Stand committen und pushen? Tippe JA: ")).toUpperCase();
  if (confirmation !== "JA") {
    console.log("Freigabe ohne Aenderung abgebrochen.");
    process.exit(0);
  }

  run("git", ["add", "-A"], { cwd: root });
  run("git", ["commit", "-m", message], { cwd: root });
  run("git", ["push", "-u", "origin", branch], { cwd: root });
  clearVerification(root);

  console.log("\nERFOLG: Gepruefter Stand wurde committed und gepusht.");
  console.log("Naechster Schritt: Pull Request auf GitHub pruefen. Merge bleibt bewusst manuell.");
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  process.exitCode = 1;
}
