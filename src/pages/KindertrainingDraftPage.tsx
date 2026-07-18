import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  RotateCcw,
  Search,
  UserCheck,
  UserMinus,
  UsersRound,
  X,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { loadAthleteManagement } from "@/features/athletes/api";
import type { Athlete, TrainingGroup } from "@/features/athletes/types";
import { useAuth } from "@/features/auth/AuthContext";
import type {
  AttendanceStatus,
  DraftTrainingEntry,
} from "@/features/kindertraining/types";

const EMPTY_TRAINING: DraftTrainingEntry = {
  attendance: {},
  note: "",
  cancelled: false,
};

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
  return error instanceof Error
    ? error.message
    : "Die Trainingsdaten konnten nicht geladen werden.";
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

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day, 12, 0, 0);
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

function compareAthletes(left: Athlete, right: Athlete): number {
  return (
    left.firstName.localeCompare(right.firstName, "de-AT", { sensitivity: "base" }) ||
    left.lastName.localeCompare(right.lastName, "de-AT", { sensitivity: "base" })
  );
}

function entryKey(groupId: string, date: string): string {
  return `${groupId}:${date}`;
}

export function KindertrainingDraftPage() {
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule("kindertraining");
  const canEdit = canEditModule("kindertraining");

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftTrainingEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId || !canView) return;

    setLoading(true);
    setError(null);
    try {
      const data = await loadAthleteManagement(organizationId);
      const activeGroups = data.groups
        .filter((group) => group.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

      setAthletes(data.athletes);
      setGroups(activeGroups);
      setSelectedGroupId((current) => {
        if (current && activeGroups.some((group) => group.id === current)) return current;
        return activeGroups[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canView, organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentKey = selectedGroupId ? entryKey(selectedGroupId, selectedDate) : "";
  const currentDraft = currentKey ? drafts[currentKey] ?? EMPTY_TRAINING : EMPTY_TRAINING;

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  const groupAthletes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("de-AT");

    return athletes
      .filter(
        (athlete) =>
          athlete.isActive && athlete.groups.some((group) => group.id === selectedGroupId),
      )
      .filter((athlete) => {
        if (!normalizedSearch) return true;
        return `${athlete.firstName} ${athlete.lastName}`
          .toLocaleLowerCase("de-AT")
          .includes(normalizedSearch);
      })
      .sort(compareAthletes);
  }, [athletes, searchTerm, selectedGroupId]);

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      open: 0,
      present: 0,
      excused: 0,
      absent: 0,
    };

    groupAthletes.forEach((athlete) => {
      result[currentDraft.attendance[athlete.id] ?? "open"] += 1;
    });

    return result;
  }, [currentDraft.attendance, groupAthletes]);

  function updateCurrentDraft(
    updater: (current: DraftTrainingEntry) => DraftTrainingEntry,
  ): void {
    if (!canEdit || !currentKey) return;

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [currentKey]: updater(currentDrafts[currentKey] ?? EMPTY_TRAINING),
    }));
  }

  function setAttendance(athleteId: string, status: AttendanceStatus): void {
    updateCurrentDraft((current) => ({
      ...current,
      attendance: {
        ...current.attendance,
        [athleteId]: status,
      },
    }));
  }

  function resetCurrentDraft(): void {
    if (!canEdit || !currentKey) return;
    setDrafts((currentDrafts) => {
      const next = { ...currentDrafts };
      delete next[currentKey];
      return next;
    });
  }

  if (!canView) return <Navigate to="/kein-zugriff" replace />;

  return (
    <section className="kindertraining-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        Zur Modulübersicht
      </Link>

      <div className="kindertraining-heading">
        <div>
          <p className="eyebrow">Erster Oberflächenentwurf</p>
          <h1>Kindertraining</h1>
          <p>
            Anwesenheit direkt am Handy erfassen. Dieser Entwurf liest bereits echte
            Gruppen und Athleten, speichert Änderungen aber noch nicht in Supabase.
          </p>
        </div>
        <span className="draft-badge">Entwurf · keine Speicherung</span>
      </div>

      {!canEdit && (
        <div className="read-only-notice">
          Du besitzt für dieses Modul nur Leserechte. Eingaben sind daher deaktiviert.
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <div className="management-loading">
          <span className="spinner" aria-hidden="true" />
          Trainingsgruppen und Athleten werden geladen …
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
                onChange={(event) => setSelectedGroupId(event.target.value)}
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
                  onClick={() => setSelectedDate((date) => addDays(date, -1))}
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
                    onChange={(event) => setSelectedDate(event.target.value)}
                    aria-label="Trainingstag auswählen"
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSelectedDate((date) => addDays(date, 1))}
                  aria-label="Nächster Tag"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                className="text-button today-button"
                onClick={() => setSelectedDate(isoDate(new Date()))}
              >
                Heute
              </button>
            </div>
          </section>

          <section className="attendance-summary" aria-label="Anwesenheitsübersicht">
            <article className="attendance-summary-card total">
              <UsersRound aria-hidden="true" />
              <span>
                <small>Teilnehmer</small>
                <strong>{groupAthletes.length}</strong>
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
                <h2>Anwesenheit erfassen</h2>
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
                checked={currentDraft.cancelled}
                disabled={!canEdit}
                onChange={(event) =>
                  updateCurrentDraft((current) => ({
                    ...current,
                    cancelled: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Training abgesagt</strong>
                <small>Die Teilnehmerliste bleibt sichtbar, kann aber nicht bearbeitet werden.</small>
              </span>
            </label>

            {groupAthletes.length === 0 ? (
              <div className="inline-empty-state">
                In dieser Gruppe sind aktuell keine aktiven Athleten zugeordnet.
              </div>
            ) : (
              <div className="attendance-list">
                {groupAthletes.map((athlete) => {
                  const status = currentDraft.attendance[athlete.id] ?? "open";
                  return (
                    <article className={`attendance-athlete-card status-${status}`} key={athlete.id}>
                      <div className="attendance-athlete-name">
                        <span className="athlete-avatar" aria-hidden="true">
                          {athlete.firstName.slice(0, 1)}{athlete.lastName.slice(0, 1)}
                        </span>
                        <span>
                          <strong>{athlete.firstName}</strong>
                          <small>
                            {athlete.lastName}
                            {athlete.birthYear ? ` · Jg. ${athlete.birthYear}` : ""}
                          </small>
                        </span>
                      </div>

                      <div className="attendance-status-picker" role="group" aria-label={`Status für ${athlete.firstName} ${athlete.lastName}`}>
                        {STATUS_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          return (
                            <button
                              type="button"
                              className={status === option.value ? "active" : ""}
                              data-status={option.value}
                              disabled={!canEdit || currentDraft.cancelled}
                              onClick={() => setAttendance(athlete.id, option.value)}
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
                rows={4}
                value={currentDraft.note}
                disabled={!canEdit}
                maxLength={1000}
                placeholder="Besonderheiten, Trainingsinhalt oder organisatorische Hinweise …"
                onChange={(event) =>
                  updateCurrentDraft((current) => ({ ...current, note: event.target.value }))
                }
              />
              <small>{currentDraft.note.length}/1000 Zeichen</small>
            </label>
          </section>

          <div className="training-action-bar">
            <button
              type="button"
              className="secondary-button"
              onClick={resetCurrentDraft}
              disabled={!canEdit || (!drafts[currentKey] && !currentDraft.cancelled)}
            >
              <RotateCcw aria-hidden="true" />
              Entwurf zurücksetzen
            </button>
            <button type="button" className="primary-button" disabled>
              <Check aria-hidden="true" />
              Speichern folgt nach Freigabe
            </button>
          </div>
        </>
      )}
    </section>
  );
}
