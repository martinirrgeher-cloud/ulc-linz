import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudCheck,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  UserCheck,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import {
  loadKindertrainingGroups,
  loadKindertrainingSession,
  saveKindertrainingSession,
} from "@/features/kindertraining/api";
import type {
  AttendanceStatus,
  KindertrainingDraft,
  KindertrainingParticipant,
  KindertrainingSession,
} from "@/features/kindertraining/types";
import { useAuth } from "@/features/auth/AuthContext";

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  shortLabel: string;
  icon: typeof CircleHelp;
}> = [
  { value: "open", label: "Noch offen", shortLabel: "Offen", icon: CircleHelp },
  { value: "present", label: "Anwesend", shortLabel: "Da", icon: UserCheck },
  { value: "excused", label: "Entschuldigt", shortLabel: "Entsch.", icon: Clock3 },
  { value: "absent", label: "Abwesend", shortLabel: "Fehlt", icon: UserMinus },
];

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

export function KindertrainingDraftPage() {
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule("kindertraining");
  const canEdit = canEditModule("kindertraining");

  const [groups, setGroups] = useState<Awaited<ReturnType<typeof loadKindertrainingGroups>>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState<KindertrainingSession | null>(null);
  const [participants, setParticipants] = useState<KindertrainingParticipant[]>([]);
  const [draft, setDraft] = useState<KindertrainingDraft>({
    state: "scheduled",
    note: "",
    attendance: {},
  });
  const [baseline, setBaseline] = useState<KindertrainingDraft | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return draftSignature(draft, participants) !== draftSignature(baseline, participants);
  }, [baseline, draft, participants]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  const visibleParticipants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("de-AT");
    if (!normalizedSearch) return participants;

    return participants.filter((participant) =>
      `${participant.firstName} ${participant.lastName}`
        .toLocaleLowerCase("de-AT")
        .includes(normalizedSearch),
    );
  }, [participants, searchTerm]);

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

  const loadGroups = useCallback(async () => {
    if (!organizationId || !canView) return;

    setGroupsLoading(true);
    setError(null);
    try {
      const loadedGroups = await loadKindertrainingGroups(organizationId);
      setGroups(loadedGroups);
      setSelectedGroupId((current) => {
        if (current && loadedGroups.some((group) => group.id === current)) return current;
        return loadedGroups[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setGroupsLoading(false);
    }
  }, [canView, organizationId]);

  const loadSession = useCallback(async () => {
    if (!organizationId || !selectedGroupId || !canView) return;

    const requestId = ++requestIdRef.current;
    setSessionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const loadedSession = await loadKindertrainingSession(
        organizationId,
        selectedGroupId,
        selectedDate,
      );
      if (requestId !== requestIdRef.current) return;

      const loadedDraft = makeDraft(loadedSession);
      setSession(loadedSession);
      setParticipants(loadedSession.participants);
      setDraft(loadedDraft);
      setBaseline(loadedDraft);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setSession(null);
      setParticipants([]);
      setBaseline(null);
      setError(errorMessage(loadError));
    } finally {
      if (requestId === requestIdRef.current) setSessionLoading(false);
    }
  }, [canView, organizationId, selectedDate, selectedGroupId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroupId) void loadSession();
  }, [loadSession, selectedGroupId]);

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

  function changeGroup(groupId: string): void {
    if (!mayDiscardChanges()) return;
    setSearchTerm("");
    setSelectedGroupId(groupId);
  }

  function changeDate(date: string): void {
    if (!date || !mayDiscardChanges()) return;
    setSearchTerm("");
    setSelectedDate(date);
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
    if (
      !organizationId ||
      !selectedGroupId ||
      !canEdit ||
      !baseline ||
      saving ||
      sessionLoading
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const savedSession = await saveKindertrainingSession({
        organizationId,
        groupId: selectedGroupId,
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
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
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
          <p>Anwesenheit, Absagen und Tagesnotizen direkt am Handy verwalten.</p>
        </div>
        <span
          className={`training-save-badge ${
            dirty ? "dirty" : session?.id ? "saved" : "new"
          }`}
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
          {selectedGroupId && (
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

      {groupsLoading ? (
        <div className="management-loading">
          <span className="spinner" aria-hidden="true" />
          Trainingsgruppen werden geladen …
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <UsersRound aria-hidden="true" />
          <h2>Noch keine aktive Trainingsgruppe</h2>
          <p>Lege zuerst im Modul „Athleten“ eine aktive Trainingsgruppe an.</p>
          <Link className="primary-button link-button" to="/module/athletes">
            Zu Athleten und Gruppen
          </Link>
        </div>
      ) : (
        <>
          <section className="training-control-card" aria-label="Training auswählen">
            <label className="training-group-field">
              <span>Trainingsgruppe</span>
              <select
                value={selectedGroupId}
                disabled={sessionLoading || saving}
                onChange={(event) => changeGroup(event.target.value)}
              >
                {groups.map((group) => (
                  <option value={group.id} key={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="training-date-control">
              <span>Trainingstag</span>
              <div className="training-date-buttons">
                <button
                  type="button"
                  className="icon-button"
                  disabled={sessionLoading || saving}
                  onClick={() => changeDate(addDays(selectedDate, -1))}
                  aria-label="Vorheriger Tag"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <label className="date-picker-button">
                  <CalendarDays aria-hidden="true" />
                  <span>{formatLongDate(selectedDate)}</span>
                  <input
                    type="date"
                    value={selectedDate}
                    disabled={sessionLoading || saving}
                    onChange={(event) => changeDate(event.target.value)}
                    aria-label="Trainingstag auswählen"
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  disabled={sessionLoading || saving}
                  onClick={() => changeDate(addDays(selectedDate, 1))}
                  aria-label="Nächster Tag"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                className="text-button today-button"
                disabled={sessionLoading || saving}
                onClick={() => changeDate(isoDate(new Date()))}
              >
                Heute
              </button>
            </div>
          </section>

          {sessionLoading ? (
            <div className="management-loading">
              <span className="spinner" aria-hidden="true" />
              Training wird geladen …
            </div>
          ) : baseline ? (
            <>
              <section className="attendance-summary" aria-label="Anwesenheitsübersicht">
                <article className="attendance-summary-card total">
                  <UsersRound aria-hidden="true" />
                  <span>
                    <small>Teilnehmer</small>
                    <strong>{participants.length}</strong>
                  </span>
                </article>
                <article className="attendance-summary-card present">
                  <UserCheck aria-hidden="true" />
                  <span>
                    <small>Anwesend</small>
                    <strong>{counts.present}</strong>
                  </span>
                </article>
                <article className="attendance-summary-card excused">
                  <Clock3 aria-hidden="true" />
                  <span>
                    <small>Entschuldigt</small>
                    <strong>{counts.excused}</strong>
                  </span>
                </article>
                <article className="attendance-summary-card open">
                  <CircleHelp aria-hidden="true" />
                  <span>
                    <small>Noch offen</small>
                    <strong>{counts.open}</strong>
                  </span>
                </article>
              </section>

              <section className="attendance-workspace">
                <div className="attendance-list-heading">
                  <div>
                    <p className="eyebrow">{selectedGroup?.name}</p>
                    <h2>Anwesenheit</h2>
                  </div>
                  <label className="attendance-search">
                    <Search aria-hidden="true" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Name suchen"
                    />
                  </label>
                </div>

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
                    <strong>Training abgesagt</strong>
                    <small>Die gespeicherte Teilnehmerliste bleibt erhalten.</small>
                  </span>
                </label>

                {participants.length === 0 ? (
                  <div className="inline-empty-state">
                    Für diesen Tag sind keine aktiven Athleten in der Gruppe erfasst.
                  </div>
                ) : visibleParticipants.length === 0 ? (
                  <div className="inline-empty-state">Kein Athlet entspricht der Suche.</div>
                ) : (
                  <div className="attendance-list">
                    {visibleParticipants.map((participant) => {
                      const status = draft.attendance[participant.athleteId] ?? "open";
                      return (
                        <article
                          className={`attendance-athlete-card status-${status}`}
                          key={participant.athleteId}
                        >
                          <div className="attendance-athlete-name">
                            <span className="athlete-avatar" aria-hidden="true">
                              {participant.firstName.slice(0, 1)}
                              {participant.lastName.slice(0, 1)}
                            </span>
                            <span>
                              <strong>{participant.firstName}</strong>
                              <small>
                                {participant.lastName}
                                {participant.birthYear ? ` · Jg. ${participant.birthYear}` : ""}
                                {!participant.isActive ? " · inaktiv" : ""}
                              </small>
                            </span>
                          </div>

                          <div
                            className="attendance-status-picker"
                            role="group"
                            aria-label={`Status für ${participant.firstName} ${participant.lastName}`}
                          >
                            {STATUS_OPTIONS.map((option) => {
                              const Icon = option.icon;
                              return (
                                <button
                                  type="button"
                                  className={status === option.value ? "active" : ""}
                                  data-status={option.value}
                                  disabled={!canEdit || saving || draft.state === "cancelled"}
                                  onClick={() => setAttendance(participant.athleteId, option.value)}
                                  aria-pressed={status === option.value}
                                  title={option.label}
                                  key={option.value}
                                >
                                  <Icon aria-hidden="true" />
                                  <span className="status-long-label">{option.label}</span>
                                  <span className="status-short-label">{option.shortLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="training-note-card">
                <label>
                  <span>Notiz zum Training</span>
                  <textarea
                    rows={3}
                    value={draft.note}
                    disabled={!canEdit || saving}
                    maxLength={3000}
                    placeholder="Besonderheiten, Trainingsinhalt oder organisatorische Hinweise …"
                    onChange={(event) =>
                      updateDraft((current) => ({ ...current, note: event.target.value }))
                    }
                  />
                  <small>{draft.note.length}/3000 Zeichen</small>
                </label>
              </section>

              <div className="training-action-bar">
                <div className="training-action-status" aria-live="polite">
                  {saving ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Wird gespeichert …
                    </>
                  ) : dirty ? (
                    <>
                      <AlertTriangle aria-hidden="true" /> Änderungen noch nicht gespeichert
                    </>
                  ) : session?.updatedAt ? (
                    <>
                      <CloudCheck aria-hidden="true" /> Gespeichert {formatSavedAt(session.updatedAt)}
                    </>
                  ) : (
                    <>Noch kein Eintrag für diesen Tag</>
                  )}
                </div>
                <div className="training-action-buttons">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={discardChanges}
                    disabled={!canEdit || !dirty || saving}
                  >
                    <RotateCcw aria-hidden="true" />
                    Verwerfen
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void saveTraining()}
                    disabled={!canEdit || !dirty || saving}
                  >
                    <Save aria-hidden="true" />
                    Speichern
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
