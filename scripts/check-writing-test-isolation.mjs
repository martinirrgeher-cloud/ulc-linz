import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { WRITING_SCENARIOS } from "../tests/e2e-writing/helpers/scenarios.mjs";
import { validateScenarioIsolation } from "./lib/writing-test-isolation.mjs";

const expectedSpecs = new Map([
  ["masterdata", "tests/e2e-writing/masterdata-writing.spec.mjs"],
  ["collaboration", "tests/e2e-writing/collaboration-writing.spec.mjs"],
  ["catalog", "tests/e2e-writing/catalog-writing.spec.mjs"],
  ["registration", "tests/e2e-writing/registration-writing.spec.mjs"],
  ["planning", "tests/e2e-writing/planning-writing.spec.mjs"],
]);

assert.equal(
  existsSync("tests/e2e-writing/core-writing.spec.mjs"),
  false,
  "Der alte monolithische Writing-E2E-Test darf nach S2c nicht mehr existieren.",
);

const isolation = validateScenarioIsolation(WRITING_SCENARIOS);
assert.equal(isolation.scenarioCount, expectedSpecs.size, "Jede Writing-Domaene braucht genau ein Isolation-Szenario.");

for (const [scenarioName, file] of expectedSpecs) {
  assert.ok(existsSync(file), `Writing-Spezifikation fehlt: ${file}`);
  const source = readFileSync(file, "utf8");
  assert.match(
    source,
    new RegExp(`WRITING_SCENARIOS\\.${scenarioName}\\b`),
    `${file} muss sein explizites Writing-Szenario verwenden.`,
  );
  assert.doesNotMatch(
    source,
    /test\.describe\.configure\(\s*\{\s*mode:\s*["']parallel["']/,
    `${file} darf keine Tests innerhalb derselben Domaene parallelisieren.`,
  );
}

const prSpecs = [
  "tests/e2e-writing/masterdata-writing.spec.mjs",
  "tests/e2e-writing/catalog-writing.spec.mjs",
  "tests/e2e-writing/registration-writing.spec.mjs",
  "tests/e2e-writing/planning-writing.spec.mjs",
];
for (const file of prSpecs) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /tag:\s*"@pr"/, `${file} muss einen PR-Kernablauf enthalten.`);
}
assert.doesNotMatch(
  readFileSync("tests/e2e-writing/collaboration-writing.spec.mjs", "utf8"),
  /tag:\s*"@pr"/,
  "Kollaborations-Vollregression soll nicht versehentlich in das schnelle PR-Kernset ruecken.",
);

const config = readFileSync("playwright.writing.config.mjs", "utf8");
assert.match(config, /fullyParallel:\s*false/, "S2c parallelisiert nur ueber getrennte Domaenen-Dateien.");
assert.match(
  config,
  /workers:\s*process\.env\.CI\s*\?\s*2\s*:\s*1/,
  "GitHub Writing-E2E muss exakt zwei Worker nutzen; lokale manuelle Laeufe bleiben seriell.",
);

console.log(
  `S2c writing isolation verified: ${isolation.scenarioCount} domains / ${isolation.writeKeyCount} unique mutable write keys / 2 CI workers.`,
);
