import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = (relativePath) => readFile(relativePath, "utf8");

const globalCss = await read("src/styles/global.css");
const mobileFoundationCss = await read("src/styles/mobile-foundation.css");
const finalUiCss = await read("src/styles/final-ui-v1.css");
const editorActionHeader = await read("src/components/ui/EditorActionHeader.tsx");
const editorShell = await read("src/components/ui/EditorShell.tsx");
const stickyEditorActions = await read("src/components/ui/StickyEditorActions.tsx");
const exerciseEditor = await read("src/features/exercise-catalog/ExerciseEditor.tsx");
const memberEditor = await read("src/features/user-management/MemberEditor.tsx");
const trainingBlockEditor = await read("src/features/training-blocks/TrainingBlockEditor.tsx");
const attendanceWorkspace = await read("src/features/training-session/components/TrainingAttendanceWorkspace.tsx");
const trainingDocumentationEditor = await read("src/features/training-documentation/TrainingDocumentationEditor.tsx");
const trainingOverviewPage = await read("src/pages/TrainingOverviewPage.tsx");
const userManagementPage = await read("src/pages/UserManagementPage.tsx");
const speechButton = await read("src/features/exercise-catalog/SpeechToTextButton.tsx");
const loginPage = await read("src/pages/LoginPage.tsx");
const trainingGroupEditor = await read("src/features/athletes/TrainingGroupEditor.tsx");
const publicHelpButton = await read("src/features/help/PublicHelpButton.tsx");
const specialTrainingPicker = await read("src/features/training-session/components/SpecialTrainingPicker.tsx");
const trainingDateControls = await read("src/features/training-session/components/TrainingDateControls.tsx");

for (const marker of [
  "--ui-control-height: 42px",
  "--ui-control-height-compact: 38px",
  "--ui-icon-button-size: 40px",
  "--ui-control-radius: 10px",
  ".icon-button--save",
  ".icon-button--danger",
  ".ui-tabs",
  ".ui-segmented",
  ".ui-choice-row",
  ".ui-search-field",
]) {
  assert.ok(globalCss.includes(marker), `Verbindlicher UI-Control-Standard fehlt in global.css: ${marker}`);
}

for (const marker of [".ui-switch", ".ui-switch-control", ".ui-labeled-field", ".ui-field-label", ".ui-field-control"]) {
  assert.ok(mobileFoundationCss.includes(marker), `Verbindlicher Switch-Standard fehlt in mobile-foundation.css: ${marker}`);
}

assert.doesNotMatch(
  finalUiCss,
  /\.final-ui-v1\s+\.icon-button\s*\{[^}]*\b(?:background|color|border)\s*:/s,
  "final-ui-v1.css darf normale Iconbuttons nicht semantisch umfaerben.",
);

assert.ok(editorActionHeader.includes("icon-button icon-button--save"), "Der gemeinsame EditorActionHeader muss die zentrale Save-Variante verwenden.");
assert.ok(editorActionHeader.includes("Hilfe für diese Seite"), "Der gemeinsame EditorActionHeader muss die kontextbezogene Hilfe enthalten.");
for (const [label, source] of [["EditorShell", editorShell], ["StickyEditorActions", stickyEditorActions]]) {
  assert.ok(source.includes("<EditorActionHeader"), `${label} muss den gemeinsamen EditorActionHeader verwenden.`);
  assert.doesNotMatch(source, /<(?:Save|X|CircleHelp)/, `${label} darf Editoraktionen nicht erneut lokal implementieren.`);
}
for (const [label, source] of [["Übung", exerciseEditor], ["Benutzer", memberEditor], ["Trainingsblock", trainingBlockEditor]]) {
  assert.ok(source.includes("<EditorShell"), `${label}-Editor muss als Seiteneditor unter der globalen Kopfzeile laufen.`);
}
assert.doesNotMatch(memberEditor, /management-actions|Änderungen speichern<\/button>|Abbrechen<\/button>/, "Benutzereditor darf keinen zweiten Speicher-/Abbrechen-Footer besitzen.");
assert.doesNotMatch(trainingBlockEditor, /training-block-editor-(?:backdrop|dialog|actions)/, "Trainingsblockeditor darf kein Vollbild-Edit-Modal mehr verwenden.");

for (const legacyClass of ["editor-shell-save", "editor-save-button", "exercise-editor-save-button"]) {
  assert.equal(
    [editorActionHeader, editorShell, stickyEditorActions, exerciseEditor, memberEditor, trainingBlockEditor].some((source) => source.includes(legacyClass)),
    false,
    `Alte lokale Save-Variante darf nicht zurueckkehren: ${legacyClass}`,
  );
}

assert.ok(speechButton.includes("icon-button"), "Spracheingabe muss den gemeinsamen Iconbutton verwenden.");
assert.ok(loginPage.includes("icon-button--inline"), "Passwort-Sichtbarkeit muss die gemeinsame Inline-Iconvariante verwenden.");
assert.ok(trainingGroupEditor.includes("ui-switch"), "Echte Ein/Aus-Funktionen der Trainingsgruppe muessen ui-switch verwenden.");
assert.ok(trainingGroupEditor.includes("ui-switch-control"), "Switch-Control muss zentral standardisiert bleiben.");
assert.ok(publicHelpButton.includes("icon-button public-help-button"), "Oeffentliche Hilfe muss den normalen Iconbutton verwenden.");
assert.ok(specialTrainingPicker.includes("icon-button icon-button--save"), "Sondertraining-Speichern muss die gemeinsame Save-Variante verwenden.");
assert.ok(trainingDateControls.includes("icon-button icon-button--danger special-training-action"), "Sondertraining-Loeschen muss die gemeinsame Danger-Variante verwenden.");

const tabContracts = [
  ["src/pages/AthleteManagementPage.tsx", "management-tabs three-tabs ui-tabs"],
  ["src/pages/PerformanceRegistrationPage.tsx", "performance-mode-tabs performance-mode-tabs-v2 ui-tabs"],
  ["src/pages/GroupTrainingStatisticsPage.tsx", "statistics-tabs ui-tabs"],
  ["src/pages/KindertrainingStatisticsPage.tsx", "statistics-tabs ui-tabs"],
  ["src/pages/DataImportPage.tsx", "data-import-mode-tabs ui-tabs"],
  ["src/pages/TrainingDocumentationPage.tsx", "training-doc-tabs ui-tabs"],
  ["src/features/athletes/AthleteEditor.tsx", "editor-section-tabs ui-tabs"],
  ["src/features/athletes/TrainerEditor.tsx", "editor-section-tabs ui-tabs"],
  ["src/features/athletes/TrainingGroupEditor.tsx", "editor-section-tabs ui-tabs"],
  ["src/features/training-blocks/TrainingBlockEditor.tsx", "training-block-editor-tabs ui-tabs"],
  ["src/features/exercise-catalog/ExerciseEditor.tsx", "exercise-editor-tabs ui-tabs"],
];
for (const [path, marker] of tabContracts) {
  const source = await read(path);
  assert.ok(source.includes(marker), `${path} muss den gemeinsamen Tabstandard verwenden.`);
}


assert.ok(attendanceWorkspace.includes("name-sort-toggle ui-segmented"), "Namenssortierung muss ui-segmented verwenden.");
assert.equal((trainingDocumentationEditor.match(/training-doc-segmented ui-segmented/g) ?? []).length, 3, "Beschwerden-Auswahl muss durchgehend ui-segmented verwenden.");
assert.ok(trainingOverviewPage.includes("training-overview-athlete-filter ui-segmented"), "Athletenfilter muss ui-segmented verwenden.");
assert.ok(exerciseEditor.includes('className="ui-segmented" role="group"'), "Parameter Optional/Pflicht muss den gemeinsamen Segmentstandard verwenden.");
assert.ok(userManagementPage.includes('className="ui-search-field"'), "Benutzersuche muss den gemeinsamen Suchfeldstandard verwenden.");

const tsxFiles = [];
async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collectTsxFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".tsx")) tsxFiles.push(path);
  }
}
await collectTsxFiles("src");

for (const path of tsxFiles) {
  const source = await read(path);
  assert.doesNotMatch(source, /className=["'][^"']*(?:^|\s)search-field(?:\s|["'])/, `${path}: veraltetes search-field darf nicht zurueckkehren.`);
  assert.doesNotMatch(source, /className=["'][^"']*(?:primary-button|secondary-button)[^"']*\scompact(?:\s|["'])/, `${path}: Buttons muessen compact-button statt compact verwenden.`);
}

for (const legacySelector of [".back-link", ".button-row", ".control-field", ".danger-icon-button", ".danger-text-button", ".record-status", ".sticky-editor-actions", ".toolbar-select", ".user-management-toolbar", ".user-meta", ".management-editor-heading", ".management-actions", ".search-field"]) {
  assert.equal(globalCss.includes(legacySelector), false, `global.css enthaelt veralteten UI-Selektor: ${legacySelector}`);
}

let labeledFieldCount = 0;
const unstandardizedFields = [];
const labelPattern = /<label(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/label>/g;
const allowedClassFragments = [
  "ui-choice-row",
  "ui-search-field",
  "help-search",
  "group-checkbox",
  "contact-emergency-toggle",
  "training-doc-parameter-row",
  "training-doc-rpe-field",
  "compact-comment-field",
  "deactivation-confirmation",
  "attendance-search",
  "trainer-checkbox",
  "e5c-athlete-search",
  "check-cell",
  "training-plan-picker-search",
];
for (const path of tsxFiles) {
  const source = await read(path);
  labeledFieldCount += source.match(/ui-labeled-field/g)?.length ?? 0;
  for (const match of source.matchAll(labelPattern)) {
    const attrs = match.groups?.attrs ?? "";
    const body = match.groups?.body ?? "";
    if (!/<(?:input|select|textarea)\b/.test(body)) continue;
    if (attrs.includes("ui-labeled-field")) {
      assert.ok(body.includes("ui-field-label"), `${path}: ui-labeled-field benoetigt ui-field-label.`);
      assert.ok(body.includes("ui-field-control"), `${path}: ui-labeled-field benoetigt ui-field-control.`);
      continue;
    }

    const inputTypes = [...body.matchAll(/<input[^>]*type=["']([^"']+)["']/g)].map((entry) => entry[1]);
    const hasSelectOrTextarea = /<(?:select|textarea)\b/.test(body);
    const choiceOnly = inputTypes.length > 0
      && inputTypes.every((type) => ["checkbox", "radio", "file", "search", "range"].includes(type))
      && !hasSelectOrTextarea;
    const allowedByClass = allowedClassFragments.some((fragment) => attrs.includes(fragment));
    const inlineParameter = attrs.includes("key={parameter.key}")
      || /^\s*(?:<span>)?\s*(?:Standard|Min|Max|Schritt)\s*(?:<\/span>)?/.test(body);
    const countdownSpecial = path.endsWith("/CountdownPage.tsx");
    const dynamicChoice = path.endsWith("/MemberEditor.tsx") && attrs.includes('className={selected ? "selected" : ""}');

    if (choiceOnly || allowedByClass || inlineParameter || countdownSpecial || dynamicChoice) continue;
    const line = source.slice(0, match.index).split("\n").length;
    unstandardizedFields.push(`${path}:${line}`);
  }
}

assert.ok(labeledFieldCount >= 120, `Zu wenige appweit standardisierte Formularfelder: ${labeledFieldCount}.`);
assert.deepEqual(
  unstandardizedFields,
  [],
  `Normale beschriftete Formularfelder muessen ui-labeled-field/ui-field-label/ui-field-control verwenden: ${unstandardizedFields.join(", ")}`,
);

const choiceContracts = [
  ["src/pages/DropdownSettingsPage.tsx", "ui-choice-row dropdown-setting-active-toggle"],
  ["src/pages/DataImportPage.tsx", "ui-choice-row data-import-option"],
  ["src/pages/CountdownPage.tsx", 'className="ui-choice-row"'],
  ["src/features/athletes/TrainingGroupEditor.tsx", "ui-choice-row setting-checkbox"],
  ["src/features/training-session/components/TrainingDetailsPanel.tsx", "ui-choice-row cancel-training-toggle"],
  ["src/features/training-blocks/TrainingBlockEditor.tsx", "ui-choice-row training-block-active-toggle"],
  ["src/features/exercise-catalog/ExerciseEditor.tsx", "ui-choice-row exercise-active-toggle"],
];
for (const [path, marker] of choiceContracts) {
  const source = await read(path);
  assert.ok(source.includes(marker), `${path} muss die gemeinsame Auswahlzeile verwenden.`);
}

console.log(`UI-Control-Standard erfolgreich: gemeinsame Editorheader, Suchfelder, 42/38/40-Geometrie, semantische Iconaktionen, Tabs/Segmentauswahl und ${labeledFieldCount} integrierte Formularfelder sind zentral abgesichert.`);
