import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CloudCheck,
  CloudUpload,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate } from "react-router-dom";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import { MobileDaySelector } from "@/components/ui/MobileDaySelector";
import {
  loadPerformanceContext,
  loadPerformanceWeek,
  savePerformanceAvailability,
} from "@/features/performance-registration/api";
import {
  addWeeks,
  formatTrainingDate,
  formatWeekRange,
  isoWeekNumber,
  isCurrentWeek,
  PERFORMANCE_WEEKDAY_LABELS,
  startOfIsoWeek,
} from "@/features/performance-registration/date";
import type {
  PerformanceAthlete,
  PerformanceAvailability,
  PerformanceAvailabilityDraft,
  PerformanceAvailabilityStatus,
  PerformanceContext,
  PerformanceWeek,
} from "@/features/performance-registration/types";
import { useAuth } from "@/features/auth/AuthContext";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/performance-registration.css";
import "@/styles/mobile-day-selector.css";
import "@/styles/performance-registration-mobile.css";
type PageMode = "registration" | "overview";
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

type DraftKeyParts = {
  athleteId: string;
  date: string;
};

const AUTOSAVE_DELAY_MS = 650;
const STATUS_OPTIONS: Array<{
  value: PerformanceAvailabilityStatus;
  label: string;
  matrixLabel: string;
}> = [
  { value: "open", label: "Offen", matrixLabel: "–" },
  { value: "coming", label: "Ja", matrixLabel: "Ja" },
  { value: "maybe", label: "Vielleicht", matrixLabel: "?" },
  { value: "unavailable", label: "Nein", matrixLabel: "Nein" },
];

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Leistungsgruppen-Daten konnten nicht verarbeitet werden.", "performance_registration");
}

function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

function emptyDraft(): PerformanceAvailabilityDraft {
  return {
    status: "open",
    availableFrom: "",
    availableUntil: "",
    comment: "",
  };
}

function availabilityToDraft(
  availability: PerformanceAvailability | undefined,
): PerformanceAvailabilityDraft {
  return availability
    ? {
        status: availability.status,
        availableFrom: "",
        availableUntil: "",
        comment: availability.comment,
      }
    : emptyDraft();
}

function draftKey(athleteId: string, date: string): string {
  return `${athleteId}|${date}`;
}

function parseDraftKey(value: string): DraftKeyParts | null {
  const [athleteId, date] = value.split("|");
  return athleteId && date ? { athleteId, date } : null;
}

function sameDraft(
  left: PerformanceAvailabilityDraft | undefined,
  right: PerformanceAvailabilityDraft,
): boolean {
  return Boolean(left)
    && left?.status === right.status
    && left.comment === right.comment;
}

function buildDrafts(week: PerformanceWeek): Record<string, PerformanceAvailabilityDraft> {
  const drafts: Record<string, PerformanceAvailabilityDraft> = {};
  for (const athlete of week.athletes) {
    for (const date of week.dates) {
      drafts[draftKey(athlete.id, date.date)] = availabilityToDraft(
        athlete.availability.find((item) => item.date === date.date),
      );
    }
  }
  return drafts;
}

function statusLabel(status: PerformanceAvailabilityStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Offen";
}

function statusClass(status: PerformanceAvailabilityStatus): string {
  return `performance-status-${status}`;
}

function formatDeadline(value: string | null): string {
  if (!value) return "Kein Anmeldeschluss";
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isRegistrationLocked(
  deadlineAt: string | null,
  allowLateRegistration: boolean,
  canManage: boolean,
): boolean {
  return Boolean(
    deadlineAt
      && !allowLateRegistration
      && !canManage
      && Date.now() > new Date(deadlineAt).getTime(),
  );
}

function AvailabilityFields({
  draft,
  disabled,
  onChange,
}: {
  draft: PerformanceAvailabilityDraft;
  disabled: boolean;
  onChange: (changes: Partial<PerformanceAvailabilityDraft>) => void;
}) {
  return (
    <div className="performance-availability-fields compact-registration-fields">
      <div className="performance-status-options performance-registration-status" role="group" aria-label="Trainingsanmeldung">
        {STATUS_OPTIONS.map((option) => (
          <button
            type="button"
            className={`${statusClass(option.value)} ${draft.status === option.value ? "active" : ""}`}
            aria-pressed={draft.status === option.value}
            onClick={() => onChange({ status: option.value })}
            disabled={disabled}
            key={option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="performance-comment-field compact-comment-field">
        <span>Hinweis</span>
        <input
          type="text"
          value={draft.comment}
          onChange={(event) => onChange({ comment: event.target.value })}
          maxLength={500}
          placeholder="Optionaler Hinweis"
          disabled={disabled}
        />
      </label>
    </div>
  );
}

export function PerformanceRegistrationPage() {
  const { appContext, canViewModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule("performance_registration");
  const [context, setContext] = useState<PerformanceContext | null>(null);
  const [mode, setMode] = useState<PageMode>("registration");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [week, setWeek] = useState<PerformanceWeek | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PerformanceAvailabilityDraft>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftsRef = useRef(drafts);
  const dirtyRef = useRef(dirtyKeys);
  const savingRef = useRef(false);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    dirtyRef.current = dirtyKeys;
  }, [dirtyKeys]);

  const loadContext = useCallback(async () => {
    if (!organizationId || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadPerformanceContext(organizationId);
      setContext(loaded);
      setSelectedGroupId((current) => (
        loaded.groups.some((group) => group.id === current)
          ? current
          : loaded.groups[0]?.id ?? ""
      ));
      setMode("registration");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canView, organizationId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const loadWeek = useCallback(async (silent = false) => {
    if (!organizationId || !selectedGroupId) {
      setWeek(null);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const loaded = await loadPerformanceWeek(organizationId, selectedGroupId, weekStart);
      setWeek(loaded);
      setDrafts(buildDrafts(loaded));
      setDirtyKeys(new Set());
      setSaveState("idle");
      setSelectedAthleteId((current) => {
        if (loaded.athletes.some((athlete) => athlete.id === current)) return current;
        if (context?.athlete && loaded.athletes.some((athlete) => athlete.id === context.athlete?.id)) {
          return context.athlete.id;
        }
        return loaded.athletes[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [context?.athlete, organizationId, selectedGroupId, weekStart]);

  useEffect(() => {
    if (context && selectedGroupId) void loadWeek();
  }, [context, loadWeek, selectedGroupId]);

  const flushDirty = useCallback(async (): Promise<boolean> => {
    if (!organizationId || !selectedGroupId || savingRef.current) {
      return dirtyRef.current.size === 0;
    }

    if (dirtyRef.current.size === 0) return true;

    savingRef.current = true;
    setSaveState("saving");
    setError(null);

    try {
      for (let pass = 0; pass < 4 && dirtyRef.current.size > 0; pass += 1) {
        const keys = [...dirtyRef.current];
        for (const key of keys) {
          const parts = parseDraftKey(key);
          const draft = draftsRef.current[key];
          if (!parts || !draft) continue;
          const snapshot = { ...draft, availableFrom: "", availableUntil: "" };

          await savePerformanceAvailability({
            organizationId,
            groupId: selectedGroupId,
            personId: parts.athleteId,
            trainingDate: parts.date,
            target: "athlete",
            draft: snapshot,
          });

          setDirtyKeys((current) => {
            const next = new Set(current);
            if (sameDraft(draftsRef.current[key], snapshot)) next.delete(key);
            dirtyRef.current = next;
            return next;
          });
        }
      }

      const completed = dirtyRef.current.size === 0;
      setSaveState(completed ? "saved" : "pending");
      return completed;
    } catch (saveError) {
      setSaveState("error");
      setError(errorMessage(saveError));
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [organizationId, selectedGroupId]);

  useEffect(() => {
    if (dirtyKeys.size === 0 || savingRef.current) return undefined;
    setSaveState("pending");
    const timer = window.setTimeout(() => void flushDirty(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dirtyKeys, flushDirty]);

  useNavigationGuard(dirtyKeys.size > 0 ? async () => flushDirty() : null);

  function updateDraft(
    athleteId: string,
    date: string,
    changes: Partial<PerformanceAvailabilityDraft>,
  ) {
    const key = draftKey(athleteId, date);
    setDrafts((current) => {
      const next = {
        ...current,
        [key]: {
          ...(current[key] ?? emptyDraft()),
          ...changes,
          availableFrom: "",
          availableUntil: "",
        },
      };
      draftsRef.current = next;
      return next;
    });
    setDirtyKeys((current) => {
      const next = new Set(current).add(key);
      dirtyRef.current = next;
      return next;
    });
    setSaveState("pending");
  }

  async function changeWeek(amount: number) {
    if (!(await flushDirty())) return;
    setWeekStart((current) => addWeeks(current, amount));
  }

  async function changeGroup(groupId: string) {
    if (!(await flushDirty())) return;
    setSelectedGroupId(groupId);
  }

  async function changeAthlete(athleteId: string) {
    if (!(await flushDirty())) return;
    setSelectedAthleteId(athleteId);
  }

  async function goToCurrentWeek() {
    if (!(await flushDirty())) return;
    setWeekStart(startOfIsoWeek(new Date()));
  }

  async function refreshWeek() {
    if (!(await flushDirty())) return;
    await loadWeek(true);
  }

  const selectedGroup = context?.groups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedAthlete = week?.athletes.find((athlete) => athlete.id === selectedAthleteId) ?? null;
  const currentWeekStart = startOfIsoWeek(new Date());
  const maxAthleteWeek = selectedGroup
    ? addWeeks(currentWeekStart, selectedGroup.weeksAhead)
    : currentWeekStart;
  const canMoveNext = context?.canManage || weekStart < maxAthleteWeek;

  if (!canView || !organizationId) return <Navigate to="/kein-zugriff" replace />;

  return (
    <section className="performance-registration-page performance-registration-v2">
      <div className="page-heading performance-heading compact-page-heading">
        <div>
          <p className="eyebrow">Sprint-Leistungsgruppen</p>
          <h1>Leistungsgruppen</h1>
        </div>
        <div className={`performance-save-indicator ${saveState}`} aria-live="polite">
          {saveState === "pending" && <><CloudUpload aria-hidden="true" /> Wird gespeichert …</>}
          {saveState === "saving" && <><CloudUpload aria-hidden="true" /> Speichert …</>}
          {saveState === "saved" && <><CloudCheck aria-hidden="true" /> Gespeichert</>}
          {saveState === "error" && <>Speichern fehlgeschlagen</>}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading && !context ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" /> Leistungsgruppen werden geladen …</div>
      ) : !context ? null : context.groups.length === 0 ? (
        <div className="empty-state">
          <UsersRound aria-hidden="true" />
          <h2>Noch keine Leistungsgruppe verfügbar</h2>
          <p>Aktiviere die Trainingsanmeldung bei mindestens einer Trainingsgruppe.</p>
        </div>
      ) : (
        <>
          <div className="performance-mode-tabs performance-mode-tabs-v2 ui-tabs" role="tablist" aria-label="Leistungsgruppenansicht">
            <button type="button" role="tab" aria-selected={mode === "registration"} className={mode === "registration" ? "active" : ""} onClick={() => setMode("registration")}>
              <CalendarCheck aria-hidden="true" /> Anmeldung
            </button>
            <button type="button" role="tab" aria-selected={mode === "overview"} className={mode === "overview" ? "active" : ""} onClick={() => setMode("overview")}>
              <UsersRound aria-hidden="true" /> Übersicht
            </button>
          </div>

          <div className="performance-controls-card performance-controls-v2">
            {context.groups.length > 1 ? (
              <label className="performance-group-select ui-labeled-field">
                <span className="ui-field-label">Leistungsgruppe</span>
                <select className="ui-field-control" value={selectedGroupId} onChange={(event) => void changeGroup(event.target.value)}>
                  {context.groups.map((group) => (
                    <option value={group.id} key={group.id}>{group.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="performance-single-group">
                <small>Leistungsgruppe</small>
                <strong>{selectedGroup?.name}</strong>
              </div>
            )}

            <div className="performance-week-navigation">
              <button type="button" className="icon-button" onClick={() => void changeWeek(-1)} aria-label="Vorherige Woche">
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="performance-week-label" onClick={() => void goToCurrentWeek()}>
                <strong>KW {isoWeekNumber(weekStart)}</strong>
                <span>{formatWeekRange(weekStart)}</span>
                {isCurrentWeek(weekStart) && <small>Aktuelle Woche</small>}
              </button>
              <button type="button" className="icon-button" onClick={() => void changeWeek(1)} aria-label="Nächste Woche" disabled={!canMoveNext}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>

            <button type="button" className="icon-button" onClick={() => void refreshWeek()} disabled={refreshing} aria-label="Woche aktualisieren" title="Aktualisieren">
              <RefreshCw className={refreshing ? "spin" : ""} aria-hidden="true" />
            </button>
          </div>

          {selectedGroup && (
            <div className="performance-deadline-note">
              Anmeldung bis {PERFORMANCE_WEEKDAY_LABELS[selectedGroup.deadlineWeekday]} {selectedGroup.deadlineTime} vor Beginn der Trainingswoche.
              {selectedGroup.allowLateRegistration
                ? " Späte Änderungen werden markiert."
                : " Danach sind Änderungen gesperrt."}
            </div>
          )}

          {loading || !week ? (
            <div className="management-loading"><div className="spinner" aria-hidden="true" /> Woche wird geladen …</div>
          ) : week.athletes.length === 0 ? (
            <div className="empty-state">
              <UsersRound aria-hidden="true" />
              <h2>Keine Athleten in dieser Leistungsgruppe</h2>
              <p>Ordne der Gruppe zuerst aktive Athleten zu.</p>
            </div>
          ) : mode === "registration" ? (
            <RegistrationPanel
              context={context}
              week={week}
              selectedAthlete={selectedAthlete}
              selectedAthleteId={selectedAthleteId}
              drafts={drafts}
              onSelectAthlete={changeAthlete}
              onChange={updateDraft}
            />
          ) : (
            <WeekOverview
              week={week}
              drafts={drafts}
              selectedAthleteId={selectedAthleteId}
              onOpenAthlete={(athleteId) => {
                setSelectedAthleteId(athleteId);
                setMode("registration");
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function RegistrationPanel({
  context,
  week,
  selectedAthlete,
  selectedAthleteId,
  drafts,
  onSelectAthlete,
  onChange,
}: {
  context: PerformanceContext;
  week: PerformanceWeek;
  selectedAthlete: PerformanceAthlete | null;
  selectedAthleteId: string;
  drafts: Record<string, PerformanceAvailabilityDraft>;
  onSelectAthlete: (athleteId: string) => Promise<void>;
  onChange: (
    athleteId: string,
    date: string,
    changes: Partial<PerformanceAvailabilityDraft>,
  ) => void;
}) {
  if (!selectedAthlete) return null;
  const editingSomeoneElse = context.athlete?.id && context.athlete.id !== selectedAthlete.id;

  return (
    <div className="performance-registration-panel">
      <div className="performance-athlete-picker-row">
        <label className="ui-labeled-field">
          <span className="ui-field-label">Anmeldung für</span>
          <select className="ui-field-control" value={selectedAthleteId} onChange={(event) => void onSelectAthlete(event.target.value)}>
            {week.athletes.map((athlete) => (
              <option value={athlete.id} key={athlete.id}>{personName(athlete)}</option>
            ))}
          </select>
        </label>
        {editingSomeoneElse && (
          <div className="performance-proxy-note">Du bearbeitest die Anmeldung von {personName(selectedAthlete)}.</div>
        )}
      </div>

      <div className="performance-day-list">
        {week.dates.map((date) => {
          const draft = drafts[draftKey(selectedAthlete.id, date.date)] ?? emptyDraft();
          const sourceAvailability = selectedAthlete.availability.find((item) => item.date === date.date);
          const locked = isRegistrationLocked(
            date.deadlineAt,
            week.group.allowLateRegistration,
            context.canManage,
          );
          return (
            <article className={`performance-registration-day ${statusClass(draft.status)}`} key={date.date}>
              <div className="performance-registration-day-heading">
                <div>
                  <strong>{formatTrainingDate(date.date)}</strong>
                  <small>Anmeldung bis {formatDeadline(date.deadlineAt)}</small>
                </div>
                {locked
                  ? <span className="locked-badge">Geschlossen</span>
                  : sourceAvailability?.isLate && <span className="late-badge">Nachgemeldet</span>}
              </div>
              <AvailabilityFields
                draft={draft}
                disabled={locked}
                onChange={(changes) => onChange(selectedAthlete.id, date.date, changes)}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WeekOverview({
  week,
  drafts,
  selectedAthleteId,
  onOpenAthlete,
}: {
  week: PerformanceWeek;
  drafts: Record<string, PerformanceAvailabilityDraft>;
  selectedAthleteId: string;
  onOpenAthlete: (athleteId: string) => void;
}) {
  const daySummaries = useMemo(() => (
    week.dates.map((date) => {
      const counts: Record<PerformanceAvailabilityStatus, number> = {
        open: 0,
        coming: 0,
        maybe: 0,
        unavailable: 0,
      };
      for (const athlete of week.athletes) {
        const draft = drafts[draftKey(athlete.id, date.date)] ?? emptyDraft();
        counts[draft.status] += 1;
      }
      return { date, counts };
    })
  ), [drafts, week.athletes, week.dates]);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    setSelectedDate((current) => {
      if (week.dates.some((date) => date.date === current)) return current;
      return week.dates[0]?.date ?? "";
    });
  }, [week.dates]);

  const activeDate = selectedDate || week.dates[0]?.date || "";
  const activeSummary = daySummaries.find(({ date }) => date.date === activeDate);

  if (week.dates.length === 0) {
    return (
      <div className="empty-state">
        <CalendarCheck aria-hidden="true" />
        <h2>Keine Trainingstage hinterlegt</h2>
        <p>Lege bei der Leistungsgruppe zuerst reguläre Trainingstage fest.</p>
      </div>
    );
  }

  return (
    <div className="performance-week-overview-v2">
      <div className="performance-week-overview-desktop">
        <div className="performance-day-summary-list">
          {daySummaries.map(({ date, counts }) => (
            <article key={date.date}>
              <strong>{formatTrainingDate(date.date)}</strong>
              <span className="performance-count coming">{counts.coming} Ja</span>
              <span className="performance-count maybe">{counts.maybe} Vielleicht</span>
              <span className="performance-count unavailable">{counts.unavailable} Nein</span>
              <span className="performance-count open">{counts.open} Offen</span>
            </article>
          ))}
        </div>

        <div className="performance-matrix-scroll" aria-label="Wochenübersicht der Leistungsgruppe">
          <table className="performance-registration-matrix">
            <thead>
              <tr>
                <th>Athlet</th>
                {week.dates.map((date) => (
                  <th key={date.date} title={formatTrainingDate(date.date)}>
                    <span>{PERFORMANCE_WEEKDAY_LABELS[date.weekday]}</span>
                    <small>{date.date.slice(8, 10)}.</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {week.athletes.map((athlete) => (
                <tr className={athlete.id === selectedAthleteId ? "selected" : ""} key={athlete.id}>
                  <th>
                    <button type="button" onClick={() => onOpenAthlete(athlete.id)}>
                      {personName(athlete)}
                    </button>
                  </th>
                  {week.dates.map((date) => {
                    const draft = drafts[draftKey(athlete.id, date.date)] ?? emptyDraft();
                    const option = STATUS_OPTIONS.find((item) => item.value === draft.status);
                    return (
                      <td key={date.date}>
                        <button
                          type="button"
                          className={`performance-matrix-status ${statusClass(draft.status)}`}
                          title={`${personName(athlete)} · ${formatTrainingDate(date.date)} · ${statusLabel(draft.status)}`}
                          aria-label={`${personName(athlete)} am ${formatTrainingDate(date.date)}: ${statusLabel(draft.status)}. Anmeldung öffnen.`}
                          onClick={() => onOpenAthlete(athlete.id)}
                        >
                          {option?.matrixLabel ?? "–"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="performance-week-overview-mobile" aria-label="Mobile Wochenübersicht der Leistungsgruppe">
        <MobileDaySelector
          label="Trainingstag auswählen"
          value={activeDate}
          onChange={setSelectedDate}
          options={daySummaries.map(({ date, counts }) => ({
            id: date.date,
            label: PERFORMANCE_WEEKDAY_LABELS[date.weekday] ?? "Tag",
            dateLabel: `${date.date.slice(8, 10)}.${date.date.slice(5, 7)}.`,
            meta: `${counts.coming} Ja`,
          }))}
        />

        {activeSummary && (
          <div className="performance-mobile-day-summary" aria-label="Anmeldestatus des ausgewählten Tages">
            <span className="performance-count coming">{activeSummary.counts.coming} Ja</span>
            <span className="performance-count maybe">{activeSummary.counts.maybe} Vielleicht</span>
            <span className="performance-count unavailable">{activeSummary.counts.unavailable} Nein</span>
            <span className="performance-count open">{activeSummary.counts.open} Offen</span>
          </div>
        )}

        <div className="performance-mobile-athlete-list">
          {week.athletes.map((athlete) => {
            const draft = drafts[draftKey(athlete.id, activeDate)] ?? emptyDraft();
            return (
              <button
                type="button"
                className={`performance-mobile-athlete ${athlete.id === selectedAthleteId ? "selected" : ""}`}
                onClick={() => onOpenAthlete(athlete.id)}
                aria-label={`${personName(athlete)} am ${formatTrainingDate(activeDate)}: ${statusLabel(draft.status)}. Anmeldung öffnen.`}
                key={athlete.id}
              >
                <span>
                  <strong>{personName(athlete)}</strong>
                  {draft.comment && <small>{draft.comment}</small>}
                </span>
                <span className={`status-pill ${statusClass(draft.status)}`}>{statusLabel(draft.status)}</span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <p className="performance-matrix-hint">Tag und Athlet antippen, um die Anmeldung dieser Person zu bearbeiten.</p>
    </div>
  );
}
