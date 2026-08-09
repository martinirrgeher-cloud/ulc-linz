import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, RefreshCw, Settings2, UsersRound } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import { SpecialTrainingPicker } from "@/features/training-session/components/SpecialTrainingPicker";
import { TrainingAthleteDeactivateDialog } from "@/features/training-session/components/TrainingAthleteDeactivateDialog";
import { TrainingAttendanceWorkspace } from "@/features/training-session/components/TrainingAttendanceWorkspace";
import {
  TrainingAutosaveStatus,
  type TrainingAutoSaveState,
} from "@/features/training-session/components/TrainingAutosaveStatus";
import {
  TrainingContactDialog,
  type TrainingContactSelection,
} from "@/features/training-session/components/TrainingContactDialog";
import { TrainingDateControls } from "@/features/training-session/components/TrainingDateControls";
import { TrainingDetailsPanel } from "@/features/training-session/components/TrainingDetailsPanel";
import {
  createGroupTrainingAthlete,
  deleteGroupTrainingSpecialSession,
  loadGroupTrainingConfiguration,
  loadGroupTrainingSession,
  saveGroupTrainingSession,
} from "@/features/group-training/api";
import type { GroupTrainingModuleDefinition } from "@/features/group-training/modules";
import { QuickAthleteDialog } from "@/features/training-session/components/QuickAthleteDialog";
import type {
  AthleteNameSort,
  AttendanceStatus,
  QuickAthleteResult,
  TrainingConfiguration,
  TrainingDraft,
  TrainingEnvironment,
  TrainingParticipant,
  TrainingSession,
} from "@/features/training-session/types";
import { useAuth } from "@/features/auth/AuthContext";
import { deactivateAthleteFromTraining } from "@/features/athletes/api";

import {
  athleteDisplayName,
  draftSignature,
  findTrainingDate,
  formatLongDate,
  isRegularDate,
  isoDate,
  makeDraft,
  readStoredAthleteNameSort,
  sortParticipants,
} from "@/features/training-session/core";
import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/kindertraining.css";

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "Die Trainingsdaten konnten nicht verarbeitet werden.";

  if (message.includes("inzwischen")) {
    return "Dieses Training wurde zwischenzeitlich geändert. Bitte lade den aktuellen Stand neu.";
  }

  if (message.includes("Teilnehmerliste ist nicht mehr aktuell")) {
    return "Die Gruppenzusammensetzung hat sich geändert. Bitte lade das Training neu.";
  }

  return diagnosticErrorMessage(
    error,
    "Die Trainingsdaten konnten nicht verarbeitet werden.",
    "group_training",
  );
}

type SaveSnapshot = {
  organizationId: string;
  groupId: string;
  sessionDate: string;
  state: TrainingDraft["state"];
  note: string;
  attendance: Record<string, AttendanceStatus>;
  environment: TrainingEnvironment;
  trainerIds: string[];
  participants: TrainingParticipant[];
  revision: number;
  forceCreate: boolean;
};

const AUTOSAVE_DELAY_MS = 700;

type GroupTrainingPageProps = {
  definition: GroupTrainingModuleDefinition;
};

export function GroupTrainingPage({ definition }: GroupTrainingPageProps) {
  const { moduleKey, title, statisticsRoute, sortStorageKey } = definition;
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule(moduleKey);
  const canEdit = canEditModule(moduleKey);

  const [configuration, setConfiguration] = useState<TrainingConfiguration | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [transientSpecialDates, setTransientSpecialDates] = useState<string[]>([]);
  const [specialDateInput, setSpecialDateInput] = useState(() => isoDate(new Date()));
  const [showSpecialDatePicker, setShowSpecialDatePicker] = useState(false);
  const [showQuickAthlete, setShowQuickAthlete] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AttendanceStatus>("open");
  const [sortMode, setSortMode] = useState<AthleteNameSort>(() => readStoredAthleteNameSort(sortStorageKey));
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [participants, setParticipants] = useState<TrainingParticipant[]>([]);
  const [draft, setDraft] = useState<TrainingDraft>({
    state: "scheduled",
    note: "",
    attendance: {},
    environment: null,
    trainerIds: [],
  });
  const [baseline, setBaseline] = useState<TrainingDraft | null>(null);
  const [forceCreateSpecial, setForceCreateSpecial] = useState(false);
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<TrainingAutoSaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<TrainingContactSelection | null>(null);
  const [athleteToDeactivate, setAthleteToDeactivate] = useState<TrainingParticipant | null>(null);
  const [deactivationConfirmed, setDeactivationConfirmed] = useState(false);
  const [deactivatingAthlete, setDeactivatingAthlete] = useState(false);
  const [deletingSpecial, setDeletingSpecial] = useState(false);
  const [showAllTrainers, setShowAllTrainers] = useState(false);

  const requestIdRef = useRef(0);
  const initializedDateRef = useRef(false);
  const pendingSpecialDateRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const queuedSaveKeyRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  const sessionRef = useRef<TrainingSession | null>(session);
  const participantsRef = useRef(participants);
  const draftRef = useRef(draft);
  const baselineRef = useRef<TrainingDraft | null>(baseline);
  const dirtyRef = useRef(false);
  const forceCreateSpecialRef = useRef(forceCreateSpecial);
  const sessionByDateRef = useRef<Record<string, TrainingSession | null>>({});

  const group = configuration?.group ?? null;
  const allSpecialDates = useMemo(
    () => [...new Set([...(configuration?.specialDates ?? []), ...transientSpecialDates])],
    [configuration?.specialDates, transientSpecialDates],
  );

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return draftSignature(draft, participants) !== draftSignature(baseline, participants);
  }, [baseline, draft, participants]);

  selectedDateRef.current = selectedDate;
  sessionRef.current = session;
  participantsRef.current = participants;
  draftRef.current = draft;
  baselineRef.current = baseline;
  dirtyRef.current = dirty;
  forceCreateSpecialRef.current = forceCreateSpecial;

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      open: 0,
      present: 0,
      absent: 0,
    };

    participants.forEach((participant) => {
      result[draft.attendance[participant.athleteId] ?? "open"] += 1;
    });

    return result;
  }, [draft.attendance, participants]);

  const categoryParticipants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("de-AT");
    const filtered = participants.filter((participant) => {
      const status = draft.attendance[participant.athleteId] ?? "open";
      if (status !== activeCategory) return false;
      if (!normalizedSearch) return true;

      return `${participant.firstName} ${participant.lastName} ${participant.birthYear ?? ""}`
        .toLocaleLowerCase("de-AT")
        .includes(normalizedSearch);
    });

    return sortParticipants(filtered, sortMode);
  }, [activeCategory, draft.attendance, participants, searchTerm, sortMode]);

  const groupTrainerIds = configuration?.groupTrainerIds ?? [];
  const visibleTrainers = useMemo(() => {
    const assignedIds = new Set(groupTrainerIds);
    const selectedIds = new Set(draft.trainerIds);
    return (session?.availableTrainers ?? []).filter(
      (trainer) => showAllTrainers || assignedIds.has(trainer.id) || selectedIds.has(trainer.id),
    );
  }, [draft.trainerIds, groupTrainerIds, session?.availableTrainers, showAllTrainers]);
  const hiddenTrainerCount = Math.max(
    0,
    (session?.availableTrainers.length ?? 0) - visibleTrainers.length,
  );

  const selectedDateIsRegular = group
    ? isRegularDate(selectedDate, group.regularWeekdays)
    : false;
  const today = isoDate(new Date());
  const todayIsVisible = group
    ? isRegularDate(today, group.regularWeekdays) || allSpecialDates.includes(today)
    : false;

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const loadConfiguration = useCallback(async () => {
    if (!organizationId || !canView) return;

    setConfigurationLoading(true);
    setError(null);
    try {
      const loadedConfiguration = await loadGroupTrainingConfiguration(organizationId, moduleKey);
      setConfiguration(loadedConfiguration);

      if (loadedConfiguration.group && !initializedDateRef.current) {
        initializedDateRef.current = true;
        const startDate = findTrainingDate(
          isoDate(new Date()),
          -1,
          loadedConfiguration.group.regularWeekdays,
          loadedConfiguration.specialDates,
          true,
        );
        setSelectedDate(startDate);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setConfigurationLoading(false);
    }
  }, [canView, moduleKey, organizationId]);

  const loadSession = useCallback(async () => {
    if (!organizationId || !group?.id || !canView) return;

    const loadingDate = selectedDate;
    const requestId = ++requestIdRef.current;
    clearAutosaveTimer();
    setSessionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const loadedSession = await loadGroupTrainingSession(
        organizationId,
        moduleKey,
        group.id,
        loadingDate,
      );
      if (requestId !== requestIdRef.current || selectedDateRef.current !== loadingDate) return;

      const loadedDraft = makeDraft(loadedSession, groupTrainerIds);
      const shouldCreateSpecial =
        pendingSpecialDateRef.current === loadingDate &&
        !loadedSession.id &&
        !loadedSession.isRegularDay;

      sessionByDateRef.current[loadingDate] = loadedSession;
      revisionRef.current = 0;
      setSession(loadedSession);
      setParticipants(loadedSession.participants);
      setDraft(loadedDraft);
      setBaseline(loadedDraft);
      setForceCreateSpecial(shouldCreateSpecial);
      setAutoSaveState(loadedSession.updatedAt ? "saved" : shouldCreateSpecial ? "pending" : "idle");
      setActiveCategory("open");
      setSearchTerm("");
      setShowAllTrainers(false);

      if (!shouldCreateSpecial) pendingSpecialDateRef.current = null;
    } catch (loadError) {
      if (requestId !== requestIdRef.current || selectedDateRef.current !== loadingDate) return;
      setSession(null);
      setParticipants([]);
      setBaseline(null);
      setForceCreateSpecial(false);
      setAutoSaveState("error");
      setError(errorMessage(loadError));
    } finally {
      if (requestId === requestIdRef.current) setSessionLoading(false);
    }
  }, [canView, clearAutosaveTimer, group?.id, groupTrainerIds, organizationId, selectedDate]);

  const createSaveSnapshot = useCallback((): SaveSnapshot | null => {
    if (
      !organizationId ||
      !group?.id ||
      !canEdit ||
      !baselineRef.current ||
      sessionLoading
    ) {
      return null;
    }

    return {
      organizationId,
      groupId: group.id,
      sessionDate: selectedDateRef.current,
      state: draftRef.current.state,
      note: draftRef.current.note,
      attendance: { ...draftRef.current.attendance },
      environment: draftRef.current.environment,
      trainerIds: [...draftRef.current.trainerIds],
      participants: [...participantsRef.current],
      revision: revisionRef.current,
      forceCreate: forceCreateSpecialRef.current,
    };
  }, [canEdit, group?.id, organizationId, sessionLoading]);

  const executeSave = useCallback(async (snapshot: SaveSnapshot): Promise<boolean> => {
    const isCurrentDate = selectedDateRef.current === snapshot.sessionDate;
    if (isCurrentDate) {
      setSaving(true);
      setAutoSaveState("saving");
      setError(null);
    }

    try {
      const expectedSession = sessionByDateRef.current[snapshot.sessionDate] ?? null;
      const savedSession = await saveGroupTrainingSession(moduleKey, {
        organizationId: snapshot.organizationId,
        groupId: snapshot.groupId,
        sessionDate: snapshot.sessionDate,
        state: snapshot.state,
        note: snapshot.note,
        participants: snapshot.participants,
        attendance: snapshot.attendance,
        environment: snapshot.environment,
        trainerIds: snapshot.trainerIds,
        expectedUpdatedAt: expectedSession?.updatedAt ?? null,
      });

      sessionByDateRef.current[snapshot.sessionDate] = savedSession;

      if (selectedDateRef.current === snapshot.sessionDate) {
        const savedDraft = makeDraft(savedSession, groupTrainerIds);
        setSession(savedSession);
        setParticipants(savedSession.participants);
        setBaseline(savedDraft);
        setForceCreateSpecial(false);
        pendingSpecialDateRef.current = null;

        if (revisionRef.current === snapshot.revision) {
          setDraft(savedDraft);
          setAutoSaveState("saved");
        } else {
          setAutoSaveState("pending");
        }

        if (savedSession.isSpecial) {
          setTransientSpecialDates((current) => [
            ...new Set([...current, snapshot.sessionDate]),
          ]);
        }
      }

      return true;
    } catch (saveError) {
      if (selectedDateRef.current === snapshot.sessionDate) {
        setAutoSaveState("error");
        setError(errorMessage(saveError));
      }
      return false;
    } finally {
      if (selectedDateRef.current === snapshot.sessionDate) setSaving(false);
    }
  }, [groupTrainerIds]);

  const enqueueSave = useCallback((snapshot: SaveSnapshot): Promise<boolean> => {
    const saveKey = `${snapshot.sessionDate}:${snapshot.revision}:${snapshot.forceCreate ? "create" : "update"}`;
    if (queuedSaveKeyRef.current === saveKey) return saveQueueRef.current;

    queuedSaveKeyRef.current = saveKey;
    const operation = saveQueueRef.current.then(() => executeSave(snapshot));
    saveQueueRef.current = operation;

    void operation.finally(() => {
      if (queuedSaveKeyRef.current === saveKey) queuedSaveKeyRef.current = null;
    });

    return operation;
  }, [executeSave]);

  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    clearAutosaveTimer();

    if (!canEdit) return true;
    if (!dirtyRef.current && !forceCreateSpecialRef.current) {
      return saveQueueRef.current;
    }

    const snapshot = createSaveSnapshot();
    if (!snapshot) return false;
    return enqueueSave(snapshot);
  }, [canEdit, clearAutosaveTimer, createSaveSnapshot, enqueueSave]);

  useNavigationGuard(useCallback(async () => {
    const saved = await flushPendingSave();
    if (!saved) {
      setError((current) => current ?? "Die letzten Änderungen konnten nicht gespeichert werden.");
    }
    return saved;
  }, [flushPendingSave]));

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  useEffect(() => {
    if (group?.id) void loadSession();
  }, [group?.id, loadSession]);

  useEffect(() => {
    try {
      window.localStorage.setItem(sortStorageKey, sortMode);
    } catch {
      // Lokale Speicherung ist optional; die Sortierung funktioniert trotzdem.
    }
  }, [sortMode, sortStorageKey]);

  useEffect(() => {
    if (
      !canEdit ||
      sessionLoading ||
      !baseline ||
      (!dirty && !forceCreateSpecial)
    ) {
      clearAutosaveTimer();
      return undefined;
    }

    setAutoSaveState("pending");
    clearAutosaveTimer();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      const snapshot = createSaveSnapshot();
      if (snapshot) void enqueueSave(snapshot);
    }, AUTOSAVE_DELAY_MS);

    return clearAutosaveTimer;
  }, [
    baseline,
    canEdit,
    clearAutosaveTimer,
    createSaveSnapshot,
    draft,
    dirty,
    enqueueSave,
    forceCreateSpecial,
    participants,
    sessionLoading,
  ]);

  useEffect(() => {
    function preventAccidentalClose(event: BeforeUnloadEvent) {
      if (!dirtyRef.current && !forceCreateSpecialRef.current && !saving) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function flushWhenHidden() {
      if (document.visibilityState === "hidden") void flushPendingSave();
    }

    window.addEventListener("beforeunload", preventAccidentalClose);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("beforeunload", preventAccidentalClose);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      clearAutosaveTimer();
    };
  }, [clearAutosaveTimer, flushPendingSave, saving]);

  async function changeDate(date: string, markAsSpecial = false): Promise<boolean> {
    if (!date || date === selectedDateRef.current) return true;
    if (!(await flushPendingSave())) return false;

    if (markAsSpecial && group && !isRegularDate(date, group.regularWeekdays)) {
      pendingSpecialDateRef.current = date;
      setTransientSpecialDates((current) => [...new Set([...current, date])]);
    } else {
      pendingSpecialDateRef.current = null;
    }

    setAutoSaveState("idle");
    setSelectedDate(date);
    return true;
  }

  function moveDate(direction: -1 | 1): void {
    if (!group) return;
    void changeDate(
      findTrainingDate(
        selectedDate,
        direction,
        group.regularWeekdays,
        allSpecialDates,
      ),
    );
  }

  function confirmSpecialDate(): void {
    if (!group || !specialDateInput) return;
    setShowSpecialDatePicker(false);
    void changeDate(
      specialDateInput,
      !isRegularDate(specialDateInput, group.regularWeekdays),
    );
  }

  function updateDraft(updater: (current: TrainingDraft) => TrainingDraft): void {
    if (!canEdit || sessionLoading) return;
    revisionRef.current += 1;
    setAutoSaveState("pending");
    setError(null);
    setSuccessMessage(null);
    setDraft(updater);
  }

  function setAttendance(athleteId: string, status: AttendanceStatus): void {
    updateDraft((current) => ({
      ...current,
      attendance: {
        ...current.attendance,
        [athleteId]: status,
      },
    }));
  }

  async function retrySave(): Promise<void> {
    const snapshot = createSaveSnapshot();
    if (snapshot) await enqueueSave(snapshot);
  }

  async function openQuickAthlete(): Promise<void> {
    if (await flushPendingSave()) setShowQuickAthlete(true);
  }

  async function handleQuickAthlete(
    values: { firstName: string; lastName: string; birthYear: number },
    attachExisting: boolean,
  ): Promise<QuickAthleteResult> {
    if (!organizationId) throw new Error("Der Verein ist nicht geladen.");

    return createGroupTrainingAthlete(organizationId, moduleKey, {
      ...values,
      sessionDate: selectedDate,
      attachExisting,
    });
  }

  async function completeQuickAthlete(result: QuickAthleteResult): Promise<void> {
    setShowQuickAthlete(false);
    const messages: Record<Exclude<QuickAthleteResult["status"], "duplicate">, string> = {
      created: `Das Kind wurde angelegt und ${title} zugeordnet.`,
      attached: `Das vorhandene Kind wurde aktiviert und ${title} zugeordnet.`,
      already_assigned: `Das Kind war bereits ${title} zugeordnet.`,
    };
    await loadSession();
    if (result.status !== "duplicate") setSuccessMessage(messages[result.status]);
  }

  function toggleTrainer(trainerId: string, checked: boolean): void {
    updateDraft((current) => ({
      ...current,
      trainerIds: checked
        ? [...new Set([...current.trainerIds, trainerId])]
        : current.trainerIds.filter((id) => id !== trainerId),
    }));
  }

  function setEnvironment(environment: TrainingEnvironment): void {
    updateDraft((current) => ({ ...current, environment }));
  }

  function markAllOpenAbsent(): void {
    const openCount = participants.filter(
      (participant) => (draft.attendance[participant.athleteId] ?? "open") === "open",
    ).length;
    if (openCount === 0) return;
    if (!window.confirm(`${openCount} offene Kinder wirklich auf „Fehlt“ setzen?`)) return;

    updateDraft((current) => ({
      ...current,
      attendance: Object.fromEntries(
        participants.map((participant) => [
          participant.athleteId,
          (current.attendance[participant.athleteId] ?? "open") === "open"
            ? "absent"
            : (current.attendance[participant.athleteId] ?? "open"),
        ]),
      ),
    }));
  }

  async function deleteSpecialTraining(): Promise<void> {
    if (!organizationId || !group?.id || !session?.isSpecial || !session.id) return;
    if (!window.confirm(`Sondertraining am ${formatLongDate(selectedDate)} löschen?`)) return;
    if (!(await flushPendingSave())) return;

    setDeletingSpecial(true);
    setError(null);
    try {
      const result = await deleteGroupTrainingSpecialSession(
        organizationId,
        moduleKey,
        group.id,
        selectedDate,
      );
      const remainingSpecialDates = allSpecialDates.filter((date) => date !== selectedDate);
      setTransientSpecialDates((current) => current.filter((date) => date !== selectedDate));
      setConfiguration((current) => current
        ? { ...current, specialDates: current.specialDates.filter((date) => date !== selectedDate) }
        : current);
      sessionByDateRef.current[selectedDate] = null;
      setSuccessMessage(
        result === "archived"
          ? "Das Sondertraining wurde aus der Planung entfernt und für die Historie archiviert."
          : "Das Sondertraining wurde gelöscht.",
      );
      const previousDate = findTrainingDate(
        selectedDate,
        -1,
        group.regularWeekdays,
        remainingSpecialDates,
      );
      setSelectedDate(previousDate);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setDeletingSpecial(false);
    }
  }

  async function deactivateSelectedAthlete(): Promise<void> {
    if (!organizationId || !group?.id || !athleteToDeactivate || !deactivationConfirmed) return;
    if (!(await flushPendingSave())) return;

    setDeactivatingAthlete(true);
    setError(null);
    try {
      await deactivateAthleteFromTraining(
        organizationId,
        moduleKey,
        group.id,
        athleteToDeactivate.athleteId,
      );
      const deactivatedName = athleteDisplayName(athleteToDeactivate, sortMode);
      setAthleteToDeactivate(null);
      setDeactivationConfirmed(false);
      await loadSession();
      setSuccessMessage(
        `${deactivatedName} wurde inaktiv gesetzt und aus zukünftigen ${title}-Trainingslisten entfernt.`,
      );
    } catch (deactivateError) {
      setError(errorMessage(deactivateError));
    } finally {
      setDeactivatingAthlete(false);
    }
  }


  if (!canView) return <Navigate to="/kein-zugriff" replace />;

  return (
    <section className="kindertraining-page">
      <div className="kindertraining-heading">
        <div>
          <p className="eyebrow">Training erfassen</p>
          <div className="kindertraining-title-row">
            <h1>{title}</h1>
            <Link
              className="icon-button statistics-link"
              to={statisticsRoute}
              aria-label={`${title}-Statistik öffnen`}
              title="Statistik"
            >
              <BarChart3 aria-hidden="true" />
            </Link>
          </div>
          <p>Anwesenheit schnell erfassen und direkt am Handy verwalten.</p>
        </div>
      </div>

      {!canEdit && (
        <div className="read-only-notice">
          Du besitzt für dieses Modul nur Leserechte. Eingaben sind deaktiviert.
        </div>
      )}

      {error && (
        <div className="alert error training-alert" role="alert">
          <span>{error}</span>
          {group?.id && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                if (autoSaveState === "error" && (dirty || forceCreateSpecial)) {
                  void retrySave();
                } else {
                  void loadSession();
                }
              }}
            >
              <RefreshCw aria-hidden="true" />
              {autoSaveState === "error" && (dirty || forceCreateSpecial)
                ? "Erneut speichern"
                : "Neu laden"}
            </button>
          )}
        </div>
      )}

      {successMessage && (
        <div className="alert success" role="status">
          {successMessage}
        </div>
      )}

      {configurationLoading ? (
        <div className="management-loading">
          <span className="spinner" aria-hidden="true" />
          {title} wird eingerichtet …
        </div>
      ) : !group ? (
        <div className="empty-state">
          <Settings2 aria-hidden="true" />
          <h2>{title}-Trainingsgruppe noch nicht zugeordnet</h2>
          <p>
            Öffne „Athleten, Trainer & Gruppen“, bearbeite die gewünschte Gruppe und ordne sie
            dem Trainingsmodul {title} zu.
          </p>
          <Link className="primary-button link-button" to="/module/athletes">
            Trainingsgruppe einrichten
          </Link>
        </div>
      ) : !group.isActive ? (
        <div className="empty-state">
          <UsersRound aria-hidden="true" />
          <h2>{title}-Trainingsgruppe ist deaktiviert</h2>
          <p>Aktiviere die Gruppe in der Trainingsgruppenverwaltung wieder.</p>
          <Link className="primary-button link-button" to="/module/athletes">
            Zur Gruppenverwaltung
          </Link>
        </div>
      ) : (
        <>
          <TrainingDateControls
            selectedDateLabel={formatLongDate(selectedDate)}
            selectedDateIsRegular={selectedDateIsRegular}
            sessionLoading={sessionLoading}
            allowSpecialTraining={group.allowSpecialTraining}
            canEdit={canEdit}
            canDeleteSpecialTraining={Boolean(session?.isSpecial && session.id)}
            deletingSpecial={deletingSpecial}
            showTodayShortcut={todayIsVisible && selectedDate !== today}
            onMoveDate={moveDate}
            onOpenSpecialTraining={() => {
              setSpecialDateInput(today);
              setShowSpecialDatePicker(true);
            }}
            onDeleteSpecialTraining={() => void deleteSpecialTraining()}
            onGoToToday={() => void changeDate(today)}
          />

          {showSpecialDatePicker && (
            <SpecialTrainingPicker
              value={specialDateInput}
              onChange={setSpecialDateInput}
              onSave={confirmSpecialDate}
              onCancel={() => setShowSpecialDatePicker(false)}
            />
          )}

          {sessionLoading ? (
            <div className="management-loading">
              <span className="spinner" aria-hidden="true" />
              Training wird geladen …
            </div>
          ) : baseline ? (
            <>
              <TrainingAttendanceWorkspace
                activeCategory={activeCategory}
                counts={counts}
                sortMode={sortMode}
                canEdit={canEdit}
                sessionLoading={sessionLoading}
                searchTerm={searchTerm}
                participants={participants}
                categoryParticipants={categoryParticipants}
                draft={draft}
                onCategoryChange={setActiveCategory}
                onSortModeChange={setSortMode}
                onAddAthlete={() => void openQuickAthlete()}
                onSearchTermChange={setSearchTerm}
                onMarkAllOpenAbsent={markAllOpenAbsent}
                onShowContacts={(participant) => setSelectedContacts({
                  athleteName: athleteDisplayName(participant, sortMode),
                  contacts: participant.contacts,
                })}
                onManageAthlete={(participant) => {
                  setDeactivationConfirmed(false);
                  setAthleteToDeactivate(participant);
                }}
                onSetAttendance={setAttendance}
              />

              <TrainingDetailsPanel
                draft={draft}
                canEdit={canEdit}
                availableTrainers={session?.availableTrainers ?? []}
                visibleTrainers={visibleTrainers}
                groupTrainerIds={groupTrainerIds}
                showAllTrainers={showAllTrainers}
                hiddenTrainerCount={hiddenTrainerCount}
                usesDefaults={session?.usesDefaults === true}
                hasPersistedSession={Boolean(session?.id)}
                noGroupTrainerMessage="Der Trainingsgruppe ist noch kein Trainer zugeordnet."
                onEnvironmentChange={setEnvironment}
                onToggleShowAllTrainers={() => setShowAllTrainers((current) => !current)}
                onShowAllTrainers={() => setShowAllTrainers(true)}
                onToggleTrainer={toggleTrainer}
                onCancelledChange={(cancelled) =>
                  updateDraft((current) => ({
                    ...current,
                    state: cancelled ? "cancelled" : "scheduled",
                  }))
                }
                onNoteChange={(note) =>
                  updateDraft((current) => ({ ...current, note }))
                }
              />

              {canEdit && (
                <TrainingAutosaveStatus
                  state={autoSaveState}
                  dirty={dirty}
                  forceCreateSpecial={forceCreateSpecial}
                  updatedAt={session?.updatedAt ?? null}
                  onRetry={() => void retrySave()}
                />
              )}
            </>
          ) : null}
        </>
      )}

      {athleteToDeactivate && (
        <TrainingAthleteDeactivateDialog
          participant={athleteToDeactivate}
          sortMode={sortMode}
          confirmed={deactivationConfirmed}
          deactivating={deactivatingAthlete}
          onClose={() => {
            setAthleteToDeactivate(null);
            setDeactivationConfirmed(false);
          }}
          onConfirmedChange={setDeactivationConfirmed}
          onDeactivate={() => void deactivateSelectedAthlete()}
        />
      )}

      {selectedContacts && (
        <TrainingContactDialog
          selection={selectedContacts}
          onClose={() => setSelectedContacts(null)}
        />
      )}

      {showQuickAthlete && (
        <QuickAthleteDialog
          contextLabel="Kindertraining"
          assignmentTargetLabel="dem Kindertraining"
          onClose={() => setShowQuickAthlete(false)}
          onSubmit={handleQuickAthlete}
          onCompleted={(result) => void completeQuickAthlete(result)}
        />
      )}
    </section>
  );
}
