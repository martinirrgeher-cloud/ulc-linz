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
  writeVerification,
} from "./lib.mjs";

const root = repoRoot();

function statusText() {
  return gitText(["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root });
}

function remoteCommit(branch) {
  const result = run(
    "git",
    ["ls-remote", "--heads", "origin", `refs/heads/${branch}`],
    { cwd: root, capture: true, allowFailure: true },
  );
  if (result.status !== 0) return null;
  const line = (result.stdout || "").trim();
  return line ? line.split(/\s+/)[0] : "";
}

function defaultBaseBranch() {
  const symbolic = gitText(
    ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
    { cwd: root, allowFailure: true },
  );
  return symbolic.startsWith("origin/") ? symbolic.slice("origin/".length) : "main";
}

function pullRequestUrl(branch) {
  const remote = gitText(["remote", "get-url", "origin"], { cwd: root, allowFailure: true });
  if (!remote) return "";

  const httpsMatch = remote.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  const sshMatch = remote.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  const match = httpsMatch || sshMatch;
  if (!match) return "";

  const owner = match[1];
  const repo = match[2];
  const base = defaultBaseBranch();
  return `https://github.com/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch)}?expand=1`;
}

function assertVerifiedState(branch) {
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

  return verification;
}

function assertCleanAfterCommit() {
  const status = statusText();
  if (status) {
    throw new Error(
      `Nach dem Commit sind weiterhin lokale Aenderungen vorhanden. Freigabe wird NICHT als erfolgreich gemeldet:\n${status}`,
    );
  }
}

function assertRemoteMatches(branch, expectedCommit) {
  const remoteHead = remoteCommit(branch);
  if (remoteHead === null) {
    throw new Error("Remote-Branch konnte nach dem Push nicht verifiziert werden.");
  }
  if (!remoteHead) {
    throw new Error(`Remote-Branch origin/${branch} wurde nach dem Push nicht gefunden.`);
  }
  if (remoteHead !== expectedCommit) {
    throw new Error(
      `Remote-Pruefung fehlgeschlagen: lokal ${expectedCommit.slice(0, 12)}, remote ${remoteHead.slice(0, 12)}.`,
    );
  }
}

function printPrHint(branch) {
  const url = pullRequestUrl(branch);
  console.log("Naechster Schritt: Pull Request auf GitHub pruefen. Merge bleibt bewusst manuell.");
  if (url) console.log(`Pull Request: ${url}`);
}

try {
  ensureNoConflicts(root);
  const branch = currentBranch(root);
  if (!branch || ["main", "master"].includes(branch)) {
    throw new Error(`Freigabe direkt auf '${branch || "detached HEAD"}' ist gesperrt. Verwende einen Feature- oder Recovery-Branch.`);
  }

  const verification = assertVerifiedState(branch);
  const initialStatus = statusText();

  if (initialStatus) {
    console.log("=== Gepruefte Aenderungen ===");
    run("git", ["status", "--short", "--untracked-files=all"], { cwd: root });
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

    const previousHead = currentCommit(root);
    run("git", ["add", "-A"], { cwd: root });

    const staged = gitText(["diff", "--cached", "--name-only", "HEAD", "--"], { cwd: root });
    if (!staged) {
      throw new Error(
        "Git meldet lokale Aenderungen, aber nach 'git add -A' ist nichts fuer den Commit vorgemerkt. Freigabe wurde abgebrochen.",
      );
    }

    run("git", ["commit", "-m", message], { cwd: root });
    const committedHead = currentCommit(root);
    if (committedHead === previousHead) {
      throw new Error("Nach 'git commit' wurde kein neuer Commit erzeugt. Freigabe wurde abgebrochen.");
    }

    assertCleanAfterCommit();

    // Der Inhalt ist derselbe bereits gepruefte Stand, nur jetzt als Commit.
    // Dadurch kann ein fehlgeschlagener Push ohne erneuten Build sauber wiederholt werden.
    writeVerification(root, {
      checks: verification.checks ?? [],
      sourceVerificationAt: verification.verifiedAt,
      releaseApprovalCommit: committedHead,
    });

    run("git", ["push", "-u", "origin", branch], { cwd: root });
    assertRemoteMatches(branch, committedHead);
    assertCleanAfterCommit();
    clearVerification(root);

    console.log("\nERFOLG: Gepruefter Stand wurde committed, gepusht und remote verifiziert.");
    console.log(`Branch: ${branch}`);
    console.log(`Commit: ${committedHead.slice(0, 12)}`);
    printPrHint(branch);
    process.exit(0);
  }

  const head = currentCommit(root);
  const remoteHead = remoteCommit(branch);

  if (remoteHead === head) {
    clearVerification(root);
    console.log("\nERFOLG: Arbeitsverzeichnis ist sauber und dieser exakt gepruefte Commit ist bereits auf dem Remote-Branch vorhanden.");
    console.log(`Branch: ${branch}`);
    console.log(`Commit: ${head.slice(0, 12)}`);
    console.log("Es gibt nichts mehr zu committen oder zu pushen.");
    printPrHint(branch);
    process.exit(0);
  }

  console.log("=== Gepruefter Commit ===");
  console.log(`Branch: ${branch}`);
  console.log(`Commit: ${head.slice(0, 12)}`);
  if (remoteHead === null) console.log("Remote-Stand: nicht lesbar");
  else if (remoteHead) console.log(`Remote-Stand: ${remoteHead.slice(0, 12)}`);
  else console.log("Remote-Stand: fuer diesen Branch noch nicht vorhanden");

  const confirmation = (await prompt("Diesen bereits committeden und geprueften Stand pushen? Tippe JA: ")).toUpperCase();
  if (confirmation !== "JA") {
    console.log("Freigabe ohne Aenderung abgebrochen.");
    process.exit(0);
  }

  run("git", ["push", "-u", "origin", branch], { cwd: root });
  assertRemoteMatches(branch, head);
  assertCleanAfterCommit();
  clearVerification(root);

  console.log("\nERFOLG: Gepruefter Commit wurde gepusht und remote verifiziert.");
  console.log(`Branch: ${branch}`);
  console.log(`Commit: ${head.slice(0, 12)}`);
  printPrHint(branch);
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  process.exitCode = 1;
}
