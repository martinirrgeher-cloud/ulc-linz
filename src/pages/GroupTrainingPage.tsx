import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudCheck,
  MapPin,
  MoreVertical,
  Phone,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import {
  createGroupTrainingAthlete,
  deleteGroupTrainingSpecialSession,
  loadGroupTrainingConfiguration,
  loadGroupTrainingSession,
  saveGroupTrainingSession,
  type GroupTrainingModuleKey,
} from "@/features/group-training/api";
import { QuickAthleteDialog } from "@/features/kindertraining/QuickAthleteDialog";
import type {
  AthleteEmergencyContact,
  AthleteNameSort,
  AttendanceStatus,
  KindertrainingConfiguration,
  KindertrainingDraft,
  KindertrainingParticipant,
  KindertrainingSession,
  QuickAthleteResult,
  TrainingEnvironment,
} from "@/features/kindertraining/types";
import { useAuth } from "@/features/auth/AuthContext";
import { deactivateAthleteFromTraining } from "@/features/athletes/api";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/kindertraining.css";
const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  shortLabel: string;
}> = [
  { value: "open", label: "Offen", shortLabel: "Offen" },
  { value: "present", label: "Da", shortLabel: "Da" },
  { value: "excused", label: "Entschuldigt", shortLabel: "Entsch." },
  { value: "absent", label: "Fehlt", shortLabel: "Fehlt" },
];

const SORT_STORAGE_KEY_PREFIX = "ulc-group-training-name-sort";

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

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

function addDays(value: string, amount: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

function isoWeekday(value: string): number {
  const weekday = parseIsoDate(value).getDay();
  return weekday === 0 ? 7 : weekday;
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parseIsoDate(value));
}

function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isRegularDate(value: string, weekdays: number[]): boolean {
  return weekdays.includes(isoWeekday(value));
}

function findTrainingDate(
  fromDate: string,
  direction: -1 | 1,
  weekdays: number[],
  specialDates: string[],
  includeStart = false,
): string {
  let candidate = includeStart ? fromDate : addDays(fromDate, direction);
  const specialDateSet = new Set(specialDates);

  for (let index = 0; index < 740; index += 1) {
    if (isRegularDate(candidate, weekdays) || specialDateSet.has(candidate)) return candidate;
    candidate = addDays(candidate, direction);
  }

  return fromDate;
}

function makeDraft(
  session: KindertrainingSession,
  groupTrainerIds: string[] = [],
): KindertrainingDraft {
  const trainerIds = session.id
    ? session.trainerIds
    : session.trainerIds.filter((trainerId) => groupTrainerIds.includes(trainerId));

  return {
    state: session.state,
    note: session.note,
    attendance: Object.fromEntries(
      session.participants.map((participant) => [participant.athleteId, participant.status]),
    ),
    environment: session.environment,
    trainerIds,
  };
}

function draftSignature(
  draft: KindertrainingDraft,
  participants: KindertrainingParticipant[],
): string {
  return JSON.stringify({
    state: draft.state,
    note: draft.note,
    attendance: participants.map((participant) => [
      participant.athleteId,
      draft.attendance[participant.athleteId] ?? "open",
    ]),
    environment: draft.environment,
    trainerIds: [...draft.trainerIds].sort(),
  });
}

function readInitialSort(moduleKey: GroupTrainingModuleKey): AthleteNameSort {
  try {
    return window.localStorage.getItem(`${SORT_STORAGE_KEY_PREFIX}-${moduleKey}`) === "lastName"
      ? "lastName"
      : "firstName";
  } catch {
    return "firstName";
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "de-AT", { sensitivity: "base" });
}

function sortParticipants(
  participants: KindertrainingParticipant[],
  mode: AthleteNameSort,
): KindertrainingParticipant[] {
  return [...participants].sort((left, right) => {
    if (mode === "lastName") {
      return (
        compareText(left.lastName, right.lastName) ||
        compareText(left.firstName, right.firstName)
      );
    }

    return (
      compareText(left.firstName, right.firstName) ||
      compareText(left.lastName, right.lastName)
    );
  });
}

function athleteDisplayName(
  participant: KindertrainingParticipant,
  mode: AthleteNameSort,
): string {
  return mode === "lastName"
    ? `${participant.lastName} ${participant.firstName}`
    : `${participant.firstName} ${participant.lastName}`;
}

type AutoSaveState = "idle" | "pending" | "saving" | "saved" | "error";

type SaveSnapshot = {
  organizationId: string;
  groupId: string;
  sessionDate: string;
  state: KindertrainingDraft["state"];
  note: string;
  attendance: Record<string, AttendanceStatus>;
  environment: TrainingEnvironment;
  trainerIds: string[];
  participants: KindertrainingParticipant[];
  revision: number;
  forceCreate: boolean;
};

const AUTOSAVE_DELAY_MS = 700;

type GroupTrainingPageProps = {
  moduleKey: GroupTrainingModuleKey;
  statisticsModuleKey: "u12_statistics" | "u14_statistics";
  title: "U12" | "U14";
  statisticsRoute: string;
};

export function GroupTrainingPage({
  moduleKey,
  statisticsModuleKey,
  title,
  statisticsRoute,
}: GroupTrainingPageProps) {
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule(moduleKey);
  const canEdit = canEditModule(moduleKey);

  const [configuration, setConfiguration] = useState<KindertrainingConfiguration | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [transientSpecialDates, setTransientSpecialDates] = useState<string[]>([]);
  const [specialDateInput, setSpecialDateInput] = useState(() => isoDate(new Date()));
  const [showSpecialDatePicker, setShowSpecialDatePicker] = useState(false);
  const [showQuickAthlete, setShowQuickAthlete] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AttendanceStatus>("open");
  const [sortMode, setSortMode] = useState<AthleteNameSort>(() => readInitialSort(moduleKey));
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState<KindertrainingSession | null>(null);
  const [participants, setParticipants] = useState<KindertrainingParticipant[]>([]);
  const [draft, setDraft] = useState<KindertrainingDraft>({
    state: "scheduled",
    note: "",
    attendance: {},
    environment: null,
    trainerIds: [],
  });
  const [baseline, setBaseline] = useState<KindertrainingDraft | null>(null);
  const [forceCreateSpecial, setForceCreateSpecial] = useState(false);
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<{
    athleteName: string;
    contacts: AthleteEmergencyContact[];
  } | null>(null);
  const [athleteToDeactivate, setAthleteToDeactivate] = useState<KindertrainingParticipant | null>(null);
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
  const sessionRef = useRef<KindertrainingSession | null>(session);
  const participantsRef = useRef(participants);
  const draftRef = useRef(draft);
  const baselineRef = useRef<KindertrainingDraft | null>(baseline);
  const dirtyRef = useRef(false);
  const forceCreateSpecialRef = useRef(forceCreateSpecial);
  const sessionByDateRef = useRef<Record<string, KindertrainingSession | null>>({});

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
      excused: 0,
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
      window.localStorage.setItem(`${SORT_STORAGE_KEY_PREFIX}-${moduleKey}`, sortMode);
    } catch {
      // Lokale Speicherung ist optional; die Sortierung funktioniert trotzdem.
    }
  }, [sortMode]);

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

  function updateDraft(updater: (current: KindertrainingDraft) => KindertrainingDraft): void {
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

  function autosaveLabel() {
    if (autoSaveState === "error") {
      return (
        <>
          <AlertTriangle aria-hidden="true" /> Fehler
        </>
      );
    }

    if (autoSaveState === "saving") {
      return (
        <>
          <RefreshCw className="spin-icon" aria-hidden="true" /> Speichert …
        </>
      );
    }

    if (autoSaveState === "pending" || dirty || forceCreateSpecial) {
      return (
        <>
          <Clock3 aria-hidden="true" /> Wird gespeichert …
        </>
      );
    }

    if (session?.updatedAt) {
      return (
        <>
          <CloudCheck aria-hidden="true" /> {formatSavedAt(session.updatedAt)}
        </>
      );
    }

    return <>Bereit</>;
  }

  if (!canView) return <Navigate to="/kein-zugriff" replace />;

  return (
    <section className="kindertraining-page">
      <div className="kindertraining-heading">
        <div>
          <p className="eyebrow">Training erfassen</p>
          <div className="kindertraining-title-row">
            <h1>{title}</h1>
            {(canViewModule(statisticsModuleKey) || canView) && (
              <Link
                className="icon-button statistics-link"
                to={statisticsRoute}
                aria-label={`${title}-Statistik öffnen`}
                title="Statistik"
              >
                <BarChart3 aria-hidden="true" />
              </Link>
            )}
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
          <section className="training-control-card compact" aria-label="Trainingstag auswählen">
            <div className="training-date-control compact">
              <div className="training-date-buttons">
                <button
                  type="button"
                  className="icon-button"
                  disabled={sessionLoading}
                  onClick={() => moveDate(-1)}
                  aria-label="Vorheriger Trainingstag"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <div className="training-date-display">
                  <strong>{formatLongDate(selectedDate)}</strong>
                  {!selectedDateIsRegular && <span>Sondertraining</span>}
                </div>
                <button
                  type="button"
                  className="icon-button"
                  disabled={sessionLoading}
                  onClick={() => moveDate(1)}
                  aria-label="Nächster Trainingstag"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
                {group.allowSpecialTraining && canEdit && (
                  <button
                    type="button"
                    className="icon-button special-training-action"
                    disabled={sessionLoading}
                    onClick={() => {
                      setSpecialDateInput(today);
                      setShowSpecialDatePicker(true);
                    }}
                    aria-label="Sondertraining anlegen"
                    title="Sondertraining anlegen"
                  >
                    <CalendarPlus aria-hidden="true" />
                  </button>
                )}
                {session?.isSpecial && session.id && canEdit && (
                  <button
                    type="button"
                    className="icon-button special-training-action danger"
                    disabled={sessionLoading || deletingSpecial}
                    onClick={() => void deleteSpecialTraining()}
                    aria-label="Sondertraining löschen"
                    title="Sondertraining löschen"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                )}
              </div>

              {todayIsVisible && selectedDate !== today && (
                <div className="training-date-shortcuts">
                  <button
                    type="button"
                    className="text-button"
                    disabled={sessionLoading}
                    onClick={() => void changeDate(today)}
                  >
                    Heute
                  </button>
                </div>
              )}
            </div>
          </section>

          {showSpecialDatePicker && (
            <section className="special-training-picker" role="dialog" aria-modal="true">
              <div>
                <strong>Sondertraining auswählen</strong>
                <input
                  type="date"
                  value={specialDateInput}
                  onChange={(event) => setSpecialDateInput(event.target.value)}
                />
              </div>
              <div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowSpecialDatePicker(false)}
                >
                  Abbrechen
                </button>
                <button type="button" className="primary-button" onClick={confirmSpecialDate}>
                  Datum anlegen
                </button>
              </div>
            </section>
          )}

          {sessionLoading ? (
            <div className="management-loading">
              <span className="spinner" aria-hidden="true" />
              Training wird geladen …
            </div>
          ) : baseline ? (
            <>
              <section className="attendance-workspace compact">
                <div className="attendance-toolbar">
                  <div className="attendance-category-tabs" role="tablist" aria-label="Status">
                    {STATUS_OPTIONS.map((status) => (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeCategory === status.value}
                        className={`${status.value} ${activeCategory === status.value ? "active" : ""}`}
                        onClick={() => setActiveCategory(status.value)}
                        key={status.value}
                      >
                        <span>{status.label}</span>
                        <strong>{counts[status.value]}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="attendance-list-tools">
                    <div className="attendance-sort-row">
                      <div className="name-sort-toggle" aria-label="Namenssortierung">
                        <button
                          type="button"
                          className={sortMode === "firstName" ? "active" : ""}
                          onClick={() => setSortMode("firstName")}
                        >
                          Vorname
                        </button>
                        <button
                          type="button"
                          className={sortMode === "lastName" ? "active" : ""}
                          onClick={() => setSortMode("lastName")}
                        >
                          Nachname
                        </button>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          className="icon-button add-child-icon-button"
                          onClick={() => void openQuickAthlete()}
                          disabled={sessionLoading}
                          title="Kind hinzufügen"
                          aria-label="Kind hinzufügen"
                        >
                          <UserPlus aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <label className="attendance-search compact">
                      <Search aria-hidden="true" />
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Name suchen"
                      />
                    </label>
                  </div>

                  <div className="attendance-progress-row">
                    <span>
                      <CheckCheck aria-hidden="true" />
                      {participants.length - counts.open} von {participants.length} erfasst
                    </span>
                    {canEdit && counts.open > 0 && draft.state !== "cancelled" && (
                      <button type="button" className="text-button" onClick={markAllOpenAbsent}>
                        Alle offenen auf Fehlt
                      </button>
                    )}
                  </div>
                </div>

                {draft.state === "cancelled" ? (
                  <div className="training-cancelled-state">
                    <AlertTriangle aria-hidden="true" />
                    <div>
                      <strong>Training abgesagt</strong>
                      <p>Die Anwesenheitsauswahl ist gesperrt, bis die Absage aufgehoben wird.</p>
                    </div>
                  </div>
                ) : categoryParticipants.length === 0 ? (
                  <div className="inline-empty-state attendance-empty">
                    {searchTerm
                      ? "Keine passenden Kinder in dieser Kategorie."
                      : activeCategory === "open"
                        ? "Alle Kinder wurden bereits zugeordnet."
                        : "In dieser Kategorie befinden sich noch keine Kinder."}
                  </div>
                ) : (
                  <div className="compact-attendance-list">
                    {categoryParticipants.map((participant) => {
                      const currentStatus = draft.attendance[participant.athleteId] ?? "open";
                      return (
                        <article className="compact-attendance-row" key={participant.athleteId}>
                          <div className="compact-athlete-name">
                            <strong>{athleteDisplayName(participant, sortMode)}</strong>
                            <small>
                              {participant.birthYear ? `Jg. ${participant.birthYear}` : "Jg. –"}
                            </small>
                          </div>

                          <div className="compact-athlete-actions">
                            {participant.contacts.length > 0 ? (
                              <button
                                type="button"
                                className="icon-button contact-button"
                                onClick={() => setSelectedContacts({
                                  athleteName: athleteDisplayName(participant, sortMode),
                                  contacts: participant.contacts,
                                })}
                                aria-label={`Kontaktdaten von ${athleteDisplayName(participant, sortMode)} anzeigen`}
                                title="Notfallkontakte"
                              >
                                <Phone aria-hidden="true" />
                              </button>
                            ) : (
                              <span className="contact-button-placeholder" aria-hidden="true" />
                            )}
                            {canEdit && participant.isActive && (
                              <button
                                type="button"
                                className="icon-button athlete-more-button"
                                onClick={() => {
                                  setDeactivationConfirmed(false);
                                  setAthleteToDeactivate(participant);
                                }}
                                aria-label={`${athleteDisplayName(participant, sortMode)} verwalten`}
                                title="Athlet verwalten"
                              >
                                <MoreVertical aria-hidden="true" />
                              </button>
                            )}
                          </div>

                          <div className="compact-status-actions" aria-label="Status wählen">
                            {STATUS_OPTIONS.filter((status) => status.value !== currentStatus).map(
                              (status) => (
                                <button
                                  type="button"
                                  className={status.value}
                                  onClick={() => setAttendance(participant.athleteId, status.value)}
                                  disabled={!canEdit}
                                  key={status.value}
                                >
                                  {status.shortLabel}
                                </button>
                              ),
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <details
                className="training-details-panel"
                open={draft.state === "cancelled" || draft.note.length > 0}
              >
                <summary>
                  <Settings2 aria-hidden="true" />
                  Trainingseinstellungen und Notiz
                </summary>
                <div className="training-details-content">
                  <fieldset className="training-environment-field">
                    <legend><MapPin aria-hidden="true" /> Trainingsort</legend>
                    <div className="segmented-control four-options">
                      {([
                        [null, "Offen"],
                        ["indoor", "Indoor"],
                        ["outdoor", "Outdoor"],
                        ["mixed", "Gemischt"],
                      ] as const).map(([value, label]) => (
                        <button
                          type="button"
                          className={draft.environment === value ? "active" : ""}
                          onClick={() => setEnvironment(value)}
                          disabled={!canEdit}
                          key={label}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="training-trainer-field">
                    <div className="trainer-field-heading">
                      <legend><UsersRound aria-hidden="true" /> Anwesende Trainer</legend>
                      {(session?.availableTrainers ?? []).length > 0 && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setShowAllTrainers((current) => !current)}
                        >
                          {showAllTrainers ? "Nur Gruppentrainer" : `Alle Trainer anzeigen${hiddenTrainerCount > 0 ? ` (${hiddenTrainerCount})` : ""}`}
                        </button>
                      )}
                    </div>
                    {(session?.availableTrainers ?? []).length === 0 ? (
                      <div className="inline-empty-state compact-empty-state">
                        Noch keine Trainer angelegt.
                        <Link to="/module/athletes?tab=trainers">Trainer verwalten</Link>
                      </div>
                    ) : visibleTrainers.length === 0 ? (
                      <div className="inline-empty-state compact-empty-state">
                        Der Trainingsgruppe ist noch kein Trainer zugeordnet.
                        <button type="button" className="text-button" onClick={() => setShowAllTrainers(true)}>Alle Trainer anzeigen</button>
                      </div>
                    ) : (
                      <div className="trainer-checkbox-grid">
                        {visibleTrainers.map((trainer) => {
                          const isGroupTrainer = groupTrainerIds.includes(trainer.id);
                          return (
                            <label className="trainer-checkbox" key={trainer.id}>
                              <input
                                type="checkbox"
                                checked={draft.trainerIds.includes(trainer.id)}
                                onChange={(event) => toggleTrainer(trainer.id, event.target.checked)}
                                disabled={!canEdit}
                              />
                              <span>
                                <strong>{trainer.firstName} {trainer.lastName}</strong>
                                <small>{!trainer.isActive ? "Inaktiv" : isGroupTrainer ? "Gruppentrainer" : "Aushilfe"}</small>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {session?.usesDefaults && !session?.id && draft.trainerIds.length > 0 && (
                      <small>Gruppentrainer aus dem letzten Training vorgeschlagen.</small>
                    )}
                  </fieldset>

                  <label className="cancel-training-toggle">
                    <input
                      type="checkbox"
                      checked={draft.state === "cancelled"}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          state: event.target.checked ? "cancelled" : "scheduled",
                        }))
                      }
                    />
                    <span>
                      <strong>Training absagen</strong>
                      <small>Die Teilnehmerstände bleiben gespeichert.</small>
                    </span>
                  </label>

                  <label className="training-note-field">
                    Tagesnotiz
                    <textarea
                      value={draft.note}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateDraft((current) => ({ ...current, note: event.target.value }))
                      }
                      maxLength={3000}
                      rows={3}
                      placeholder="Optional"
                    />
                    <small>{draft.note.length} / 3000 Zeichen</small>
                  </label>
                </div>
              </details>

              {canEdit && (
                <div className={`training-autosave-status ${autoSaveState}`} aria-live="polite">
                  {autoSaveState === "error" ? (
                    <>
                      <AlertTriangle aria-hidden="true" />
                      <span>Speichern fehlgeschlagen</span>
                      <button type="button" className="text-button" onClick={() => void retrySave()}>
                        Erneut versuchen
                      </button>
                    </>
                  ) : autoSaveState === "saving" ? (
                    <>
                      <RefreshCw className="spin-icon" aria-hidden="true" />
                      <span>Wird gespeichert …</span>
                    </>
                  ) : autoSaveState === "pending" || dirty || forceCreateSpecial ? (
                    <>
                      <Clock3 aria-hidden="true" />
                      <span>Wird gleich gespeichert …</span>
                    </>
                  ) : session?.updatedAt ? (
                    <>
                      <CloudCheck aria-hidden="true" />
                      <span>Gespeichert {formatSavedAt(session.updatedAt)}</span>
                    </>
                  ) : (
                    <>
                      <CloudCheck aria-hidden="true" />
                      <span>Automatisches Speichern ist aktiv</span>
                    </>
                  )}
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      {athleteToDeactivate && (
        <div
          className="contact-dialog-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!deactivatingAthlete) {
              setAthleteToDeactivate(null);
              setDeactivationConfirmed(false);
            }
          }}
        >
          <section
            className="contact-dialog athlete-deactivate-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="athlete-deactivate-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="contact-dialog-heading">
              <div>
                <p className="eyebrow">Athlet verwalten</p>
                <h2 id="athlete-deactivate-title">
                  {athleteDisplayName(athleteToDeactivate, sortMode)}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setAthleteToDeactivate(null);
                  setDeactivationConfirmed(false);
                }}
                disabled={deactivatingAthlete}
                aria-label="Dialog schließen"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="alert warning compact-alert">
              Das Kind wird ab sofort inaktiv und aus allen aktiven Gruppen entfernt.
              Vergangene Trainings und Statistiken bleiben erhalten.
            </div>

            <label className="deactivation-confirmation">
              <input
                type="checkbox"
                checked={deactivationConfirmed}
                onChange={(event) => setDeactivationConfirmed(event.target.checked)}
                disabled={deactivatingAthlete}
              />
              <span>
                <strong>Wirklich inaktiv setzen</strong>
                <small>Diese zusätzliche Bestätigung verhindert versehentliche Änderungen.</small>
              </span>
            </label>

            <div className="management-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setAthleteToDeactivate(null);
                  setDeactivationConfirmed(false);
                }}
                disabled={deactivatingAthlete}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void deactivateSelectedAthlete()}
                disabled={!deactivationConfirmed || deactivatingAthlete}
              >
                <UserMinus aria-hidden="true" />
                {deactivatingAthlete ? "Wird deaktiviert …" : "Athlet inaktiv setzen"}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedContacts && (
        <div className="contact-dialog-backdrop" role="presentation" onMouseDown={() => setSelectedContacts(null)}>
          <section
            className="contact-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="contact-dialog-heading">
              <div>
                <p className="eyebrow">Kontakt</p>
                <h2 id="contact-dialog-title">{selectedContacts.athleteName}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedContacts(null)} aria-label="Kontakte schließen">
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="contact-dialog-list">
              {selectedContacts.contacts.map((contact) => (
                <article key={contact.id}>
                  <div>
                    <strong>{contact.contactName}</strong>
                    <small>{[contact.relationship, contact.isEmergency ? "Notfallkontakt" : null].filter(Boolean).join(" · ")}</small>
                  </div>
                  <a className="primary-button link-button" href={`tel:${contact.phone}`}>
                    <Phone aria-hidden="true" /> {contact.phone}
                  </a>
                  {contact.notes && <p>{contact.notes}</p>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {showQuickAthlete && (
        <QuickAthleteDialog
          onClose={() => setShowQuickAthlete(false)}
          onSubmit={handleQuickAthlete}
          onCompleted={(result) => void completeQuickAthlete(result)}
        />
      )}
    </section>
  );
}
