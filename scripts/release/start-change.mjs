import {
  currentBranch,
  ensureClean,
  gitText,
  prompt,
  repoRoot,
  run,
  sanitizeBranchPart,
} from "./lib.mjs";

const root = repoRoot();

try {
  ensureClean(root);
  console.log("Aktualisiere origin/main...");
  run("git", ["fetch", "origin", "main", "--prune"], { cwd: root });

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
  if (existing.status === 0) throw new Error(`Branch ${branch} existiert bereits.`);

  run("git", ["switch", "-c", branch, "origin/main"], { cwd: root });
  console.log("\nERFOLG: Neuer sauberer Feature-Branch erstellt.");
  console.log(`Branch: ${currentBranch(root)}`);
  console.log(`Basis:  ${gitText(["rev-parse", "--short", "HEAD"], { cwd: root })}`);
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  process.exitCode = 1;
}
