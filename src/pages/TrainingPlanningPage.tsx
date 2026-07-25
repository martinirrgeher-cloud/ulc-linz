import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Copy, Dumbbell, ListChecks, Users } from "lucide-react";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import { useAuth } from "@/features/auth/AuthContext";
import {
  copyTrainingPlan,
  loadTrainingPlan,
  loadTrainingPlanningOverview,
  saveTrainingPlan,
} from "@/features/training-planning/api";
import { TrainingPlanCopyDialog } from "@/features/training-planning/TrainingPlanCopyDialog";
import { TrainingPlanEditor } from "@/features/training-planning/TrainingPlanEditor";
import {
  createEmptyTrainingPlanInput,
  trainingPlanToInput,
  type TrainingPlan,
  type TrainingPlanInput,
  type TrainingPlanningData,
} from "@/features/training-planning/types";

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
}

const EMPTY_DATA: TrainingPlanningData = {
  groups: [],
  athletes: [],
  blocks: [],
  exercises: [],
  plans: [],
};

export function TrainingPlanningPage() {
  const { appContext, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id ?? null;
  const canEdit = canEditModule("training_planning");

  const [trainingDate, setTrainingDate] = useState(localDateKey);
  const [groupId, setGroupId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [data, setData] = useState<TrainingPlanningData>(EMPTY_DATA);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [values, setValues] = useState<TrainingPlanInput>(() => createEmptyTrainingPlanInput(localDateKey()));
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedGroup = data.groups.find((group) => group.id === groupId) ?? null;
  const selectedAthlete = data.athletes.find((athlete) => athlete.id === athleteId) ?? null;
  const planByAthlete = useMemo(
    () => new Map(data.plans.map((item) => [item.athleteId, item])),
    [data.plans],
  );

  const guardUnsaved = useCallback(() => {
    if (!dirty) return true;
    return window.confirm("Die noch nicht gespeicherten Änderungen am Trainingsplan verwerfen?");
  }, [dirty]);

  useNavigationGuard(dirty ? guardUnsaved : null);

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const refreshOverview = useCallback(async (
    activeDate: string,
    activeGroupId: string | null,
  ): Promise<TrainingPlanningData | null> => {
    if (!organizationId) return null;
    const next = await loadTrainingPlanningOverview(organizationId, activeDate, activeGroupId);
    setData(next);
    return next;
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setLoading(true);
    setError(null);

    void loadTrainingPlanningOverview(organizationId, trainingDate, groupId || null)
      .then((next) => {
        if (!active) return;
        setData(next);
        if (!groupId && next.groups.length > 0) {
          const preferred = next.groups.find((group) => group.isPerformanceGroup) ?? next.groups[0];
          if (preferred) setGroupId(preferred.id);
        }
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [groupId, organizationId, trainingDate]);

  async function openAthletePlan(nextAthleteId: string, overview = data) {
    if (!organizationId) return;
    setAthleteId(nextAthleteId);
    setError(null);
    setSuccess(null);

    const summary = overview.plans.find((item) => item.athleteId === nextAthleteId);
    if (!summary) {
      setPlan(null);
      setValues(createEmptyTrainingPlanInput(trainingDate));
      setDirty(false);
      return;
    }

    setPlan(null);
    setValues(createEmptyTrainingPlanInput(trainingDate));
    setDirty(false);
    setPlanLoading(true);
    try {
      const loadedPlan = await loadTrainingPlan(organizationId, summary.id);
      setPlan(loadedPlan);
      setValues(trainingPlanToInput(loadedPlan));
      setDirty(false);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleAthleteChange(nextAthleteId: string) {
    if (nextAthleteId === athleteId) return;
    if (!guardUnsaved()) return;
    await openAthletePlan(nextAthleteId);
  }

  async function handleDateChange(nextDate: string) {
    if (nextDate === trainingDate || !guardUnsaved()) return;
    setTrainingDate(nextDate);
    setAthleteId("");
    setPlan(null);
    setValues(createEmptyTrainingPlanInput(nextDate));
    setDirty(false);
    setSuccess(null);
  }

  async function handleGroupChange(nextGroupId: string) {
    if (nextGroupId === groupId || !guardUnsaved()) return;
    setGroupId(nextGroupId);
    setAthleteId("");
    setPlan(null);
    setValues(createEmptyTrainingPlanInput(trainingDate));
    setDirty(false);
    setSuccess(null);
  }

  function handleValuesChange(next: TrainingPlanInput) {
    setValues(next);
    setDirty(true);
    setSuccess(null);
  }

  async function handleSave() {
    if (!organizationId || !athleteId || !groupId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const planId = await saveTrainingPlan(
        organizationId,
        plan?.id ?? null,
        athleteId,
        groupId,
        trainingDate,
        values,
      );
      const [loadedPlan, overview] = await Promise.all([
        loadTrainingPlan(organizationId, planId),
        refreshOverview(trainingDate, groupId),
      ]);
      setPlan(loadedPlan);
      setValues(trainingPlanToInput(loadedPlan));
      setDirty(false);
      setSuccess("Der Trainingsplan wurde gespeichert.");
      if (overview) setData(overview);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(targetAthleteIds: string[], overwriteExisting: boolean) {
    if (!organizationId || !plan) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await copyTrainingPlan(
        organizationId,
        plan.id,
        targetAthleteIds,
        overwriteExisting,
      );
      const overview = await refreshOverview(trainingDate, groupId);
      if (overview) setData(overview);
      setCopyOpen(false);

      const copiedCount = result.copied.length;
      const skippedCount = result.skipped.length;
      setSuccess(
        `${copiedCount} Plan${copiedCount === 1 ? "" : "e"} kopiert${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ""}.`,
      );
    } catch (copyError) {
      setError(errorMessage(copyError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="training-planning-page">
      <div className="training-planning-heading">
        <div>
          <p className="eyebrow">Trainingsplanung</p>
          <h1>Athletenpläne</h1>
          <p>Plan bei einem Referenzathleten erstellen und anschließend auf Trainingskollegen kopieren.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <section className="training-planning-selection" aria-label="Trainingstag und Athlet auswählen">
        <label>
          <span><CalendarDays aria-hidden="true" />Datum</span>
          <input
            type="date"
            value={trainingDate}
            onChange={(event) => void handleDateChange(event.target.value)}
            disabled={loading || busy}
          />
        </label>
        <label>
          <span><Users aria-hidden="true" />Trainingsgruppe</span>
          <select
            value={groupId}
            onChange={(event) => void handleGroupChange(event.target.value)}
            disabled={loading || busy || data.groups.length === 0}
          >
            {data.groups.length === 0 && <option value="">Keine aktive Gruppe</option>}
            {data.groups.map((group) => (
              <option value={group.id} key={group.id}>
                {group.shortName || group.name}{group.isPerformanceGroup ? " · Leistungsgruppe" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span><Dumbbell aria-hidden="true" />Athlet</span>
          <select
            value={athleteId}
            onChange={(event) => void handleAthleteChange(event.target.value)}
            disabled={loading || busy || !groupId || data.athletes.length === 0}
          >
            <option value="">Athlet auswählen</option>
            {data.athletes.map((athlete) => (
              <option value={athlete.id} key={athlete.id}>
                {athlete.firstName} {athlete.lastName}{planByAthlete.has(athlete.id) ? " · Plan vorhanden" : ""}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!loading && groupId && (
        <section className="training-planning-day-overview">
          <header>
            <div>
              <h2>Pläne am {dateLabel(trainingDate)}</h2>
              <small>{selectedGroup?.shortName || selectedGroup?.name}</small>
            </div>
            <span>{data.plans.length} von {data.athletes.length} Athleten geplant</span>
          </header>

          {data.plans.length > 0 ? (
            <div className="training-plan-summary-list">
              {data.plans.map((summary) => (
                <button
                  type="button"
                  className={summary.athleteId === athleteId ? "active" : ""}
                  key={summary.id}
                  onClick={() => void handleAthleteChange(summary.athleteId)}
                >
                  <span>
                    <strong>{summary.athleteName}</strong>
                    <small>{summary.title}</small>
                    {summary.copiedFromAthleteName && <em><Copy aria-hidden="true" />von {summary.copiedFromAthleteName}</em>}
                  </span>
                  <span className="training-plan-summary-values">
                    <small><ListChecks aria-hidden="true" />{summary.exerciseCount}</small>
                    <small><Clock3 aria-hidden="true" />{summary.totalMinutes} min</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="training-planning-no-plans">Für diesen Tag wurden noch keine Athletenpläne gespeichert.</p>
          )}
        </section>
      )}

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Trainingsplanung wird geladen …</div>
      ) : !groupId ? (
        <div className="empty-state"><Users aria-hidden="true" /><h2>Keine Trainingsgruppe vorhanden</h2><p>Lege zuerst eine aktive Trainingsgruppe an.</p></div>
      ) : data.athletes.length === 0 ? (
        <div className="empty-state"><Users aria-hidden="true" /><h2>Keine Athleten in dieser Gruppe</h2><p>Ordne der Trainingsgruppe zuerst aktive Athleten zu.</p></div>
      ) : !athleteId ? (
        <div className="empty-state"><Dumbbell aria-hidden="true" /><h2>Referenzathleten auswählen</h2><p>Erstelle den Plan bei einem Athleten und kopiere ihn anschließend auf die passenden Trainingskollegen.</p></div>
      ) : planLoading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Trainingsplan wird geladen …</div>
      ) : selectedAthlete ? (
        <TrainingPlanEditor
          key={plan?.id ?? `new-${athleteId}-${groupId}-${trainingDate}`}
          plan={plan}
          athleteName={`${selectedAthlete.firstName} ${selectedAthlete.lastName}`}
          groupName={selectedGroup?.shortName || selectedGroup?.name || "Trainingsgruppe"}
          trainingDateLabel={dateLabel(trainingDate)}
          values={values}
          blocks={data.blocks}
          exercises={data.exercises}
          canEdit={canEdit}
          busy={busy}
          dirty={dirty}
          onChange={handleValuesChange}
          onSave={handleSave}
          onCopy={() => setCopyOpen(true)}
        />
      ) : null}

      {copyOpen && plan && selectedAthlete && (
        <TrainingPlanCopyDialog
          sourceAthleteId={selectedAthlete.id}
          sourceAthleteName={`${selectedAthlete.firstName} ${selectedAthlete.lastName}`}
          athletes={data.athletes}
          plans={data.plans}
          busy={busy}
          onCancel={() => setCopyOpen(false)}
          onConfirm={handleCopy}
        />
      )}
    </section>
  );
}
