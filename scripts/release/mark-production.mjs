import { currentBranch, ensureClean, gitText, prompt, repoRoot, run } from "./lib.mjs";

const root = repoRoot();

try {
  ensureClean(root);
  run("git", ["fetch", "origin", "main", "--tags", "--prune"], { cwd: root });

  let commit = process.argv[2]?.trim();
  if (!commit) commit = await prompt("Commit des erfolgreich laufenden Vercel-Produktionsdeployments: ");
  if (!commit) throw new Error("Commit fehlt.");

  const resolved = gitText(["rev-parse", `${commit}^{commit}`], { cwd: root });
  const main = gitText(["rev-parse", "origin/main"], { cwd: root });
  if (resolved !== main) {
    throw new Error(
      `Der angegebene Commit ist nicht der aktuelle origin/main.\nDeployment: ${resolved}\norigin/main: ${main}\n` +
      "Bei einem Rollback bitte zuerst GitHub main ueber einen Recovery-PR wieder auf einen stabilen Baum bringen.",
    );
  }

  const date = new Date();
  const stamp = date.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const short = resolved.slice(0, 7);
  const tag = `production-${stamp}-${short}`;
  run("git", ["tag", "-a", tag, resolved, "-m", `Stabiler Produktionsstand ${short}`], { cwd: root });
  run("git", ["push", "origin", tag], { cwd: root });

  console.log(`\nERFOLG: Produktionsstand markiert: ${tag}`);
  console.log(`Aktueller lokaler Branch blieb unveraendert: ${currentBranch(root)}`);
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  process.exitCode = 1;
}
