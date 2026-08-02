import { CalendarDays, ClipboardList, Layers3, X } from "lucide-react";
import type { Exercise } from "@/features/exercise-catalog/types";

export type ExerciseUsageDialogProps = {
  exercise: Exercise;
  onClose: () => void;
};

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

export function ExerciseUsageDialog({ exercise, onClose }: ExerciseUsageDialogProps) {
  return (
    <div className="exercise-editor-backdrop" role="presentation">
      <section className="exercise-editor" role="dialog" aria-modal="true" aria-labelledby="exercise-usage-title">
        <header className="exercise-editor-header">
          <div>
            <p className="eyebrow">Verwendung</p>
            <h2 id="exercise-usage-title">{exercise.name}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Dialog schließen"><X aria-hidden="true" /></button>
        </header>

        <div className="exercise-editor-form">
          <div className="exercise-editor-panel">
            <section>
              <h3><Layers3 aria-hidden="true" /> Trainingsblöcke</h3>
              {exercise.blockUsages.length === 0 ? (
                <p>Noch in keinem Trainingsblock verwendet.</p>
              ) : (
                <ul>
                  {exercise.blockUsages.map((block) => (
                    <li key={block.id}>
                      <strong>{block.name}</strong>{block.isActive ? "" : " · inaktiv"}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3><ClipboardList aria-hidden="true" /> Trainingspläne</h3>
              {exercise.planUsages.length === 0 ? (
                <p>Noch in keinem Trainingsplan verwendet.</p>
              ) : (
                <ul>
                  {exercise.planUsages.map((plan) => (
                    <li key={`${plan.id}-${plan.viaBlockName ?? "direct"}`}>
                      <strong>{plan.title}</strong>
                      <span> · <CalendarDays aria-hidden="true" /> {formatDate(plan.trainingDate)}</span>
                      {plan.viaBlockName && <small> · über Block „{plan.viaBlockName}“</small>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {exercise.lastUsedAt && <p><strong>Letzte Verwendung:</strong> {formatDate(exercise.lastUsedAt)}</p>}
          </div>
        </div>

        <footer className="exercise-editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Schließen</button>
        </footer>
      </section>
    </div>
  );
}
