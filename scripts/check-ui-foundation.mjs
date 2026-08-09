import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(".");
const sharedHeaderPath = path.join(projectRoot, "src", "components", "ui", "StickyEditorActions.tsx");
const legacyHeaderPath = path.join(projectRoot, "src", "features", "athletes", "StickyEditorActions.tsx");

await access(sharedHeaderPath);

try {
  await access(legacyHeaderPath);
  assert.fail("StickyEditorActions darf nicht mehr featuregebunden unter features/athletes liegen.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const sharedHeader = await readFile(sharedHeaderPath, "utf8");
for (const marker of [
  'className="management-editor-sticky-header"',
  'data-testid="editor-save"',
  'data-testid="editor-close"',
  'icon-button--save',
]) {
  assert.ok(sharedHeader.includes(marker), `Gemeinsame Editor-Aktionsleiste verliert Vertragsmarker: ${marker}`);
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

console.log("UI-Skalierungsbasis erfolgreich: gemeinsame Editor-Aktionsleiste liegt zentral unter components/ui.");
