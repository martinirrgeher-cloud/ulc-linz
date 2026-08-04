import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Layers3, X } from "lucide-react";
import { loadExerciseUsage } from "@/features/exercise-catalog/api";
import type { Exercise, ExerciseUsageData } from "@/features/exercise-catalog/types";

export type ExerciseUsageDialogProps = {
  organizationId: string;
  exercise: Exercise;
  onClose: () => void;
};

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

export function ExerciseUsageDialog({ organizationId, exercise, onClose }: ExerciseUsageDialogProps) {
  const [usage, setUsage] = useState<ExerciseUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    void loadExerciseUsage(organizationId, exercise.id)
      .then((result) => {
        if (!disposed) setUsage(result);
      })
      .catch((loadError: unknown) => {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : "Die Verwendung konnte nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [exercise.id, organizationId]);

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
            {loading ? (
              <div className="management-loading"><div className="spinner" aria-hidden="true" />Verwendung wird geladen …</div>
            ) : error ? (
              <div className="alert error">{error}</div>
            ) : usage ? (
              <>
                <section>
                  <h3><Layers3 aria-hidden="true" /> Trainingsblöcke</h3>
                  {usage.blockUsages.length === 0 ? (
                    <p>Noch in keinem Trainingsblock verwendet.</p>
                  ) : (
                    <ul>
                      {usage.blockUsages.map((block) => (
                        <li key={block.id}>
                          <strong>{block.name}</strong>{block.isActive ? "" : " · inaktiv"}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h3><ClipboardList aria-hidden="true" /> Trainingspläne</h3>
                  {usage.planUsages.length === 0 ? (
                    <p>Noch in keinem Trainingsplan verwendet.</p>
                  ) : (
                    <ul>
                      {usage.planUsages.map((plan) => (
                        <li key={`${plan.id}-${plan.viaBlockName ?? "direct"}`}>
                          <strong>{plan.title}</strong>
                          <span> · <CalendarDays aria-hidden="true" /> {formatDate(plan.trainingDate)}</span>
                          {plan.viaBlockName && <small> · über Block „{plan.viaBlockName}“</small>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {usage.lastUsedAt && <p><strong>Letzte Verwendung:</strong> {formatDate(usage.lastUsedAt)}</p>}
              </>
            ) : null}
          </div>
        </div>

        <footer className="exercise-editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Schließen</button>
        </footer>
      </section>
    </div>
  );
}
