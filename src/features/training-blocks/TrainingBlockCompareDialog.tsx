import { GitCompareArrows, X } from "lucide-react";
import type { ExerciseTrainingGroup } from "@/features/exercise-catalog/types";
import type { TrainingBlock } from "@/features/training-blocks/types";

export type TrainingBlockCompareDialogProps = {
  left: TrainingBlock;
  right: TrainingBlock;
  groups: ExerciseTrainingGroup[];
  onClose: () => void;
};

function formatDate(value: string | null): string {
  if (!value) return "Noch nie";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

function parameterSummary(item: TrainingBlock["items"][number]): string {
  return item.parameters
    .map((parameter) => {
      const value = item.parameterValues[parameter.key] ?? parameter.defaultValue;
      return value ? `${parameter.label}: ${value}${parameter.unit ? ` ${parameter.unit}` : ""}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

function groupNames(block: TrainingBlock, groups: ExerciseTrainingGroup[]): string {
  if (block.groupIds.length === 0) return "Vereinsweit";
  const byId = new Map(groups.map((group) => [group.id, group.shortName || group.name]));
  return block.groupIds.map((id) => byId.get(id) ?? "Unbekannte Gruppe").join(", ");
}

function canonicalValues(values: Record<string, string>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(values).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))));
}

function differences(left: TrainingBlock, right: TrainingBlock): string[] {
  const result: string[] = [];
  if ((left.goal ?? "") !== (right.goal ?? "")) result.push("Unterschiedliches Trainingsziel");
  if ((left.description ?? "") !== (right.description ?? "")) result.push("Unterschiedliche Beschreibung");
  if (left.isActive !== right.isActive) result.push(`Status: ${left.isActive ? "aktiv" : "inaktiv"} ↔ ${right.isActive ? "aktiv" : "inaktiv"}`);
  if ([...left.groupIds].sort().join(",") !== [...right.groupIds].sort().join(",")) {
    result.push("Unterschiedliche geeignete Trainingsgruppen");
  }
  if (left.estimatedMinutes !== right.estimatedMinutes) {
    result.push(`Dauer: ${left.estimatedMinutes ?? "–"} min ↔ ${right.estimatedMinutes ?? "–"} min`);
  }
  if (left.items.length !== right.items.length) {
    result.push(`Übungsanzahl: ${left.items.length} ↔ ${right.items.length}`);
  }

  const length = Math.max(left.items.length, right.items.length);
  for (let index = 0; index < length; index += 1) {
    const leftItem = left.items[index];
    const rightItem = right.items[index];
    if (!leftItem && rightItem) {
      result.push(`Nur rechts an Position ${index + 1}: ${rightItem.exerciseName}`);
      continue;
    }
    if (leftItem && !rightItem) {
      result.push(`Nur links an Position ${index + 1}: ${leftItem.exerciseName}`);
      continue;
    }
    if (!leftItem || !rightItem) continue;
    if (leftItem.exerciseId !== rightItem.exerciseId) {
      result.push(`Position ${index + 1}: ${leftItem.exerciseName} ↔ ${rightItem.exerciseName}`);
      continue;
    }
    const leftParameters = canonicalValues(leftItem.parameterValues);
    const rightParameters = canonicalValues(rightItem.parameterValues);
    if (leftParameters !== rightParameters || leftItem.note !== rightItem.note) {
      result.push(`Andere Werte bei ${leftItem.exerciseName} (Position ${index + 1})`);
    }
  }
  return result;
}

export function TrainingBlockCompareDialog({ left, right, groups, onClose }: TrainingBlockCompareDialogProps) {
  const changes = differences(left, right);

  return (
    <div className="training-block-editor-backdrop" role="presentation">
      <section className="training-block-editor" role="dialog" aria-modal="true" aria-labelledby="block-compare-title">
        <header className="training-block-editor-header">
          <div>
            <p className="eyebrow">Trainingsblöcke</p>
            <h2 id="block-compare-title"><GitCompareArrows aria-hidden="true" /> Vergleich</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Dialog schließen"><X aria-hidden="true" /></button>
        </header>

        <div className="training-block-editor-form">
          <div className="training-block-editor-panel">
            <div className="training-block-filter-grid">
              {[left, right].map((block) => (
                <section key={block.id}>
                  <h3>{block.name}</h3>
                  <p>{block.goal || "Kein Trainingsziel hinterlegt"}</p>
                  <p><strong>Dauer:</strong> {block.estimatedMinutes ? `${block.estimatedMinutes} min` : "nicht festgelegt"}</p>
                  <p><strong>Geeignet für:</strong> {groupNames(block, groups)}</p>
                  <p><strong>Letzte Nutzung:</strong> {formatDate(block.lastUsedAt)}</p>
                  <p><strong>Versionen:</strong> {block.versionCount}</p>
                  <ol>
                    {block.items.map((item) => (
                      <li key={item.id}>
                        <strong>{item.exerciseName}</strong>
                        {!item.exerciseIsActive && " · inaktiv"}
                        {parameterSummary(item) && <small> · {parameterSummary(item)}</small>}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>

            <section>
              <h3>Unterschiede</h3>
              {changes.length === 0 ? (
                <div className="alert success">Die beiden Blöcke sind in Reihenfolge und Belastungswerten gleich.</div>
              ) : (
                <ul>
                  {changes.map((change) => <li key={change}>{change}</li>)}
                </ul>
              )}
            </section>
          </div>
        </div>

        <footer className="training-block-editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Schließen</button>
        </footer>
      </section>
    </div>
  );
}
