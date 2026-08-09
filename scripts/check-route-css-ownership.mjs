import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function text(file) {
  assert.ok(existsSync(file), `CSS-Ownership-Datei fehlt: ${file}`);
  return readFileSync(file, "utf8");
}

const blockInfo = text("src/features/training-blocks/TrainingBlockExerciseInfoDialog.tsx");
const planningInfo = text("src/features/training-planning/TrainingPlanningExerciseInfoDialog.tsx");
const sharedInfoCss = text("src/styles/exercise-info-dialog.css");
const trainingBlocksCss = text("src/styles/training-blocks.css");
const trainingPlanningCss = text("src/styles/training-planning.css");
for (const source of [blockInfo, planningInfo]) {
  assert.match(source, /@\/styles\/exercise-info-dialog\.css/, "Beide Exercise-Info-Dialoge muessen ihr gemeinsames CSS selbst importieren.");
}
assert.match(sharedInfoCss, /\.training-block-exercise-info-backdrop\b/, "Gemeinsames Exercise-Info-CSS muss den Dialog besitzen.");
assert.doesNotMatch(trainingBlocksCss, /\.training-block-exercise-info-backdrop\b/, "Training-Blocks-Route darf das Shared-Dialog-CSS nicht besitzen.");
assert.doesNotMatch(trainingPlanningCss, /\.training-block-exercise-info-backdrop\b/, "Training-Planning-Route darf das Shared-Dialog-CSS nicht besitzen.");

const groupEditor = text("src/features/athletes/TrainingGroupEditor.tsx");
const groupSettingsCss = text("src/styles/performance-group-settings.css");
const performanceRegistrationCss = text("src/styles/performance-registration.css");
assert.match(groupEditor, /@\/styles\/performance-group-settings\.css/, "TrainingGroupEditor muss sein Performance-Einstellungs-CSS selbst laden.");
for (const marker of [".performance-group-fieldset", ".performance-settings-panel"]) {
  assert.ok(groupSettingsCss.includes(marker), `Performance-Group-CSS fehlt: ${marker}`);
  assert.equal(performanceRegistrationCss.includes(marker), false, `Performance-Registration darf Editor-CSS nicht besitzen: ${marker}`);
}

const mobileFoundation = text("src/styles/mobile-foundation.css");
const uiDesignSystem = text("src/styles/ui-design-system.css");
assert.match(mobileFoundation, /\.sr-only\s*\{/, "sr-only muss als globale Utility in mobile-foundation.css definiert sein.");
assert.match(mobileFoundation, /\.ui-status-filter\s*\{/, "Statusfilter muss eine gemeinsame UI-Basis besitzen.");
assert.match(uiDesignSystem, /\.ui-favorite-filter\s*\{/, "Favoritenfilter muss im gemeinsamen UI-Designsystem liegen.");

const sourceFiles = [
  "src/pages/AthleteManagementPage.tsx",
  "src/pages/UserManagementPage.tsx",
  "src/pages/ExerciseCatalogPage.tsx",
  "src/pages/TrainingBlocksPage.tsx",
];
for (const file of sourceFiles) {
  const source = text(file);
  assert.doesNotMatch(source, /className=["'`]status-filter\b/, `${file} darf den alten routeabhaengigen status-filter nicht verwenden.`);
  assert.doesNotMatch(source, /className=["'`]favorite-filter\b/, `${file} darf den alten routeabhaengigen favorite-filter nicht verwenden.`);
}

for (const file of ["src/styles/exercise-catalog.css", "src/styles/training-blocks.css"]) {
  const source = text(file);
  assert.doesNotMatch(source, /\.favorite-filter\b/, `${file} darf keinen eigenen Favoritenfilter mehr definieren.`);
}

console.log("Route-CSS-Ownership: Shared-Komponenten und globale UI-Utilities besitzen ihr CSS unabhaengig von zuvor besuchten Routen.");
