import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PLAYWRIGHT_VERSION, npmCommand, npxCommand, repoRoot, run } from "./lib.mjs";

export function ensurePlaywright(root = repoRoot()) {
  const packageFile = resolve(root, "node_modules", "@playwright", "test", "package.json");
  let installedVersion = null;

  if (existsSync(packageFile)) {
    try {
      installedVersion = JSON.parse(readFileSync(packageFile, "utf8")).version;
    } catch {
      installedVersion = null;
    }
  }

  if (installedVersion !== PLAYWRIGHT_VERSION) {
    console.log(`Installiere Playwright Test ${PLAYWRIGHT_VERSION} ohne package-lock.json zu veraendern...`);
    run(npmCommand(), [
      "install",
      "--no-save",
      "--package-lock=false",
      `@playwright/test@${PLAYWRIGHT_VERSION}`,
    ], { cwd: root });
  }

  console.log("Pruefe Chromium fuer den Runtime-Test...");
  run(npxCommand(), ["playwright", "install", "chromium"], { cwd: root });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  ensurePlaywright();
}
