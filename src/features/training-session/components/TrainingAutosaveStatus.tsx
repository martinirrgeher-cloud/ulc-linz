import {
  AlertTriangle,
  Clock3,
  CloudCheck,
  RefreshCw,
} from "lucide-react";
import { formatSavedAt } from "@/features/training-session/core";

export type TrainingAutoSaveState = "idle" | "pending" | "saving" | "saved" | "error";

type TrainingAutosaveStatusProps = {
  state: TrainingAutoSaveState;
  dirty: boolean;
  forceCreateSpecial: boolean;
  updatedAt: string | null;
  onRetry: () => void;
};

export function TrainingAutosaveStatus({
  state,
  dirty,
  forceCreateSpecial,
  updatedAt,
  onRetry,
}: TrainingAutosaveStatusProps) {
  return (
    <div className={`training-autosave-status ${state}`} aria-live="polite">
      {state === "error" ? (
        <>
          <AlertTriangle aria-hidden="true" />
          <span>Speichern fehlgeschlagen</span>
          <button type="button" className="text-button" onClick={onRetry}>
            Erneut versuchen
          </button>
        </>
      ) : state === "saving" ? (
        <>
          <RefreshCw className="spin-icon" aria-hidden="true" />
          <span>Wird gespeichert …</span>
        </>
      ) : state === "pending" || dirty || forceCreateSpecial ? (
        <>
          <Clock3 aria-hidden="true" />
          <span>Wird gleich gespeichert …</span>
        </>
      ) : updatedAt ? (
        <>
          <CloudCheck aria-hidden="true" />
          <span>Gespeichert {formatSavedAt(updatedAt)}</span>
        </>
      ) : (
        <>
          <CloudCheck aria-hidden="true" />
          <span>Automatisches Speichern ist aktiv</span>
        </>
      )}
    </div>
  );
}
