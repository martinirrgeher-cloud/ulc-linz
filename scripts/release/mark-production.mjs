import { currentBranch, ensureClean, gitText, prompt, repoRoot, run } from "./lib.mjs";

const root = repoRoot();
let originalBranch = null;
let switchedToMain = false;

try {
  ensureClean(root);
  originalBranch = currentBranch(root);
  run("git", ["fetch", "origin", "main", "--tags", "--prune"], { cwd: root });

  let commit = process.argv[2]?.trim();
  if (!commit) commit = await prompt("Commit des erfolgreich laufenden Vercel-Produktionsdeployments: ");
  if (!commit) throw new Error("Commit fehlt.");

  const resolved = gitText(["rev-parse", `${commit}^{commit}`], { cwd: root });
  const remoteMain = gitText(["rev-parse", "origin/main"], { cwd: root });
  if (resolved !== remoteMain) {
    throw new Error(
      `Der angegebene Commit ist nicht der aktuelle origin/main.\nDeployment: ${resolved}\norigin/main: ${remoteMain}\n` +
      "Bei einem Rollback bitte zuerst GitHub main ueber einen Recovery-PR wieder auf einen stabilen Baum bringen.",
    );
  }

  const backendVerificationTag = `backend-verified-${resolved}`;
  const backendTagExists = run("git", ["show-ref", "--verify", "--quiet", `refs/tags/${backendVerificationTag}`], {
    cwd: root,
    quiet: true,
    allowFailure: true,
  }).status === 0;
  if (!backendTagExists) {
    throw new Error(
      `Das Produktionsbackend ist fuer diesen Commit noch nicht verifiziert.\n` +
      `Erwarteter Nachweis: ${backendVerificationTag}\n` +
      "Warte, bis der GitHub-Workflow 'Produktionsbackend verifizieren' fuer origin/main erfolgreich abgeschlossen ist, und starte die Produktionsmarkierung danach erneut.",
    );
  }
  const backendVerifiedCommit = gitText(["rev-parse", `refs/tags/${backendVerificationTag}^{commit}`], { cwd: root });
  if (backendVerifiedCommit !== resolved) {
    throw new Error(
      `Der Backend-Verifikationsnachweis zeigt auf einen unerwarteten Commit.\n` +
      `Nachweis: ${backendVerifiedCommit}\nProduktion: ${resolved}`,
    );
  }

  // Nach einem Squash-&-Merge darf der PC nicht auf dem alten Feature-Branch
  // stehen bleiben. Der bestaetigte Produktionscommit wird deshalb vor der
  // Markierung sicher als lokaler main synchronisiert. Es wird niemals hart
  // zurueckgesetzt: ein divergierter lokaler main fuehrt bewusst zum Abbruch.
  const localMainExists = run("git", ["show-ref", "--verify", "--quiet", "refs/heads/main"], {
    cwd: root,
    quiet: true,
    allowFailure: true,
  }).status === 0;

  if (currentBranch(root) !== "main") {
    if (localMainExists) {
      run("git", ["switch", "main"], { cwd: root });
    } else {
      run("git", ["switch", "-c", "main", "--track", "origin/main"], { cwd: root });
    }
    switchedToMain = true;
  }

  run("git", ["merge", "--ff-only", "origin/main"], { cwd: root });
  run("git", ["branch", "--set-upstream-to=origin/main", "main"], { cwd: root, quiet: true });

  const localMain = gitText(["rev-parse", "HEAD"], { cwd: root });
  if (localMain !== resolved) {
    throw new Error(
      `Lokaler main stimmt nach der Synchronisierung nicht mit der bestaetigten Produktion ueberein.\n` +
      `Lokal: ${localMain}\nProduktion: ${resolved}`,
    );
  }
  ensureClean(root);

  const date = new Date();
  const stamp = date.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const short = resolved.slice(0, 7);
  const tag = `production-${stamp}-${short}`;
  run("git", ["tag", "-a", tag, resolved, "-m", `Stabiler Produktionsstand ${short}`], { cwd: root });
  run("git", ["push", "origin", tag], { cwd: root });

  console.log(`\nERFOLG: Produktionsstand markiert: ${tag}`);
  console.log(`Lokaler Arbeitsstand ist jetzt sauber auf main: ${resolved}`);
  if (originalBranch && originalBranch !== "main") {
    console.log(`Vorheriger Feature-Branch bleibt zur Sicherheit erhalten: ${originalBranch}`);
  }
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  if (switchedToMain && originalBranch && originalBranch !== "main") {
    console.error("Hinweis: Der lokale Branch wurde bereits auf main umgestellt; es wurde kein harter Reset ausgefuehrt.");
  }
  process.exitCode = 1;
}
