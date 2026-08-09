import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const npmAuditArgs = ["audit", "--json", "--registry=https://registry.npmjs.org"];

function runNpmAudit() {
  const npmExecPath = process.env.npm_execpath;
  const bundledNpmCli = resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const npmCli = npmExecPath && existsSync(npmExecPath)
    ? npmExecPath
    : existsSync(bundledNpmCli)
      ? bundledNpmCli
      : null;

  if (npmCli) {
    return spawnSync(process.execPath, [npmCli, ...npmAuditArgs], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  }

  if (process.platform === "win32") {
    const commandProcessor = process.env.ComSpec || "cmd.exe";
    const commandLine = `npm.cmd ${npmAuditArgs.join(" ")}`;
    return spawnSync(commandProcessor, ["/d", "/s", "/c", commandLine], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  }

  return spawnSync("npm", npmAuditArgs, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

const result = runNpmAudit();

if (result.error) throw result.error;

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch (error) {
  console.error(result.stdout);
  console.error(result.stderr);
  throw new Error(`npm audit lieferte kein gueltiges JSON: ${error instanceof Error ? error.message : error}`);
}

if (report.error) {
  console.error(result.stderr);
  throw new Error(`npm audit konnte nicht verlaesslich ausgefuehrt werden: ${report.error.summary ?? report.error.code ?? "unbekannter Fehler"}`);
}

const counts = report.metadata?.vulnerabilities ?? {};
const high = Number(counts.high ?? 0);
const critical = Number(counts.critical ?? 0);
const moderate = Number(counts.moderate ?? 0);
const low = Number(counts.low ?? 0);

console.log(`Dependency-Audit: ${critical} critical, ${high} high, ${moderate} moderate, ${low} low.`);

if (critical > 0 || high > 0) {
  const vulnerable = Object.values(report.vulnerabilities ?? {})
    .filter((entry) => entry && ["critical", "high"].includes(entry.severity))
    .map((entry) => `${entry.name} (${entry.severity})`)
    .sort();
  throw new Error(`High/Critical npm-Vulnerabilities sind nicht zulaessig: ${vulnerable.join(", ")}`);
}

if (moderate > 0) {
  const moderatePackages = Object.values(report.vulnerabilities ?? {})
    .filter((entry) => entry?.severity === "moderate")
    .map((entry) => entry.name)
    .sort();
  console.warn(`Hinweis: Moderate npm-Vulnerabilities vorhanden: ${moderatePackages.join(", ")}`);
}
