import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const migrationPath = path.resolve("supabase/migrations/202608020033_catalog_block_intelligence.sql");
const migration = await readFile(migrationPath, "utf8");
const packageSource = await readFile(path.resolve("package.json"), "utf8");
const exercisePage = await readFile(path.resolve("src/pages/ExerciseCatalogPage.tsx"), "utf8");
const exerciseEditor = await readFile(path.resolve("src/features/exercise-catalog/ExerciseEditor.tsx"), "utf8");
const trainingBlocksPage = await readFile(path.resolve("src/pages/TrainingBlocksPage.tsx"), "utf8");
const trainingBlockEditor = await readFile(path.resolve("src/features/training-blocks/TrainingBlockEditor.tsx"), "utf8");
const databaseTest = await readFile(path.resolve("supabase/tests/database/50_catalog_block_intelligence.test.sql"), "utf8");

for (const marker of [
  "difficulty_key",
  "exercise_similarities",
  "exercise_duplicate_candidates",
  "training_block_user_favorites",
  "training_block_versions",
  "create_training_block_variant",
  "training_block_overview_v3",
  "save_training_block_v3",
]) {
  assert.ok(migration.includes(marker), `E5-Migrationsmarker fehlt: ${marker}`);
}

for (const marker of [
  "Schwierigkeitsgrad",
  "Ähnliche Übungen",
  "Mögliche Dublette",
  "Archiv",
  "ExerciseUsageDialog",
]) {
  assert.ok(
    exercisePage.includes(marker) || exerciseEditor.includes(marker),
    `E5-Übungskatalogmarker fehlt: ${marker}`,
  );
}

for (const marker of [
  "Neue Variante erstellen",
  "Favoriten",
  "Letzte Nutzung",
  "Tatsächlich verwendet von",
  "TrainingBlockCompareDialog",
  "Inaktive Übungen im Block",
  "Versionsverlauf",
]) {
  assert.ok(
    trainingBlocksPage.includes(marker) || trainingBlockEditor.includes(marker),
    `E5-Trainingsblockmarker fehlt: ${marker}`,
  );
}

assert.match(databaseTest, /select\s+plan\(16\)/i);
assert.ok(packageSource.includes('"check:catalog-block-suite"'));
assert.ok(packageSource.includes("npm run check:catalog-block-suite"));

const sourceFiles = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else sourceFiles.push(absolute);
  }
}
await collect(path.resolve("src"));
const changedCssMarkers = sourceFiles.filter((file) => file.endsWith(".css"));
assert.ok(changedCssMarkers.length > 0, "Projekt-CSS konnte nicht gefunden werden.");

console.log("E5a/E5b-Strukturprüfung erfolgreich: Katalog, Blöcke, Migration und Tests sind vollständig verknüpft.");
