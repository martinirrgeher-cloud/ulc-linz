import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const read = async (relative) => readFile(path.join(root, relative), "utf8");

const required = [
  "src/features/training-session/types.ts",
  "src/features/training-session/core.ts",
  "src/features/training-session/api-parsers.ts",
  "src/features/training-session/statistics-types.ts",
  "src/features/training-session/statistics-core.ts",
  "src/features/training-session/statistics-parsers.ts",
  "src/features/group-training/modules.ts",
  "src/pages/U12TrainingPage.tsx",
  "src/pages/U14TrainingPage.tsx",
  "src/pages/U12TrainingStatisticsPage.tsx",
  "src/pages/U14TrainingStatisticsPage.tsx",
];
for (const relative of required) await access(path.join(root, relative));

const core = await read("src/features/training-session/core.ts");
const apiParsers = await read("src/features/training-session/api-parsers.ts");
const statisticsCore = await read("src/features/training-session/statistics-core.ts");
const statisticsParsers = await read("src/features/training-session/statistics-parsers.ts");

for (const [label, source] of [
  ["Training-Core", core],
  ["Training-API-Parser", apiParsers],
  ["Statistik-Core", statisticsCore],
  ["Statistik-Parser", statisticsParsers],
]) {
  assert.doesNotMatch(source, /supabase|\.rpc\(/i, `${label} darf keinen Supabase-Zugriff besitzen.`);
}
assert.doesNotMatch(core, /from\s+["']react["']/, "Training-Core muss React-unabhängig bleiben.");
assert.doesNotMatch(statisticsCore, /from\s+["']react["']/, "Statistik-Core muss React-unabhängig bleiben.");
for (const source of [core, apiParsers, statisticsCore, statisticsParsers]) {
  assert.doesNotMatch(
    source,
    /Kindertraining|U12|U14/,
    "Gemeinsamer Training-Core darf keine konkrete Trainingsgruppe fest verdrahten.",
  );
}

const kinderApi = await read("src/features/kindertraining/api.ts");
const groupApi = await read("src/features/group-training/api.ts");
const kinderStatsApi = await read("src/features/kindertraining-statistics/api.ts");
const groupStatsApi = await read("src/features/group-training-statistics/api.ts");

assert.match(kinderApi, /parseTrainingSessionPayload/, "Kindertraining-API muss den gemeinsamen Session-Parser verwenden.");
assert.match(groupApi, /parseTrainingSessionPayload/, "Gruppentraining-API muss den gemeinsamen Session-Parser verwenden.");
assert.match(kinderStatsApi, /parseTrainingStatisticsOverview/, "Kindertraining-Statistik muss den gemeinsamen Statistik-Parser verwenden.");
assert.match(groupStatsApi, /parseTrainingStatisticsOverview/, "Gruppentraining-Statistik muss den gemeinsamen Statistik-Parser verwenden.");

for (const [label, source] of [
  ["Kindertraining-API", kinderApi],
  ["Gruppentraining-API", groupApi],
]) {
  for (const duplicate of [
    /function\s+parseParticipants\s*\(/,
    /function\s+parseTrainers\s*\(/,
    /function\s+parseSessionPayload\s*\(/,
    /function\s+parseWeekdays\s*\(/,
  ]) {
    assert.doesNotMatch(source, duplicate, `${label} darf gemeinsame Parserlogik nicht wieder lokal kopieren.`);
  }
}
for (const [label, source] of [
  ["Kindertraining-Statistik", kinderStatsApi],
  ["Gruppentraining-Statistik", groupStatsApi],
]) {
  for (const duplicate of [
    /function\s+parseSessions\s*\(/,
    /function\s+parseAthletes\s*\(/,
    /function\s+parseTrainers\s*\(/,
    /function\s+parseMonthly\s*\(/,
  ]) {
    assert.doesNotMatch(source, duplicate, `${label} darf gemeinsame Statistikparser nicht wieder lokal kopieren.`);
  }
}

for (const marker of [
  "kindertraining_configuration_overview",
  "kindertraining_session_overview",
  "save_kindertraining_session_v3",
  "delete_kindertraining_special_session",
  "create_kindertraining_athlete",
]) assert.ok(kinderApi.includes(marker), `Kindertraining behält seinen eigenen API-Adapter: ${marker}`);
for (const marker of [
  "training_module_configuration_overview",
  "training_module_session_overview",
  "save_training_module_session",
  "delete_training_module_special_session",
  "create_training_module_athlete",
]) assert.ok(groupApi.includes(marker), `U12/U14 behalten ihren eigenen API-Adapter: ${marker}`);

const modules = await read("src/features/group-training/modules.ts");
for (const marker of [
  "U12_TRAINING_MODULE",
  "U14_TRAINING_MODULE",
  'moduleKey: "u12"',
  'moduleKey: "u14"',
  'sortStorageKey: "ulc-group-training-name-sort-u12"',
  'sortStorageKey: "ulc-group-training-name-sort-u14"',
]) assert.ok(modules.includes(marker), `Explizite Modulgrenze fehlt: ${marker}`);

const app = await read("src/app/App.tsx");
for (const page of [
  "U12TrainingPage",
  "U14TrainingPage",
  "U12TrainingStatisticsPage",
  "U14TrainingStatisticsPage",
]) assert.ok(app.includes(page), `App-Routing braucht einen eigenen Escape-Hatch für ${page}.`);
assert.doesNotMatch(
  app,
  /<GroupTraining(?:Statistics)?Page\b/,
  "App darf U12/U14 nicht direkt an die gemeinsame Implementierung koppeln.",
);

for (const [relative, moduleMarker] of [
  ["src/pages/U12TrainingPage.tsx", "U12_TRAINING_MODULE"],
  ["src/pages/U14TrainingPage.tsx", "U14_TRAINING_MODULE"],
  ["src/pages/U12TrainingStatisticsPage.tsx", "U12_TRAINING_MODULE"],
  ["src/pages/U14TrainingStatisticsPage.tsx", "U14_TRAINING_MODULE"],
]) {
  const source = await read(relative);
  assert.ok(source.includes(moduleMarker), `${relative} muss seine eigene Moduldefinition besitzen.`);
}

for (const relative of [
  "src/pages/KindertrainingDraftPage.tsx",
  "src/pages/KindertrainingStatisticsPage.tsx",
]) {
  const source = await read(relative);
  assert.doesNotMatch(
    source,
    /GroupTraining(?:Statistics)?Page/,
    `${relative} muss als eigenständige fachliche Seite erhalten bleiben.`,
  );
}

const groupPage = await read("src/pages/GroupTrainingPage.tsx");
const groupStatsPage = await read("src/pages/GroupTrainingStatisticsPage.tsx");
assert.match(groupPage, /GroupTrainingModuleDefinition/, "Gemeinsame U12/U14-Seite braucht einen expliziten Modulvertrag.");
assert.match(groupStatsPage, /GroupTrainingModuleDefinition/, "Gemeinsame U12/U14-Statistik braucht einen expliziten Modulvertrag.");
assert.doesNotMatch(groupPage, /features\/kindertraining\/types/, "U12/U14 dürfen nicht mehr von Kindertraining-Typen abhängen.");
assert.doesNotMatch(groupStatsPage, /kindertraining-statistics\/types/, "U12/U14-Statistik darf nicht mehr von Kindertraining-Typen abhängen.");

console.log("Trainingsmodul-Architektur erfolgreich: gemeinsamer technischer Kern, getrennte Adapter und explizite U12/U14-Escape-Hatches.");
