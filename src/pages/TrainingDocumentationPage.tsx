import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Film,
  ListChecks,
  Play,
  RefreshCw,
  Users,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import {
  TRAINING_DOCUMENTATION_DRAFT_MAX_AGE_MS,
  trainingDocumentationDraftKey,
} from "@/lib/client-session-data";
import { useAuth } from "@/features/auth/AuthContext";
import {
  loadTrainingDocumentationDetail,
  loadTrainingDocumentationOverview,
  isTrainingDocumentationVersionConflict,
  loadTrainingDocumentationStatistics,
  saveTrainingDocumentation,
  startTrainingDocumentation,
} from "@/features/training-documentation/api";
import { TrainingDocumentationEditor } from "@/features/training-documentation/TrainingDocumentationEditor";
import { TrainingDocumentationStatisticsView } from "@/features/training-documentation/TrainingDocumentationStatistics";
import { TrainingDocumentationTeamOverview } from "@/features/training-documentation/TrainingDocumentationTeamOverview";
import {
  cloneDocumentationInput,
  type DocumentationPlanSummary,
  type SaveState,
  type TrainingDocumentationDetail,
  type TrainingDocumentationInput,
  type TrainingDocumentationOverview,
  type TrainingDocumentationStatistics,
} from "@/features/training-documentation/types";
import {
  addWeeks,
  formatWeekRange,
  isoWeekNumber,
  startOfIsoWeek,
} from "@/features/performance-registration/date";

type PageMode = "document" | "team" | "statistics";

function parsePageMode(value: string | null): PageMode {
  if (value === "team" || value === "statistics") return value;
  return "document";
}

const EMPTY_OVERVIEW: TrainingDocumentationOverview = {
  weekStart: startOfIsoWeek(new Date()),
  weekEnd: startOfIsoWeek(new Date()),
  currentRole: "athlete",
  ownAthleteId: null,
  canReview: false,
  groups: [],
  athletes: [],
  plans: [],
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
}

function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]!);
  const month = Number(match[2]!);
  const day = Number(match[3]!);
  const parsed = new Date(year, month - 1, day, 12, 0, 0);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" })
    .format(new Date(`${value}T12:00:00`));
}


type StoredDraft = {
  savedAt: string;
  expiresAt: string;
  conflictDetectedAt: string | null;
  value: TrainingDocumentationInput;
};

type QueuedDocumentationSave = {
  value: TrainingDocumentationInput;
  changeVersion: number;
  waiters: Array<(saved: boolean) => void>;
};

const VERSION_CONFLICT_NOTICE =
  "Die Trainingsdokumentation wurde inzwischen auf einem anderen Gerät geändert. "
  + "Dein lokaler Stand bleibt erhalten. Lade bewusst den aktuellen Serverstand, bevor du weiter speicherst.";

function readLocalDraft(organizationId: string, sessionId: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(trainingDocumentationDraftKey(organizationId, sessionId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<StoredDraft>;
    if (!draft.value || typeof draft.savedAt !== "string" || draft.value.sessionId !== sessionId) {
      window.localStorage.removeItem(trainingDocumentationDraftKey(organizationId, sessionId));
      return null;
    }

    const savedAt = Date.parse(draft.savedAt);
    const expiresAt = typeof draft.expiresAt === "string"
      ? Date.parse(draft.expiresAt)
      : savedAt + TRAINING_DOCUMENTATION_DRAFT_MAX_AGE_MS;
    if (!Number.isFinite(savedAt) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.localStorage.removeItem(trainingDocumentationDraftKey(organizationId, sessionId));
      return null;
    }

    return {
      savedAt: draft.savedAt,
      expiresAt: new Date(expiresAt).toISOString(),
      conflictDetectedAt: typeof draft.conflictDetectedAt === "string" ? draft.conflictDetectedAt : null,
      value: draft.value,
    };
  } catch {
    window.localStorage.removeItem(trainingDocumentationDraftKey(organizationId, sessionId));
    return null;
  }
}

function writeLocalDraft(
  organizationId: string,
  value: TrainingDocumentationInput,
  conflictDetected = false,
): void {
  const savedAt = new Date();
  const draft: StoredDraft = {
    savedAt: savedAt.toISOString(),
    expiresAt: new Date(savedAt.getTime() + TRAINING_DOCUMENTATION_DRAFT_MAX_AGE_MS).toISOString(),
    conflictDetectedAt: conflictDetected ? savedAt.toISOString() : null,
    value,
  };
  window.localStorage.setItem(
    trainingDocumentationDraftKey(organizationId, value.sessionId),
    JSON.stringify(draft),
  );
}

function clearLocalDraft(organizationId: string, sessionId: string): void {
  window.localStorage.removeItem(trainingDocumentationDraftKey(organizationId, sessionId));
}

function statusLabel(plan: DocumentationPlanSummary): string {
  if (plan.sessionStatus === "completed") return "Abgeschlossen";
  if (plan.sessionStatus === "partial") return "Teilweise";
  if (plan.sessionStatus === "aborted") return "Abgebrochen";
  if (plan.sessionStatus === "in_progress") return "In Arbeit";
  return "Noch nicht begonnen";
}

export function TrainingDocumentationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { appContext } = useAuth();
  const organizationId = appContext?.organization?.id ?? null;
  const [mode, setMode] = useState<PageMode>(() => parsePageMode(searchParams.get("view")));
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(dateFromKey(searchParams.get("date")) ?? new Date()));
  const [groupId, setGroupId] = useState(() => searchParams.get("group") ?? "");
  const [athleteId, setAthleteId] = useState(() => searchParams.get("athlete") ?? "");
  const [selectedPlanId, setSelectedPlanId] = useState(() => searchParams.get("plan") ?? "");
  const [overview, setOverview] = useState<TrainingDocumentationOverview>(EMPTY_OVERVIEW);
  const [detail, setDetail] = useState<TrainingDocumentationDetail | null>(null);
  const [sessionValue, setSessionValue] = useState<TrainingDocumentationInput | null>(null);
  const sessionValueRef = useRef<TrainingDocumentationInput | null>(null);
  const changeVersionRef = useRef(0);
  const saveQueueRef = useRef<QueuedDocumentationSave[]>([]);
  const inFlightSaveRef = useRef<QueuedDocumentationSave | null>(null);
  const saveRunnerRef = useRef<Promise<void> | null>(null);
  const serverUpdatedAtBySessionRef = useRef(new Map<string, string>());
  const conflictedSessionIdsRef = useRef(new Set<string>());
  const [versionConflict, setVersionConflict] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const defaultStatsFrom = useMemo(() => addDays(dateKey(), -90), []);
  const [statsFrom, setStatsFrom] = useState(defaultStatsFrom);
  const [statsTo, setStatsTo] = useState(() => dateKey());
  const [statistics, setStatistics] = useState<TrainingDocumentationStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => { sessionValueRef.current = sessionValue; }, [sessionValue]);

  const selectedGroup = overview.groups.find((group) => group.id === groupId) ?? null;
  const selectedAthlete = overview.athletes.find((athlete) => athlete.id === athleteId) ?? null;
  const isStaff = overview.currentRole === "admin" || overview.currentRole === "trainer";
  const athletePlans = useMemo(
    () => overview.plans.filter((plan) => plan.athleteId === athleteId).sort((left, right) => left.trainingDate.localeCompare(right.trainingDate)),
    [athleteId, overview.plans],
  );

  const guardUnsaved = useCallback(() => {
    if (!dirty || saveState === "saved") return true;
    return window.confirm("Die Trainingsdokumentation ist noch nicht mit dem Server synchronisiert. Trotzdem verlassen?");
  }, [dirty, saveState]);
  useNavigationGuard(dirty && saveState !== "saved" ? guardUnsaved : null);

  const updateUrl = useCallback((next: { group?: string; athlete?: string; plan?: string; view?: PageMode; date?: string }) => {
    const params = new URLSearchParams(searchParams);
    const entries: Array<[string, string | undefined]> = [
      ["group", next.group],
      ["athlete", next.athlete],
      ["plan", next.plan],
      ["view", next.view],
      ["date", next.date],
    ];
    for (const [key, value] of entries) {
      if (value === undefined) continue;
      if (value) params.set(key, value);
      else params.delete(key);
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadOverview = useCallback(async (activeWeek = weekStart, activeGroup = groupId || null, activeAthlete = athleteId || null) => {
    if (!organizationId) return null;
    const next = await loadTrainingDocumentationOverview(organizationId, activeWeek, activeGroup, activeAthlete);
    setOverview(next);
    return next;
  }, [athleteId, groupId, organizationId, weekStart]);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setLoading(true);
    setError(null);
    void loadTrainingDocumentationOverview(organizationId, weekStart, groupId || null, athleteId || null)
      .then((next) => {
        if (!active) return;
        setOverview(next);
        let nextGroupId = groupId;
        let nextAthleteId = athleteId;
        if (!nextGroupId && next.groups[0]) nextGroupId = next.groups[0].id;
        if (next.currentRole === "athlete" || next.currentRole === "parent") {
          nextAthleteId = next.ownAthleteId ?? "";
        } else if (!nextAthleteId) {
          nextAthleteId = next.athletes.find((athlete) => !nextGroupId || athlete.groupIds.includes(nextGroupId))?.id ?? "";
        }
        if (nextGroupId !== groupId) setGroupId(nextGroupId);
        if (nextAthleteId !== athleteId) setAthleteId(nextAthleteId);
        updateUrl({ group: nextGroupId, athlete: nextAthleteId });
      })
      .catch((loadError) => { if (active) setError(errorMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, weekStart, groupId, athleteId]);

  const loadPlan = useCallback(async (planId: string, skipGuard = false): Promise<boolean> => {
    if (!organizationId || !planId) return false;
    if (!skipGuard && !guardUnsaved()) return false;
    setSelectedPlanId(planId);
    updateUrl({ plan: planId, view: "document" });
    setMode("document");
    setDetailLoading(true);
    setError(null);
    setNotice(null);
    setVersionConflict(false);
    try {
      const next = await loadTrainingDocumentationDetail(organizationId, planId);
      setDetail(next);
      const linkedDate = dateFromKey(next.preview.trainingDate);
      if (linkedDate) setWeekStart(startOfIsoWeek(linkedDate));
      updateUrl({ plan: planId, view: "document", date: next.preview.trainingDate });
      let nextSession = next.session;
      changeVersionRef.current += 1;
      if (nextSession) {
        serverUpdatedAtBySessionRef.current.set(nextSession.sessionId, nextSession.updatedAt);
        const local = readLocalDraft(organizationId, nextSession.sessionId);
        if (local?.conflictDetectedAt) {
          conflictedSessionIdsRef.current.add(nextSession.sessionId);
          nextSession = cloneDocumentationInput(local.value);
          setDirty(true);
          setSaveState("error");
          setVersionConflict(true);
          setError(VERSION_CONFLICT_NOTICE);
        } else if (local && new Date(local.savedAt).getTime() > new Date(nextSession.updatedAt).getTime()) {
          nextSession = cloneDocumentationInput(local.value);
          setDirty(true);
          setSaveState("local");
          setNotice("Ein lokal gespeicherter, noch nicht synchronisierter Stand wurde wiederhergestellt.");
        } else {
          conflictedSessionIdsRef.current.delete(nextSession.sessionId);
          setDirty(false);
          setSaveState("saved");
        }
      } else {
        setDirty(false);
        setSaveState("idle");
      }
      sessionValueRef.current = nextSession;
      setSessionValue(nextSession);
      return true;
    } catch (loadError) {
      setError(errorMessage(loadError));
      return false;
    } finally {
      setDetailLoading(false);
    }
  }, [guardUnsaved, organizationId, updateUrl]);

  const openPlan = useCallback((planId: string) => loadPlan(planId, false), [loadPlan]);

  useEffect(() => {
    if (!selectedPlanId || !organizationId) return;
    if (detail?.preview.planId === selectedPlanId) return;
    void openPlan(selectedPlanId);
  }, [detail?.preview.planId, openPlan, organizationId, selectedPlanId]);

  const drainSaveQueue = useCallback((): Promise<void> => {
    const activeRunner = saveRunnerRef.current;
    if (activeRunner) return activeRunner;

    const runner = (async () => {
      let overviewNeedsRefresh = false;
      while (saveQueueRef.current.length > 0) {
        const request = saveQueueRef.current.shift();
        if (!request || !organizationId) continue;
        inFlightSaveRef.current = request;
        const isCurrentSession = sessionValueRef.current?.sessionId === request.value.sessionId;
        if (isCurrentSession) setSaveState("saving");

        try {
          const expectedUpdatedAt = serverUpdatedAtBySessionRef.current.get(request.value.sessionId)
            ?? request.value.updatedAt;
          if (!expectedUpdatedAt) {
            throw new Error("Die Serverversion der Trainingsdokumentation fehlt. Bitte den Trainingsplan neu laden.");
          }

          const result = await saveTrainingDocumentation(
            organizationId,
            request.value,
            expectedUpdatedAt,
          );
          serverUpdatedAtBySessionRef.current.set(request.value.sessionId, result.updatedAt);
          conflictedSessionIdsRef.current.delete(request.value.sessionId);
          overviewNeedsRefresh = true;

          const hasNewerQueuedSave = saveQueueRef.current.some(
            (queued) => queued.value.sessionId === request.value.sessionId,
          );
          const requestIsLatestVersion = changeVersionRef.current === request.changeVersion && !hasNewerQueuedSave;
          setSessionValue((existing) => {
            if (!existing || existing.sessionId !== request.value.sessionId) return existing;
            const next = {
              ...existing,
              ...(requestIsLatestVersion ? {
                status: result.status,
                completedAt: result.completedAt,
              } : {}),
              updatedAt: result.updatedAt,
            };
            sessionValueRef.current = next;
            return next;
          });

          const isStillCurrentSession = sessionValueRef.current?.sessionId === request.value.sessionId;
          if (isStillCurrentSession && requestIsLatestVersion) {
            setDirty(false);
            setSaveState("saved");
            setVersionConflict(false);
            setError(null);
            clearLocalDraft(organizationId, request.value.sessionId);
          } else if (isStillCurrentSession) {
            setDirty(true);
            setSaveState(hasNewerQueuedSave ? "saving" : "idle");
          }

          for (const resolve of request.waiters.splice(0)) resolve(true);
        } catch (saveError) {
          const isConflict = isTrainingDocumentationVersionConflict(saveError);
          if (isConflict) conflictedSessionIdsRef.current.add(request.value.sessionId);

          const latestLocalValue = sessionValueRef.current?.sessionId === request.value.sessionId
            ? cloneDocumentationInput(sessionValueRef.current)
            : request.value;
          writeLocalDraft(organizationId, latestLocalValue, isConflict);

          const isStillCurrentSession = sessionValueRef.current?.sessionId === request.value.sessionId;
          if (isStillCurrentSession) {
            setDirty(true);
            setSaveState(navigator.onLine ? "error" : "local");
            setVersionConflict(isConflict);
            setError(isConflict ? VERSION_CONFLICT_NOTICE : errorMessage(saveError));
          }

          for (const resolve of request.waiters.splice(0)) resolve(false);
          const cancelledRequests = saveQueueRef.current.splice(0);
          for (const cancelled of cancelledRequests) {
            for (const resolve of cancelled.waiters.splice(0)) resolve(false);
          }
          break;
        } finally {
          inFlightSaveRef.current = null;
        }
      }

      if (overviewNeedsRefresh) {
        try {
          await loadOverview();
        } catch {
          // Der Dokumentationsstand ist bereits gespeichert. Die Übersicht wird beim nächsten Laden aktualisiert.
        }
      }
    })();

    saveRunnerRef.current = runner;
    void runner.finally(() => {
      if (saveRunnerRef.current === runner) saveRunnerRef.current = null;
    });
    return runner;
  }, [loadOverview, organizationId]);

  const saveNow = useCallback(async (explicitValue?: TrainingDocumentationInput): Promise<boolean> => {
    if (!organizationId) return false;
    const current = explicitValue ?? sessionValueRef.current;
    if (!current || !current.canEdit) return true;

    const snapshot = cloneDocumentationInput(current);
    const capturedVersion = changeVersionRef.current;
    const hasVersionConflict = conflictedSessionIdsRef.current.has(snapshot.sessionId);
    writeLocalDraft(organizationId, snapshot, hasVersionConflict);

    if (hasVersionConflict) {
      setSaveState("error");
      setDirty(true);
      setVersionConflict(true);
      setError(VERSION_CONFLICT_NOTICE);
      return false;
    }
    if (!navigator.onLine) {
      setSaveState("local");
      setDirty(true);
      return false;
    }

    setSaveState("saving");
    return new Promise<boolean>((resolve) => {
      const inFlight = inFlightSaveRef.current;
      if (
        inFlight
        && inFlight.value.sessionId === snapshot.sessionId
        && capturedVersion <= inFlight.changeVersion
      ) {
        inFlight.waiters.push(resolve);
        return;
      }

      const pending = saveQueueRef.current.find(
        (queued) => queued.value.sessionId === snapshot.sessionId,
      );
      if (pending) {
        if (capturedVersion >= pending.changeVersion) {
          pending.value = snapshot;
          pending.changeVersion = capturedVersion;
        }
        pending.waiters.push(resolve);
      } else {
        saveQueueRef.current.push({
          value: snapshot,
          changeVersion: capturedVersion,
          waiters: [resolve],
        });
      }
      void drainSaveQueue();
    });
  }, [drainSaveQueue, organizationId]);

  useEffect(() => {
    if (!dirty || !sessionValue?.canEdit || versionConflict) return undefined;
    const timeout = window.setTimeout(() => { void saveNow(); }, 1200);
    return () => window.clearTimeout(timeout);
  }, [dirty, saveNow, sessionValue, versionConflict]);

  useEffect(() => {
    const handleOnline = () => { if (dirty && !versionConflict) void saveNow(); };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [dirty, saveNow, versionConflict]);

  function changeSession(next: TrainingDocumentationInput) {
    changeVersionRef.current += 1;
    sessionValueRef.current = next;
    setSessionValue(next);
    setDirty(true);
    const hasVersionConflict = conflictedSessionIdsRef.current.has(next.sessionId);
    setSaveState(hasVersionConflict ? "error" : navigator.onLine ? "idle" : "local");
    setVersionConflict(hasVersionConflict);
    if (organizationId) writeLocalDraft(organizationId, next, hasVersionConflict);
  }

  async function startSession() {
    if (!organizationId || !detail) return;
    setBusy(true);
    setError(null);
    try {
      await startTrainingDocumentation(organizationId, detail.preview.planId);
      await loadPlan(detail.preview.planId, true);
      await loadOverview();
      setNotice("Training gestartet. Änderungen werden automatisch gespeichert.");
    } catch (startError) {
      setError(errorMessage(startError));
    } finally {
      setBusy(false);
    }
  }

  async function completeSession(next: TrainingDocumentationInput): Promise<boolean> {
    changeVersionRef.current += 1;
    sessionValueRef.current = next;
    setSessionValue(next);
    setDirty(true);
    const saved = await saveNow(next);
    if (!saved) return false;
    if (organizationId) clearLocalDraft(organizationId, next.sessionId);
    await loadPlan(next.planId, true);
    setNotice("Das Training wurde abgeschlossen.");
    return true;
  }

  async function reloadDetail() {
    if (!selectedPlanId) return;
    const saved = await saveNow();
    if (saved) await loadPlan(selectedPlanId, true);
  }

  async function loadServerVersionAfterConflict() {
    if (!organizationId || !selectedPlanId || !sessionValueRef.current) return;
    const currentSessionId = sessionValueRef.current.sessionId;
    if (!window.confirm(
      "Aktuellen Serverstand laden? Dein lokaler Konfliktentwurf wird dabei verworfen. "
      + "Nicht übernommene Texte solltest du vorher kopieren.",
    )) return;

    clearLocalDraft(organizationId, currentSessionId);
    conflictedSessionIdsRef.current.delete(currentSessionId);
    setVersionConflict(false);
    setError(null);
    setDirty(false);
    setSaveState("idle");
    await loadPlan(selectedPlanId, true);
  }

  function clearSelectedPlan() {
    setSelectedPlanId("");
    setDetail(null);
    sessionValueRef.current = null;
    setSessionValue(null);
    setVersionConflict(false);
    setDirty(false);
    setSaveState("idle");
    updateUrl({ plan: "", date: "" });
  }

  function changeGroup(nextGroupId: string) {
    if (!guardUnsaved()) return;
    setGroupId(nextGroupId);
    const nextAthleteId = isStaff
      ? overview.athletes.find((athlete) => !nextGroupId || athlete.groupIds.includes(nextGroupId))?.id ?? ""
      : overview.ownAthleteId ?? "";
    setAthleteId(nextAthleteId);
    clearSelectedPlan();
    updateUrl({ group: nextGroupId, athlete: nextAthleteId, plan: "" });
  }

  function changeAthlete(nextAthleteId: string) {
    if (!guardUnsaved()) return;
    setAthleteId(nextAthleteId);
    clearSelectedPlan();
    updateUrl({ athlete: nextAthleteId, plan: "" });
  }

  function changeWeek(amount: number) {
    if (!guardUnsaved()) return;
    setWeekStart((current) => addWeeks(current, amount));
    clearSelectedPlan();
  }

  function changeMode(nextMode: PageMode) {
    if (nextMode !== mode && !guardUnsaved()) return;
    setMode(nextMode);
    updateUrl({ view: nextMode });
  }

  const loadStatistics = useCallback(async () => {
    if (!organizationId || !athleteId) return;
    setStatsLoading(true);
    setError(null);
    try {
      setStatistics(await loadTrainingDocumentationStatistics(organizationId, athleteId, statsFrom, statsTo));
    } catch (statsError) {
      setError(errorMessage(statsError));
    } finally {
      setStatsLoading(false);
    }
  }, [athleteId, organizationId, statsFrom, statsTo]);

  useEffect(() => {
    if (mode === "statistics" && athleteId) void loadStatistics();
  }, [athleteId, loadStatistics, mode]);

  const availableAthletes = useMemo(
    () => overview.athletes.filter((athlete) => !groupId || athlete.groupIds.includes(groupId)),
    [groupId, overview.athletes],
  );

  return (
    <section className="training-documentation-page">
      <header className="training-documentation-heading">
        <div>
          <p className="eyebrow">Training durchführen</p>
          <h1>Trainingsdokumentation</h1>
          <p>Trainingsplan öffnen, Soll-Ist-Werte erfassen und Entwicklung auswerten.</p>
        </div>
      </header>

      {error && (
        <div className="alert error">
          <span>{error}</span>
          {versionConflict && (
            <button type="button" className="secondary-button" onClick={() => void loadServerVersionAfterConflict()}>
              Aktuellen Serverstand laden
            </button>
          )}
        </div>
      )}
      {notice && <div className="alert success">{notice}</div>}

      <nav className="training-doc-tabs" aria-label="Bereiche der Trainingsdokumentation">
        <button type="button" className={mode === "document" ? "active" : ""} onClick={() => changeMode("document")}>
          <Dumbbell aria-hidden="true" />Dokumentieren
        </button>
        {isStaff && (
          <button type="button" className={mode === "team" ? "active" : ""} onClick={() => changeMode("team")}>
            <Users aria-hidden="true" />Trainerübersicht
          </button>
        )}
        <button type="button" className={mode === "statistics" ? "active" : ""} onClick={() => changeMode("statistics")}>
          <BarChart3 aria-hidden="true" />Auswertung
        </button>
      </nav>

      <section className="training-doc-controls">
        <label>
          <span><Users aria-hidden="true" />Gruppe</span>
          <select value={groupId} onChange={(event) => changeGroup(event.target.value)} disabled={loading}>
            {overview.groups.map((group) => <option value={group.id} key={group.id}>{group.shortName || group.name}</option>)}
          </select>
        </label>
        {isStaff ? (
          <label>
            <span>Athlet</span>
            <select value={athleteId} onChange={(event) => changeAthlete(event.target.value)} disabled={loading}>
              {availableAthletes.map((athlete) => <option value={athlete.id} key={athlete.id}>{athlete.firstName} {athlete.lastName}</option>)}
            </select>
          </label>
        ) : (
          <div className="training-doc-athlete-label"><span>Athlet</span><strong>{selectedAthlete ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}` : "Kein Athletenkonto verknüpft"}</strong></div>
        )}
        <div className="training-doc-week-navigation">
          <button type="button" className="icon-button" onClick={() => changeWeek(-1)} aria-label="Vorherige Woche"><ChevronLeft aria-hidden="true" /></button>
          <button type="button" onClick={() => { if (guardUnsaved()) { setWeekStart(startOfIsoWeek(new Date())); clearSelectedPlan(); } }}>
            <strong>KW {isoWeekNumber(weekStart)}</strong><small>{formatWeekRange(weekStart)}</small>
          </button>
          <button type="button" className="icon-button" onClick={() => changeWeek(1)} aria-label="Nächste Woche"><ChevronRight aria-hidden="true" /></button>
        </div>
        <button type="button" className="icon-button" onClick={() => void loadOverview()} aria-label="Aktualisieren"><RefreshCw aria-hidden="true" /></button>
      </section>

      {!isStaff && !overview.ownAthleteId && !loading && (
        <div className="alert warning">Dein Benutzerkonto ist noch keinem Athleten zugeordnet. Bitte einen Administrator um die Verknüpfung in den Stammdaten.</div>
      )}

      {mode === "document" && (
        <>
          <section className="training-doc-plan-strip" aria-label="Trainingspläne dieser Woche">
            {athletePlans.map((plan) => (
              <button
                type="button"
                className={`${selectedPlanId === plan.id ? "active" : ""} session-${plan.sessionStatus}`}
                onClick={() => void openPlan(plan.id)}
                key={plan.id}
              >
                <span><strong>{formatDate(plan.trainingDate)}</strong><small>{plan.title}</small></span>
                <span><Clock3 aria-hidden="true" />{plan.actualMinutes ?? plan.plannedMinutes} min</span>
                <em>{statusLabel(plan)}</em>
              </button>
            ))}
            {!loading && athletePlans.length === 0 && <p>Für diesen Athleten gibt es in der ausgewählten Woche noch keinen Trainingsplan.</p>}
          </section>

          {detailLoading ? (
            <div className="management-loading"><div className="spinner" aria-hidden="true" />Trainingsplan wird geladen …</div>
          ) : detail && !sessionValue ? (
            <section className="training-doc-preview">
              <header>
                <div><p className="eyebrow">Trainingsplan</p><h2>{detail.preview.title}</h2><small>{detail.preview.athleteName} · {formatDate(detail.preview.trainingDate)}</small></div>
                <div><span><Clock3 aria-hidden="true" />{detail.preview.plannedMinutes} min</span><span><ListChecks aria-hidden="true" />{detail.preview.exerciseCount} Übungen</span></div>
              </header>
              {detail.preview.notes && <p className="training-doc-preview-notes">{detail.preview.notes}</p>}
              <div className="training-doc-preview-sections">
                {detail.preview.sections.map((section) => (
                  <details key={section.id}>
                    <summary><strong>{section.name}</strong><small>{section.items.length} Übungen{section.estimatedMinutes ? ` · ${section.estimatedMinutes} min` : ""}</small></summary>
                    <div>
                      {section.items.map((item) => (
                        <article key={item.id}>
                          <span><strong>{item.exerciseName}</strong><small>{item.categoryTitle}</small></span>
                          {(item.exerciseVideoSignedUrl || item.exerciseVideoUrl) && <a href={item.exerciseVideoSignedUrl || item.exerciseVideoUrl || "#"} target="_blank" rel="noreferrer"><Film aria-hidden="true" />Video</a>}
                        </article>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              {detail.preview.canEdit && (
                <button type="button" className="primary-button training-doc-start" onClick={() => void startSession()} disabled={busy}>
                  <Play aria-hidden="true" />{busy ? "Wird gestartet …" : "Training starten"}
                </button>
              )}
            </section>
          ) : sessionValue && organizationId ? (
            <TrainingDocumentationEditor
              organizationId={organizationId}
              value={sessionValue}
              saveState={saveState}
              onChange={changeSession}
              onSave={async () => { await saveNow(); }}
              onComplete={completeSession}
              onReload={reloadDetail}
            />
          ) : !loading ? (
            <div className="empty-state"><CalendarDays aria-hidden="true" /><h2>Trainingsplan auswählen</h2><p>Wähle oben einen Trainingstag, um die Dokumentation zu öffnen.</p></div>
          ) : null}
        </>
      )}

      {mode === "team" && isStaff && (
        <TrainingDocumentationTeamOverview
          weekStart={weekStart}
          group={selectedGroup}
          athletes={availableAthletes}
          plans={overview.plans.filter((plan) => !groupId || plan.groupId === groupId)}
          onOpen={(planId) => void openPlan(planId)}
        />
      )}

      {mode === "statistics" && (
        <>
          <section className="training-doc-stat-controls">
            <label>Von<input type="date" value={statsFrom} onChange={(event) => setStatsFrom(event.target.value)} /></label>
            <label>Bis<input type="date" value={statsTo} onChange={(event) => setStatsTo(event.target.value)} /></label>
            <button type="button" className="secondary-button" onClick={() => void loadStatistics()} disabled={statsLoading || !athleteId}>
              <BarChart3 aria-hidden="true" />{statsLoading ? "Wird geladen …" : "Auswertung aktualisieren"}
            </button>
          </section>
          {statsLoading ? (
            <div className="management-loading"><div className="spinner" aria-hidden="true" />Auswertung wird geladen …</div>
          ) : statistics ? (
            <TrainingDocumentationStatisticsView statistics={statistics} />
          ) : (
            <div className="empty-state"><BarChart3 aria-hidden="true" /><h2>Auswertung laden</h2><p>Wähle Athlet und Zeitraum.</p></div>
          )}
        </>
      )}
    </section>
  );
}
