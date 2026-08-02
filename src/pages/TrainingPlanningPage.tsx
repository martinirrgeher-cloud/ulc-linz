import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Dumbbell,
  ListChecks,
  Users,
} from "lucide-react";
import { EditLockNotice } from "@/components/collaboration/EditLockNotice";
import { RemoteChangeNotice } from "@/components/collaboration/RemoteChangeNotice";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import {
  collaborationVersionsDiffer,
  isCollaborationConflictError,
} from "@/features/collaboration/conflicts";
import { useEditLock } from "@/features/collaboration/useEditLock";
import { useOrganizationRealtime } from "@/features/collaboration/useOrganizationRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import {
  loadTrainingPlan,
  loadTrainingPlanningOverview,
  saveTrainingPlan,
} from "@/features/training-planning/api";
import { TrainingPlanImportDialog } from "@/features/training-planning/TrainingPlanImportDialog";
import { TrainingPlanEditor } from "@/features/training-planning/TrainingPlanEditor";
import {
  createEmptyTrainingPlanInput,
  trainingPlanToImportedInput,
  trainingPlanToInput,
  type TrainingPlan,
  type TrainingPlanInput,
  type TrainingPlanningData,
} from "@/features/training-planning/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateKey(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const parsed = new Date(year, month - 1, day);

  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
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
  return diagnosticErrorMessage(error, "Ein unbekannter Fehler ist aufgetreten.", "training_planning");
}

const TRAINING_PLAN_REALTIME_TABLES = ["athlete_training_plans"] as const;

const EMPTY_DATA: TrainingPlanningData = {
  groups: [],
  athletes: [],
  blocks: [],
  exercises: [],
  plans: [],
};

export function TrainingPlanningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { appContext, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id ?? null;
  const canEdit = canEditModule("training_planning");

  const [trainingDate, setTrainingDate] = useState(() => {
    const requestedDate = searchParams.get("date");
    return isDateKey(requestedDate) ? requestedDate : localDateKey();
  });
  const [groupId, setGroupId] = useState(() => searchParams.get("group") ?? "");
  const [athleteId, setAthleteId] = useState(() => searchParams.get("athlete") ?? "");
  const [data, setData] = useState<TrainingPlanningData>(EMPTY_DATA);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [values, setValues] = useState<TrainingPlanInput>(() => createEmptyTrainingPlanInput(trainingDate));
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [remoteChangePending, setRemoteChangePending] = useState(false);
  const [remoteSyncBusy, setRemoteSyncBusy] = useState(false);
  const localWriteUntilRef = useRef(0);

  const planLock = useEditLock({
    organizationId,
    entityType: "training_plan",
    entityId: plan?.id,
    expectedUpdatedAt: plan?.updatedAt ?? null,
    enabled: canEdit && Boolean(plan?.id),
  });
  const editorCanEdit = canEdit && (!plan?.id || planLock.isEditable);

  useEffect(() => {
    if (collaborationVersionsDiffer(plan?.updatedAt, planLock.recordVersion)) {
      setRemoteChangePending(true);
    }
  }, [plan?.updatedAt, planLock.recordVersion]);

  function updatePlanningUrl(nextDate: string, nextGroupId: string, nextAthleteId: string) {
    const next = new URLSearchParams();
    next.set("date", nextDate);
    if (nextGroupId) next.set("group", nextGroupId);
    if (nextAthleteId) next.set("athlete", nextAthleteId);
    setSearchParams(next, { replace: true });
  }

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

  const handleRealtimeRefresh = useCallback((refresh: {
    reason: "database" | "reconnected";
    changes: Array<{ table: string; recordId: string | null }>;
  }) => {
    if (Date.now() < localWriteUntilRef.current || busy || remoteSyncBusy) return;
    const currentChanged = Boolean(plan?.id) && (
      refresh.reason === "reconnected"
      || refresh.changes.some((change) => (
        change.table === "athlete_training_plans" && change.recordId === plan?.id
      ))
    );
    if (currentChanged) {
      setRemoteChangePending(true);
      return;
    }
    void refreshOverview(trainingDate, groupId || null);
  }, [busy, groupId, plan?.id, refreshOverview, remoteSyncBusy, trainingDate]);

  useOrganizationRealtime({
    organizationId,
    tables: TRAINING_PLAN_REALTIME_TABLES,
    onRefresh: handleRealtimeRefresh,
  });

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
          if (preferred) {
            setGroupId(preferred.id);
            updatePlanningUrl(trainingDate, preferred.id, "");
          }
          return;
        }

        if (athleteId) {
          if (next.athletes.some((athlete) => athlete.id === athleteId)) {
            void openAthletePlan(athleteId, next);
          } else {
            setAthleteId("");
            setPlan(null);
            setValues(createEmptyTrainingPlanInput(trainingDate));
            setDirty(false);
            updatePlanningUrl(trainingDate, groupId, "");
          }
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
    setRemoteChangePending(false);

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
    updatePlanningUrl(trainingDate, groupId, nextAthleteId);
    await openAthletePlan(nextAthleteId);
  }

  async function handleDateChange(nextDate: string) {
    if (nextDate === trainingDate || !guardUnsaved()) return;
    setTrainingDate(nextDate);
    setAthleteId("");
    updatePlanningUrl(nextDate, groupId, "");
    setPlan(null);
    setValues(createEmptyTrainingPlanInput(nextDate));
    setDirty(false);
    setSuccess(null);
    setRemoteChangePending(false);
    setOverviewOpen(false);
  }

  async function handleGroupChange(nextGroupId: string) {
    if (nextGroupId === groupId || !guardUnsaved()) return;
    setGroupId(nextGroupId);
    setAthleteId("");
    updatePlanningUrl(trainingDate, nextGroupId, "");
    setPlan(null);
    setValues(createEmptyTrainingPlanInput(trainingDate));
    setDirty(false);
    setSuccess(null);
    setRemoteChangePending(false);
    setOverviewOpen(false);
  }

  async function applyRemoteServerState(keepDraft: boolean) {
    if (!organizationId || !plan?.id) {
      setRemoteChangePending(false);
      await refreshOverview(trainingDate, groupId || null);
      return;
    }

    setRemoteSyncBusy(true);
    setError(null);
    if (!keepDraft) setPlanLoading(true);

    try {
      const [latestPlan, overview] = await Promise.all([
        loadTrainingPlan(organizationId, plan.id),
        loadTrainingPlanningOverview(organizationId, trainingDate, groupId || null),
      ]);
      setData(overview);
      setPlan(latestPlan);
      if (keepDraft) await planLock.retry();
      planLock.acceptRecordVersion(latestPlan.updatedAt);
      if (!keepDraft) {
        setValues(trainingPlanToInput(latestPlan));
        setDirty(false);
      } else if (dirty) {
        setSuccess("Die aktuelle Serverversion wurde übernommen. Deine Planeingaben bleiben erhalten.");
      }
      setRemoteChangePending(false);
    } catch (remoteError) {
      setError(errorMessage(remoteError));
    } finally {
      setPlanLoading(false);
      setRemoteSyncBusy(false);
    }
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
      const editLock = planLock.getWriteGuard();
      localWriteUntilRef.current = Date.now() + 3_000;
      const planId = await saveTrainingPlan(
        organizationId,
        plan?.id ?? null,
        athleteId,
        groupId,
        trainingDate,
        values,
        editLock,
      );
      const [loadedPlan, overview] = await Promise.all([
        loadTrainingPlan(organizationId, planId),
        refreshOverview(trainingDate, groupId),
      ]);
      setPlan(loadedPlan);
      planLock.acceptRecordVersion(loadedPlan.updatedAt);
      setValues(trainingPlanToInput(loadedPlan));
      setDirty(false);
      setRemoteChangePending(false);
      setSuccess("Der Trainingsplan wurde gespeichert.");
      if (overview) setData(overview);
    } catch (saveError) {
      if (isCollaborationConflictError(saveError)) setRemoteChangePending(true);
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function handleImport(sourcePlan: TrainingPlan) {
    setValues(trainingPlanToImportedInput(sourcePlan));
    setDirty(true);
    setImportOpen(false);
    setError(null);
    setSuccess(`Plan von ${sourcePlan.athleteName} am ${dateLabel(sourcePlan.trainingDate)} importiert. Bitte speichern.`);
  }

  return (
    <section className="training-planning-page">
      <div className="training-planning-heading">
        <div>
          <p className="eyebrow">Trainingsplanung</p>
          <h1>Athletenpläne</h1>
          <p>Plan direkt beim Athleten erstellen oder von einem vorhandenen Trainingstag importieren.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <RemoteChangeNotice
        visible={remoteChangePending}
        busy={busy || remoteSyncBusy}
        onLoadServer={() => applyRemoteServerState(false)}
        onKeepDraft={() => applyRemoteServerState(true)}
      />

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
          <button
            type="button"
            className="training-planning-day-toggle"
            onClick={() => setOverviewOpen((current) => !current)}
            aria-expanded={overviewOpen}
          >
            <span>
              <strong>Pläne am {dateLabel(trainingDate)}</strong>
              <small>{selectedGroup?.shortName || selectedGroup?.name}</small>
            </span>
            <span>{data.plans.length} / {data.athletes.length} geplant</span>
            {overviewOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>

          {overviewOpen && (data.plans.length > 0 ? (
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
          ))}
        </section>
      )}

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Trainingsplanung wird geladen …</div>
      ) : !groupId ? (
        <div className="empty-state"><Users aria-hidden="true" /><h2>Keine Trainingsgruppe vorhanden</h2><p>Lege zuerst eine aktive Trainingsgruppe an.</p></div>
      ) : data.athletes.length === 0 ? (
        <div className="empty-state"><Users aria-hidden="true" /><h2>Keine Athleten in dieser Gruppe</h2><p>Ordne der Trainingsgruppe zuerst aktive Athleten zu.</p></div>
      ) : !athleteId ? (
        <div className="empty-state"><Dumbbell aria-hidden="true" /><h2>Referenzathleten auswählen</h2><p>Erstelle einen neuen Plan oder importiere einen vorhandenen Athletenplan.</p></div>
      ) : planLoading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Trainingsplan wird geladen …</div>
      ) : selectedAthlete ? (
        <TrainingPlanEditor
          key={plan?.id ?? `new-${athleteId}-${groupId}-${trainingDate}`}
          plan={plan}
          athleteName={`${selectedAthlete.firstName} ${selectedAthlete.lastName}`}
          groupName={selectedGroup?.shortName || selectedGroup?.name || "Trainingsgruppe"}
          trainingDateLabel={dateLabel(trainingDate)}
          organizationId={organizationId ?? ""}
          groups={data.groups}
          values={values}
          blocks={data.blocks}
          exercises={data.exercises}
          canEdit={editorCanEdit}
          busy={busy}
          lockNotice={plan?.id ? <EditLockNotice lock={planLock} /> : null}
          dirty={dirty}
          onChange={handleValuesChange}
          onSave={handleSave}
          onImport={() => setImportOpen(true)}
        />
      ) : null}

      {importOpen && organizationId && selectedAthlete && (
        <TrainingPlanImportDialog
          organizationId={organizationId}
          groupId={groupId}
          targetAthleteId={selectedAthlete.id}
          targetDate={trainingDate}
          busy={busy}
          onCancel={() => setImportOpen(false)}
          onConfirm={handleImport}
        />
      )}
    </section>
  );
}
