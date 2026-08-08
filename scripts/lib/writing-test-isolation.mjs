export function collectWriteKeyOwners(registry) {
  const owners = new Map();
  for (const [scenarioName, scenario] of Object.entries(registry ?? {})) {
    const writeKeys = scenario?.writeKeys;
    if (!Array.isArray(writeKeys) || writeKeys.length === 0) {
      throw new Error(`Writing scenario ${scenarioName} must define at least one write key.`);
    }
    for (const rawKey of writeKeys) {
      const key = String(rawKey ?? "").trim();
      if (!key) throw new Error(`Writing scenario ${scenarioName} contains an empty write key.`);
      const current = owners.get(key) ?? [];
      current.push(scenarioName);
      owners.set(key, current);
    }
  }
  return owners;
}

export function findDuplicateWriteKeys(registry) {
  const owners = collectWriteKeyOwners(registry);
  return [...owners.entries()]
    .filter(([, scenarioNames]) => scenarioNames.length > 1)
    .map(([writeKey, scenarioNames]) => ({ writeKey, scenarioNames: [...scenarioNames] }));
}

export function validateScenarioIsolation(registry) {
  const scenarioNames = Object.keys(registry ?? {});
  if (scenarioNames.length < 2) {
    throw new Error("Writing test isolation requires at least two independent scenarios.");
  }
  const duplicates = findDuplicateWriteKeys(registry);
  if (duplicates.length) {
    const detail = duplicates
      .map(({ writeKey, scenarioNames: owners }) => `${writeKey} -> ${owners.join(", ")}`)
      .join("; ");
    throw new Error(`Writing scenarios share mutable write keys: ${detail}`);
  }
  return {
    scenarioCount: scenarioNames.length,
    writeKeyCount: [...collectWriteKeyOwners(registry).keys()].length,
  };
}
