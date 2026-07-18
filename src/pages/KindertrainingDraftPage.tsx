import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudCheck,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import {
  createKindertrainingAthlete,
  loadKindertrainingConfiguration,
  loadKindertrainingSession,
  saveKindertrainingSession,
} from "@/features/kindertraining/api";
import { QuickAthleteDialog } from "@/features/kindertraining/QuickAthleteDialog";
import type {
  AthleteNameSort,
  AttendanceStatus,
  KindertrainingConfiguration,
  KindertrainingDraft,
  KindertrainingParticipant,
  KindertrainingSession,
  QuickAthleteResult,
} from "@/features/kindertraining/types";
import { useAuth } from "@/features/auth/AuthContext";

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  shortLabel: string;
  icon: typeof CircleHelp;
}> = [
  { value: "open", label: "Offen", shortLabel: "Offen", icon: CircleHelp },
  { value: "present", label: "Da", shortLabel: "Da", icon: UserCheck },
  { value: "excused", label: "Entschuldigt", shortLabel: "Entsch.", icon: Clock3 },
  { value: "absent", label: "Fehlt", shortLabel: "Fehlt", icon: UserMinus },
];

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

const SORT_STORAGE_KEY = "ulc-kindertraining-name-sort";

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

  return message;
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

function formatRegularWeekdays(weekdays: number[]): string {
  return weekdays.map((weekday) => WEEKDAY_LABELS[weekday] ?? "?").join(" · ");
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

function makeDraft(session: KindertrainingSession): KindertrainingDraft {
  return {
    state: session.state,
    note: session.note,
    attendance: Object.fromEntries(
      session.participants.map((participant) => [participant.athleteId, participant.status]),
    ),
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
  });
}

function readInitialSort(): AthleteNameSort {
  try {
    return window.localStorage.getItem(SORT_STORAGE_KEY) === "lastName"
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

export function KindertrainingDraftPage() {
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule("kindertraining");
  const canEdit = canEditModule("kindertraining");

  const [configuration, setConfiguration] = useState<KindertrainingConfiguration | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [transientSpecialDates, setTransientSpecialDates] = useState<string[]>([]);
  const [specialDateInput, setSpecialDateInput] = useState(() => isoDate(new Date()));
  const [showSpecialDatePicker, setShowSpecialDatePicker] = useState(false);
  const [showQuickAthlete, setShowQuickAthlete] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AttendanceStatus>("open");
  const [sortMode, setSortMode] = useState<AthleteNameSort>(() => readInitialSort());
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState<KindertrainingSession | null>(null);
  const [participants, setParticipants] = useState<KindertrainingParticipant[]>([]);
  const [draft, setDraft] = useState<KindertrainingDraft>({
    state: "scheduled",
    note: "",
    attendance: {},
  });
  const [baseline, setBaseline] = useState<KindertrainingDraft | null>(null);
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const group = configuration?.group ?? null;
  const allSpecialDates = useMemo(
    () => [...new Set([...(configuration?.specialDates ?? []), ...transientSpecialDates])],
    [configuration?.specialDates, transientSpecialDates],
  );

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return draftSignature(draft, participants) !== draftSignature(baseline, participants);
  }, [baseline, draft, participants]);

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

  const selectedDateIsRegular = group
    ? isRegularDate(selectedDate, group.regularWeekdays)
    : false;
  const today = isoDate(new Date());
  const todayIsVisible = group
    ? isRegularDate(today, group.regularWeekdays) || allSpecialDates.includes(today)
    : false;

  const loadConfiguration = useCallback(async () => {
    if (!organizationId || !canView) return;

    setConfigurationLoading(true);
    setError(null);
    try {
      const loadedConfiguration = await loadKindertrainingConfiguration(organizationId);
      setConfiguration(loadedConfiguration);

      if (loadedConfiguration.group) {
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
  }, [canView, organizationId]);

  const loadSession = useCallback(async () => {
    if (!organizationId || !group?.id || !canView) return;

    const requestId = ++requestIdRef.current;
    setSessionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const loadedSession = await loadKindertrainingSession(
        organizationId,
        group.id,
        selectedDate,
      );
      if (requestId !== requestIdRef.current) return;

      const loadedDraft = makeDraft(loadedSession);
      setSession(loadedSession);
      setParticipants(loadedSession.participants);
      setDraft(loadedDraft);
      setBaseline(loadedDraft);
      setActiveCategory("open");
      setSearchTerm("");
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setSession(null);
      setParticipants([]);
      setBaseline(null);
      setError(errorMessage(loadError));
    } finally {
      if (requestId === requestIdRef.current) setSessionLoading(false);
    }
  }, [canView, group?.id, organizationId, selectedDate]);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  useEffect(() => {
    if (group?.id) void loadSession();
  }, [group?.id, loadSession]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
    } catch {
      // Lokale Speicherung ist optional; die Sortierung funktioniert trotzdem.
    }
  }, [sortMode]);

  useEffect(() => {
    function preventAccidentalClose(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", preventAccidentalClose);
    return () => window.removeEventListener("beforeunload", preventAccidentalClose);
  }, [dirty]);

  function mayDiscardChanges(): boolean {
    return !dirty || window.confirm("Ungespeicherte Änderungen wirklich verwerfen?");
  }

  function changeDate(date: string): void {
    if (!date || !mayDiscardChanges()) return;
    setSelectedDate(date);
  }

  function moveDate(direction: -1 | 1): void {
    if (!group) return;
    changeDate(
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
    if (!isRegularDate(specialDateInput, group.regularWeekdays)) {
      setTransientSpecialDates((current) => [...new Set([...current, specialDateInput])]);
    }
    setShowSpecialDatePicker(false);
    changeDate(specialDateInput);
  }

  function updateDraft(updater: (current: KindertrainingDraft) => KindertrainingDraft): void {
    if (!canEdit || saving || sessionLoading) return;
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

  function discardChanges(): void {
    if (!baseline || !dirty || !mayDiscardChanges()) return;
    setDraft(baseline);
    setError(null);
    setSuccessMessage("Lokale Änderungen wurden verworfen.");
  }

  async function saveTraining(): Promise<void> {
    if (!organizationId || !group || !canEdit || !baseline || saving || sessionLoading) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const savedSession = await saveKindertrainingSession({
        organizationId,
        groupId: group.id,
        sessionDate: selectedDate,
        state: draft.state,
        note: draft.note,
        participants,
        attendance: draft.attendance,
        expectedUpdatedAt: session?.updatedAt ?? null,
      });
      const savedDraft = makeDraft(savedSession);
      setSession(savedSession);
      setParticipants(savedSession.participants);
      setDraft(savedDraft);
      setBaseline(savedDraft);
      setSuccessMessage("Training wurde gespeichert.");

      if (savedSession.isSpecial) {
        setTransientSpecialDates((current) => [...new Set([...current, selectedDate])]);
      }
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickAthlete(
    values: { firstName: string; lastName: string; birthYear: number },
    attachExisting: boolean,
  ): Promise<QuickAthleteResult> {
    if (!organizationId) throw new Error("Der Verein ist nicht geladen.");

    return createKindertrainingAthlete(organizationId, {
      ...values,
      sessionDate: selectedDate,
      attachExisting,
    });
  }

  async function completeQuickAthlete(result: QuickAthleteResult): Promise<void> {
    setShowQuickAthlete(false);
    const messages: Record<Exclude<QuickAthleteResult["status"], "duplicate">, string> = {
      created: "Das Kind wurde angelegt und dem Kindertraining zugeordnet.",
      attached: "Das vorhandene Kind wurde aktiviert und dem Kindertraining zugeordnet.",
      already_assigned: "Das Kind war bereits dem Kindertraining zugeordnet.",
    };
    await loadSession();
    if (result.status !== "duplicate") setSuccessMessage(messages[result.status]);
  }

  if (!canView) return <Navigate to="/kein-zugriff" replace />;

  return (
    <section className="kindertraining-page">
      <Link
        to="/"
        className="back-link"
        onClick={(event) => {
          if (!mayDiscardChanges()) event.preventDefault();
        }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Zur Modulübersicht
      </Link>

      <div className="kindertraining-heading">
        <div>
          <p className="eyebrow">Training erfassen</p>
          <h1>Kindertraining</h1>
          <p>Anwesenheit schnell erfassen und direkt am Handy verwalten.</p>
        </div>
        <span
          className={`training-save-badge ${dirty ? "dirty" : session?.id ? "saved" : "new"}`}
          aria-live="polite"
        >
          {dirty ? (
            <>
              <AlertTriangle aria-hidden="true" /> Ungespeichert
            </>
          ) : session?.updatedAt ? (
            <>
              <CloudCheck aria-hidden="true" /> {formatSavedAt(session.updatedAt)}
            </>
          ) : (
            <>Noch nicht gespeichert</>
          )}
        </span>
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
            <button type="button" className="text-button" onClick={() => void loadSession()}>
              <RefreshCw aria-hidden="true" /> Neu laden
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
          Kindertraining wird eingerichtet …
        </div>
      ) : !group ? (
        <div className="empty-state">
          <Settings2 aria-hidden="true" />
          <h2>Kindertrainingsgruppe noch nicht zugeordnet</h2>
          <p>
            Öffne „Athleten und Trainingsgruppen“, bearbeite die gewünschte Gruppe und aktiviere
            „Diese Gruppe im Modul Kindertraining verwenden“.
          </p>
          <Link className="primary-button link-button" to="/module/athletes">
            Trainingsgruppe einrichten
          </Link>
        </div>
      ) : !group.isActive ? (
        <div className="empty-state">
          <UsersRound aria-hidden="true" />
          <h2>Kindertrainingsgruppe ist deaktiviert</h2>
          <p>Aktiviere die Gruppe in der Trainingsgruppenverwaltung wieder.</p>
          <Link className="primary-button link-button" to="/module/athletes">
            Zur Gruppenverwaltung
          </Link>
        </div>
      ) : (
        <>
          <section className="training-control-card compact" aria-label="Trainingstag auswählen">
            <div className="fixed-training-group">
              <span className="eyebrow">Trainingsgruppe</span>
              <strong>{group.name}</strong>
              <small>{formatRegularWeekdays(group.regularWeekdays)}</small>
            </div>

            <div className="training-date-control compact">
              <div className="training-date-buttons">
                <button
                  type="button"
                  className="icon-button"
                  disabled={sessionLoading || saving}
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
                  disabled={sessionLoading || saving}
                  onClick={() => moveDate(1)}
                  aria-label="Nächster Trainingstag"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <div className="training-date-shortcuts">
                {todayIsVisible && selectedDate !== today && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={sessionLoading || saving}
                    onClick={() => changeDate(today)}
                  >
                    Heute
                  </button>
                )}
                {group.allowSpecialTraining && canEdit && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={sessionLoading || saving}
                    onClick={() => {
                      setSpecialDateInput(today);
                      setShowSpecialDatePicker(true);
                    }}
                  >
                    <CalendarPlus aria-hidden="true" /> Sondertraining
                  </button>
                )}
              </div>
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
                  Datum öffnen
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
                    {STATUS_OPTIONS.map((status) => {
                      const Icon = status.icon;
                      return (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeCategory === status.value}
                          className={`${status.value} ${activeCategory === status.value ? "active" : ""}`}
                          onClick={() => setActiveCategory(status.value)}
                          key={status.value}
                        >
                          <Icon aria-hidden="true" />
                          <span>{status.label}</span>
                          <strong>{counts[status.value]}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <div className="attendance-list-tools">
                    <label className="attendance-search compact">
                      <Search aria-hidden="true" />
                      <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Name suchen"
                      />
                    </label>
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
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      className="secondary-button add-child-button"
                      onClick={() => setShowQuickAthlete(true)}
                      disabled={dirty || saving || sessionLoading}
                      title={dirty ? "Bitte zuerst die Anwesenheit speichern." : "Kind hinzufügen"}
                    >
                      <UserPlus aria-hidden="true" />
                      Kind hinzufügen
                    </button>
                  )}
                </div>

                {dirty && canEdit && (
                  <p className="inline-hint">
                    Neue Kinder können nach dem Speichern der aktuellen Änderungen hinzugefügt werden.
                  </p>
                )}

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
                              {participant.birthYear ? `Jahrgang ${participant.birthYear}` : "Kein Jahrgang"}
                            </small>
                          </div>

                          <div className="compact-status-actions" aria-label="Status wählen">
                            {STATUS_OPTIONS.filter((status) => status.value !== currentStatus).map(
                              (status) => (
                                <button
                                  type="button"
                                  className={status.value}
                                  onClick={() => setAttendance(participant.athleteId, status.value)}
                                  disabled={!canEdit || saving}
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
                  <label className="cancel-training-toggle">
                    <input
                      type="checkbox"
                      checked={draft.state === "cancelled"}
                      disabled={!canEdit || saving}
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
                      disabled={!canEdit || saving}
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
                <div className="training-save-bar">
                  <div>
                    {dirty ? (
                      <span className="dirty-message">
                        <AlertTriangle aria-hidden="true" /> Änderungen noch nicht gespeichert
                      </span>
                    ) : session?.updatedAt ? (
                      <span className="saved-message">
                        <CloudCheck aria-hidden="true" /> Gespeichert {formatSavedAt(session.updatedAt)}
                      </span>
                    ) : (
                      <span>Noch nicht gespeichert</span>
                    )}
                  </div>
                  <div className="training-save-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!dirty || saving}
                      onClick={discardChanges}
                    >
                      <RotateCcw aria-hidden="true" />
                      Verwerfen
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!dirty || saving || sessionLoading}
                      onClick={() => void saveTraining()}
                    >
                      <Save aria-hidden="true" />
                      {saving ? "Speichert …" : "Speichern"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </>
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
