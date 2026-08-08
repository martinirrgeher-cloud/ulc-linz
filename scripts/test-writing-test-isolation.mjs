import assert from "node:assert/strict";
import test from "node:test";
import {
  findDuplicateWriteKeys,
  validateScenarioIsolation,
} from "./lib/writing-test-isolation.mjs";

test("unabhaengige Writing-Szenarien werden akzeptiert", () => {
  const result = validateScenarioIsolation({
    masterdata: { writeKeys: ["athletes:new:a", "users:update:p"] },
    planning: { writeKeys: ["plans:a:2026-08-03"] },
  });
  assert.deepEqual(result, { scenarioCount: 2, writeKeyCount: 3 });
});

test("gemeinsam beschriebene Ressourcen werden als Parallelisierungsrisiko erkannt", () => {
  const registry = {
    first: { writeKeys: ["athletes:update:1"] },
    second: { writeKeys: ["athletes:update:1", "plans:new:2"] },
  };
  assert.deepEqual(findDuplicateWriteKeys(registry), [
    { writeKey: "athletes:update:1", scenarioNames: ["first", "second"] },
  ]);
  assert.throws(
    () => validateScenarioIsolation(registry),
    /Writing scenarios share mutable write keys/,
  );
});

test("leere oder fehlende Write-Keys sind unzulaessig", () => {
  assert.throws(
    () => validateScenarioIsolation({
      one: { writeKeys: ["athletes:new:a"] },
      two: { writeKeys: [] },
    }),
    /must define at least one write key/,
  );
  assert.throws(
    () => validateScenarioIsolation({
      one: { writeKeys: ["athletes:new:a"] },
      two: { writeKeys: ["   "] },
    }),
    /contains an empty write key/,
  );
});
