import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const smoke = readFileSync("scripts/smoke-test.mjs", "utf8");
const releaseInfrastructure = readFileSync("scripts/check-release-infrastructure.mjs", "utf8");

for (const marker of [
  "create-project-archive.ps1",
  "release/start-change.mjs",
]) {
  assert.doesNotMatch(
    smoke,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Smoke-Schicht darf Release-Infrastruktur nicht mehr direkt prüfen: ${marker}`,
  );
  assert.match(
    releaseInfrastructure,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Release-Infrastrukturcheck muss die ausgelagerte Verantwortung übernehmen: ${marker}`,
  );
}

const smokeTestCount = (smoke.match(/\btest\("/g) ?? []).length;
assert.equal(smokeTestCount, 61, "S2c erwartet 61 fokussierte App-Smoke-Tests nach Auslagerung der zwei Release-Infrastrukturchecks.");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.match(pkg.scripts?.["ci:quality"] ?? "", /check:test-layering/, "CI muss die Testschichten absichern.");
assert.match(pkg.scripts?.["ci:preview"] ?? "", /check:test-layering/, "Preview muss die Testschichten absichern.");

console.log(`S2c test layering verified: ${smokeTestCount} app smoke tests; release mechanics stay in dedicated infrastructure tests.`);
