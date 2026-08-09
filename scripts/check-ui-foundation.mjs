import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(".");
const actionHeaderPath = path.join(projectRoot, "src", "components", "ui", "EditorActionHeader.tsx");
const stickyHeaderPath = path.join(projectRoot, "src", "components", "ui", "StickyEditorActions.tsx");
const editorShellPath = path.join(projectRoot, "src", "components", "ui", "EditorShell.tsx");
const legacyHeaderPath = path.join(projectRoot, "src", "features", "athletes", "StickyEditorActions.tsx");

for (const requiredPath of [actionHeaderPath, stickyHeaderPath, editorShellPath]) await access(requiredPath);

try {
  await access(legacyHeaderPath);
  assert.fail("StickyEditorActions darf nicht mehr featuregebunden unter features/athletes liegen.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const actionHeader = await readFile(actionHeaderPath, "utf8");
for (const marker of [
  'className="icon-button icon-button--save"',
  'className="icon-button"',
  "Hilfe für diese Seite",
  "saveTestId",
  "closeTestId",
]) {
  assert.ok(actionHeader.includes(marker), `Gemeinsamer EditorActionHeader verliert Vertragsmarker: ${marker}`);
}

for (const [label, relative] of [
  ["StickyEditorActions", "src/components/ui/StickyEditorActions.tsx"],
  ["EditorShell", "src/components/ui/EditorShell.tsx"],
]) {
  const source = await readFile(path.join(projectRoot, relative), "utf8");
  assert.ok(source.includes('from "@/components/ui/EditorActionHeader"'), `${label} muss den gemeinsamen EditorActionHeader verwenden.`);
  assert.ok(source.includes("<EditorActionHeader"), `${label} muss den gemeinsamen EditorActionHeader rendern.`);
}

const stickyHeader = await readFile(stickyHeaderPath, "utf8");
for (const marker of [
  'className="management-editor-sticky-header"',
  'saveTestId="editor-save"',
  'closeTestId="editor-close"',
]) {
  assert.ok(stickyHeader.includes(marker), `Gemeinsame Stammdaten-Aktionsleiste verliert Vertragsmarker: ${marker}`);
}

for (const relative of [
  "src/features/athletes/AthleteEditor.tsx",
  "src/features/athletes/TrainerEditor.tsx",
  "src/features/athletes/TrainingGroupEditor.tsx",
]) {
  const source = await readFile(path.join(projectRoot, relative), "utf8");
  assert.ok(
    source.includes('from "@/components/ui/StickyEditorActions"'),
    `${relative} muss die gemeinsame Editor-Aktionsleiste verwenden.`,
  );
  assert.equal(
    source.includes('from "@/features/athletes/StickyEditorActions"'),
    false,
    `${relative} darf keine featuregebundene Kopie der Aktionsleiste verwenden.`,
  );
}

console.log("UI-Skalierungsbasis erfolgreich: EditorActionHeader ist gemeinsamer Kern fuer Seiteneditoren und Stammdaten-Aktionsleisten.");
