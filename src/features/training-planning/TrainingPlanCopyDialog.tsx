import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Search, X } from "lucide-react";
import type {
  PlanningAthlete,
  TrainingPlanSummary,
} from "@/features/training-planning/types";

export type TrainingPlanCopyDialogProps = {
  sourceAthleteId: string;
  sourceAthleteName: string;
  athletes: PlanningAthlete[];
  plans: TrainingPlanSummary[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (athleteIds: string[], overwriteExisting: boolean) => Promise<void>;
};

export function TrainingPlanCopyDialog({
  sourceAthleteId,
  sourceAthleteName,
  athletes,
  plans,
  busy,
  onCancel,
  onConfirm,
}: TrainingPlanCopyDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const existingPlanByAthlete = useMemo(
    () => new Map(plans.map((plan) => [plan.athleteId, plan])),
    [plans],
  );

  const candidates = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("de");
    return athletes
      .filter((athlete) => athlete.id !== sourceAthleteId)
      .filter((athlete) => !normalized || `${athlete.firstName} ${athlete.lastName}`.toLocaleLowerCase("de").includes(normalized))
      .sort((left, right) => `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
        "de",
        { sensitivity: "base" },
      ));
  }, [athletes, search, sourceAthleteId]);

  function toggleAthlete(athleteId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(athleteId)) next.delete(athleteId);
      else next.add(athleteId);
      return next;
    });
  }

  async function handleConfirm() {
    setError(null);
    if (selectedIds.size === 0) {
      setError("Bitte mindestens einen Trainingskollegen auswählen.");
      return;
    }
    await onConfirm([...selectedIds], overwriteExisting);
  }

  const selectedWithExistingPlan = [...selectedIds].filter((athleteId) => existingPlanByAthlete.has(athleteId));

  return (
    <div className="training-plan-copy-backdrop" role="presentation">
      <section className="training-plan-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="training-plan-copy-title">
        <header>
          <div>
            <p className="eyebrow">Plan verteilen</p>
            <h2 id="training-plan-copy-title">Plan von {sourceAthleteName} kopieren</h2>
            <small>Jeder Zielathlet erhält einen eigenständigen Plan.</small>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} disabled={busy} aria-label="Kopieren schließen">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="training-plan-copy-body">
          {error && <div className="alert error compact-alert">{error}</div>}

          <label className="training-plan-copy-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Trainingskollegen suchen"
            />
          </label>

          <div className="training-plan-copy-list">
            {candidates.map((athlete) => {
              const existingPlan = existingPlanByAthlete.get(athlete.id);
              return (
                <label key={athlete.id} className={existingPlan ? "has-plan" : ""}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(athlete.id)}
                    onChange={() => toggleAthlete(athlete.id)}
                    disabled={busy}
                  />
                  <span>
                    <strong>{athlete.firstName} {athlete.lastName}</strong>
                    <small>{existingPlan ? `Plan vorhanden: ${existingPlan.title}` : "Noch kein Plan für diesen Tag"}</small>
                  </span>
                </label>
              );
            })}
            {candidates.length === 0 && (
              <p className="training-plan-copy-empty">Keine weiteren aktiven Athleten in dieser Gruppe gefunden.</p>
            )}
          </div>

          <label className="training-plan-overwrite-option">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(event) => setOverwriteExisting(event.target.checked)}
              disabled={busy}
            />
            <span>
              <strong>Bestehende Pläne überschreiben</strong>
              <small>Standardmäßig werden Athleten mit vorhandenem Plan übersprungen.</small>
            </span>
          </label>

          {selectedWithExistingPlan.length > 0 && (
            <div className={`training-plan-copy-warning ${overwriteExisting ? "danger" : ""}`}>
              <AlertTriangle aria-hidden="true" />
              <span>
                {overwriteExisting
                  ? `${selectedWithExistingPlan.length} bestehende${selectedWithExistingPlan.length === 1 ? "r Plan wird" : " Pläne werden"} vollständig ersetzt.`
                  : `${selectedWithExistingPlan.length} ausgewählte${selectedWithExistingPlan.length === 1 ? "r Athlet wird" : " Athleten werden"} wegen vorhandener Pläne übersprungen.`}
              </span>
            </div>
          )}
        </div>

        <footer>
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Abbrechen</button>
          <button type="button" className="primary-button" onClick={() => void handleConfirm()} disabled={busy || candidates.length === 0}>
            <Copy aria-hidden="true" />{busy ? "Wird kopiert …" : `Auf ${selectedIds.size} Athleten kopieren`}
          </button>
        </footer>
      </section>
    </div>
  );
}
