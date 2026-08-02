import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Dumbbell, ListChecks, X } from "lucide-react";
import {
  loadTrainingPlan,
  loadTrainingPlanningOverview,
} from "@/features/training-planning/api";
import type {
  TrainingPlan,
  TrainingPlanSummary,
} from "@/features/training-planning/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
export type TrainingPlanImportDialogProps = {
  organizationId: string;
  groupId: string;
  targetAthleteId: string;
  targetDate: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (sourcePlan: TrainingPlan) => void;
};

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Ein unbekannter Fehler ist aufgetreten.", "training_plan.import");
}

export function TrainingPlanImportDialog({
  organizationId,
  groupId,
  targetAthleteId,
  targetDate,
  busy,
  onCancel,
  onConfirm,
}: TrainingPlanImportDialogProps) {
  const [sourceDate, setSourceDate] = useState(targetDate);
  const [plans, setPlans] = useState<TrainingPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedPlanId("");

    void loadTrainingPlanningOverview(organizationId, sourceDate, groupId)
      .then((overview) => {
        if (!active) return;
        const availablePlans = overview.plans
          .filter((plan) => !(sourceDate === targetDate && plan.athleteId === targetAthleteId))
          .sort((left, right) => left.athleteName.localeCompare(
            right.athleteName,
            "de",
            { sensitivity: "base" },
          ));
        setPlans(availablePlans);
        if (availablePlans.length === 1 && availablePlans[0]) {
          setSelectedPlanId(availablePlans[0].id);
        }
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [groupId, organizationId, sourceDate, targetAthleteId, targetDate]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  async function handleImport() {
    if (!selectedPlanId || importing || busy) return;
    setImporting(true);
    setError(null);
    try {
      const sourcePlan = await loadTrainingPlan(organizationId, selectedPlanId);
      onConfirm(sourcePlan);
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="training-plan-import-backdrop" role="presentation">
      <section className="training-plan-import-dialog" role="dialog" aria-modal="true" aria-labelledby="training-plan-import-title">
        <header>
          <div>
            <p className="eyebrow">Vorhandenen Plan verwenden</p>
            <h2 id="training-plan-import-title">Trainingsplan importieren</h2>
            <small>Trainingstag und Athlet auswählen.</small>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} disabled={busy || importing} aria-label="Import schließen">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="training-plan-import-body">
          {error && <div className="alert error compact-alert">{error}</div>}

          <div className="training-plan-import-selection">
            <label className="training-plan-field">
              <span><CalendarDays aria-hidden="true" />Trainingstag</span>
              <input
                type="date"
                value={sourceDate}
                onChange={(event) => setSourceDate(event.target.value)}
                disabled={loading || importing || busy}
              />
            </label>

            <label className="training-plan-field">
              <span><Dumbbell aria-hidden="true" />Athlet</span>
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                disabled={loading || importing || busy || plans.length === 0}
              >
                <option value="">Athlet mit Plan auswählen</option>
                {plans.map((plan) => (
                  <option value={plan.id} key={plan.id}>{plan.athleteName} · {plan.title}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="training-plan-import-status"><div className="spinner" aria-hidden="true" />Pläne werden geladen …</div>
          ) : plans.length === 0 ? (
            <p className="training-plan-import-empty">Für diesen Trainingstag gibt es in der ausgewählten Gruppe keinen anderen Athletenplan.</p>
          ) : selectedPlan ? (
            <div className="training-plan-import-preview">
              <strong>{selectedPlan.athleteName}</strong>
              <span>{selectedPlan.title}</span>
              <small><ListChecks aria-hidden="true" />{selectedPlan.exerciseCount} Übungen · {selectedPlan.totalMinutes} min</small>
            </div>
          ) : (
            <p className="training-plan-import-empty">Bitte einen Athletenplan auswählen.</p>
          )}

          <p className="training-plan-import-note">
            Der importierte Inhalt ersetzt den aktuell angezeigten Entwurf. In der Datenbank wird er erst mit „Speichern“ übernommen.
          </p>
        </div>

        <footer>
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy || importing}>Abbrechen</button>
          <button type="button" className="primary-button" onClick={() => void handleImport()} disabled={busy || importing || !selectedPlanId}>
            <Download aria-hidden="true" />{importing ? "Wird importiert …" : "Plan importieren"}
          </button>
        </footer>
      </section>
    </div>
  );
}
