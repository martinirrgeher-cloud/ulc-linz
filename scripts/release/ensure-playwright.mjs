import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PLAYWRIGHT_VERSION, npmCommand, npxCommand, repoRoot, run } from "./lib.mjs";

function installedPlaywrightVersion(root) {
  const packageFile = resolve(root, "node_modules", "@playwright", "test", "package.json");
  if (!existsSync(packageFile)) return null;
  try {
    return JSON.parse(readFileSync(packageFile, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

export function ensurePlaywright(root = repoRoot()) {
  let installedVersion = installedPlaywrightVersion(root);
  if (installedVersion !== PLAYWRIGHT_VERSION) {
    console.log(
      `Lokale Abhaengigkeiten sind nicht mit package-lock.json synchron (Playwright: ${installedVersion || "fehlt"}).`,
    );
    console.log("Fuehre reproduzierbar npm ci aus; package.json und package-lock.json werden dabei nicht veraendert...");
    run(npmCommand(), ["ci"], { cwd: root });
    installedVersion = installedPlaywrightVersion(root);
  }

  if (installedVersion !== PLAYWRIGHT_VERSION) {
    throw new Error(`Playwright Test ${PLAYWRIGHT_VERSION} ist trotz npm ci nicht installiert.`);
  }

  console.log(`Playwright Test ${installedVersion} stimmt mit dem fest gepinnten Projektstand ueberein.`);
  console.log("Pruefe Chromium fuer den Runtime-Test...");
  run(npxCommand(), ["playwright", "install", "chromium"], { cwd: root });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  ensurePlaywright();
}
