import { resolve } from "node:path";
import { rmSync } from "node:fs";
import { ensurePlaywright } from "./ensure-playwright.mjs";
import { npxCommand, repoRoot, run } from "./lib.mjs";

const root = repoRoot();
const runtimeDist = resolve(root, ".ulc-runtime-dist");

function runtimeProfile() {
  const explicit = process.argv.find((value) => value.startsWith("--profile="))?.split("=")[1]
    ?? process.env.ULC_RUNTIME_PROFILE
    ?? "full";
  if (!["full", "pr"].includes(explicit)) {
    throw new Error(`Unbekanntes Runtime-Testprofil: ${explicit}. Erlaubt sind full oder pr.`);
  }
  return explicit;
}

const profile = runtimeProfile();

try {
  ensurePlaywright(root);
  rmSync(runtimeDist, { recursive: true, force: true });

  const env = {
    ...process.env,
    VITE_SUPABASE_URL: "https://e2e.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_runtime_tests",
    VITE_ALLOW_SELF_SIGNUP: "false",
    E2E_RUNTIME_BASE_URL: "http://127.0.0.1:4175",
    E2E_RUNTIME_DIST_DIR: runtimeDist,
  };

  console.log("\n=== Isolierter Runtime-Test-Build ===");
  // TypeScript und der normale Produktions-Build wurden bereits im Quality-Gate
  // geprueft. Fuer den Browser-Test wird nur noch ein eigener Vite-Build mit
  // deterministischer Fake-Supabase-Umgebung erzeugt. Der normale dist-Ordner
  // bleibt dadurch unveraendert.
  run(process.execPath, [
    resolve(root, "node_modules", "vite", "bin", "vite.js"),
    "build",
    "--outDir",
    runtimeDist,
    "--emptyOutDir",
  ], { cwd: root, env });

  console.log(`\n=== Echter Browser-Runtime-Test (${profile === "pr" ? "PR-Kernset" : "Vollregression"}) ===`);
  const playwrightArgs = ["playwright", "test", "--config=playwright.runtime.config.mjs"];
  if (profile === "pr") playwrightArgs.push("--grep", "@pr");
  run(npxCommand(), playwrightArgs, {
    cwd: root,
    env,
  });

  console.log("\nERFOLG: Browser-Runtime-Test bestanden.");
} catch (error) {
  console.error(`\nFEHLER: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(runtimeDist, { recursive: true, force: true });
}
