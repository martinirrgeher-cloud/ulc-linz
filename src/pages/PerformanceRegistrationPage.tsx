import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudCheck,
  CloudUpload,
  Copy,
  RefreshCw,
  RotateCcw,
  Save,
  UserCheck,
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
import {
  applyPerformanceDefaults,
  copyPerformancePreviousWeek,
  loadPerformanceContext,
  loadPerformanceWeek,
  savePerformanceAvailability,
  savePerformanceDefault,
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
  PerformanceAvailabilityDefault,
  PerformanceAvailabilityDraft,
  PerformanceAvailabilityStatus,
  PerformanceContext,
  PerformanceSaveTarget,
  PerformanceTrainer,
  PerformanceWeek,
} from "@/features/performance-registration/types";
import { useAuth } from "@/features/auth/AuthContext";

type PageMode = "athlete" | "overview" | "trainer";
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type StatusFilter = PerformanceAvailabilityStatus | "all";

type DraftKeyParts = {
  target: PerformanceSaveTarget;
  personId: string;
  date: string;
};

const AUTOSAVE_DELAY_MS = 700;
const STATUS_OPTIONS: Array<{
  value: PerformanceAvailabilityStatus;
  label: string;
  shortLabel: string;
}> = [
  { value: "open", label: "Offen", shortLabel: "Offen" },
  { value: "coming", label: "Komme", shortLabel: "Komme" },
  { value: "maybe", label: "Vielleicht", shortLabel: "Vielleicht" },
  { value: "unavailable", label: "Nicht möglich", shortLabel: "Nein" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Die Leistungsgruppen-Daten konnten nicht verarbeitet werden.";
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
        availableFrom: availability.availableFrom,
        availableUntil: availability.availableUntil,
        comment: availability.comment,
      }
    : emptyDraft();
}

function defaultToDraft(
  value: PerformanceAvailabilityDefault | undefined,
): PerformanceAvailabilityDraft {
  return value
    ? {
        status: value.status,
        availableFrom: value.availableFrom,
        availableUntil: value.availableUntil,
        comment: value.comment,
      }
    : emptyDraft();
}

function draftKey(target: PerformanceSaveTarget, personId: string, date: string): string {
  return `${target}|${personId}|${date}`;
}

function parseDraftKey(value: string): DraftKeyParts | null {
  const [target, personId, date] = value.split("|");
  if (
    (target !== "athlete" && target !== "trainer") ||
    !personId ||
    !date
  ) {
    return null;
  }
  return { target, personId, date };
}

function sameDraft(
  left: PerformanceAvailabilityDraft | undefined,
  right: PerformanceAvailabilityDraft,
): boolean {
  return Boolean(left) &&
    left?.status === right.status &&
    left.availableFrom === right.availableFrom &&
    left.availableUntil === right.availableUntil &&
    left.comment === right.comment;
}

function buildDrafts(week: PerformanceWeek): Record<string, PerformanceAvailabilityDraft> {
  const drafts: Record<string, PerformanceAvailabilityDraft> = {};
  for (const athlete of week.athletes) {
    for (const date of week.dates) {
      drafts[draftKey("athlete", athlete.id, date.date)] = availabilityToDraft(
        athlete.availability.find((item) => item.date === date.date),
      );
    }
  }
  for (const trainer of week.trainers) {
    for (const date of week.dates) {
      drafts[draftKey("trainer", trainer.id, date.date)] = availabilityToDraft(
        trainer.availability.find((item) => item.date === date.date),
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

function formatTimeRange(draft: PerformanceAvailabilityDraft): string {
  if (!draft.availableFrom && !draft.availableUntil) return "";
  if (draft.availableFrom && draft.availableUntil) {
    return `${draft.availableFrom}–${draft.availableUntil}`;
  }
  if (draft.availableFrom) return `ab ${draft.availableFrom}`;
  return `bis ${draft.availableUntil}`;
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
  compact = false,
  onChange,
}: {
  draft: PerformanceAvailabilityDraft;
  disabled: boolean;
  compact?: boolean;
  onChange: (changes: Partial<PerformanceAvailabilityDraft>) => void;
}) {
  return (
    <div className={`performance-availability-fields ${compact ? "compact" : ""}`}>
      <div className="performance-status-options" role="group" aria-label="Trainingsstatus">
        {STATUS_OPTIONS.map((option) => (
          <button
            type="button"
            className={`${statusClass(option.value)} ${draft.status === option.value ? "active" : ""}`}
            aria-pressed={draft.status === option.value}
            onClick={() => onChange({
              status: option.value,
              ...(option.value === "unavailable"
                ? { availableFrom: "", availableUntil: "" }
                : {}),
            })}
            disabled={disabled}
            key={option.value}
          >
            {compact ? option.shortLabel : option.label}
          </button>
        ))}
      </div>

      {draft.status !== "unavailable" && (
        <div className="performance-time-fields">
          <label>
            Von
            <input
              type="time"
              value={draft.availableFrom}
              onChange={(event) => onChange({ availableFrom: event.target.value })}
              disabled={disabled}
            />
          </label>
          <label>
            Bis
            <input
              type="time"
              value={draft.availableUntil}
              onChange={(event) => onChange({ availableUntil: event.target.value })}
              disabled={disabled}
            />
          </label>
        </div>
      )}

      <label className="performance-comment-field">
        Hinweis
        <input
          type="text"
          value={draft.comment}
          onChange={(event) => onChange({ comment: event.target.value })}
          maxLength={500}
          placeholder="z. B. ab 17:30, muss früher weg"
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
  const [mode, setMode] = useState<PageMode>("overview");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [week, setWeek] = useState<PerformanceWeek | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [drafts, setDrafts] = useState<Record<string, PerformanceAvailabilityDraft>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showDefaultWeek, setShowDefaultWeek] = useState(false);
  const [defaultDrafts, setDefaultDrafts] = useState<Record<number, PerformanceAvailabilityDraft>>({});
  const [defaultSaving, setDefaultSaving] = useState(false);
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
      setMode((current) => {
        if (loaded.role === "athlete" && loaded.athlete) return "athlete";
        if (current === "overview" && loaded.canManage) return current;
        if (loaded.canManage) return "overview";
        if (loaded.athlete) return "athlete";
        if (loaded.trainer) return "trainer";
        return "overview";
      });
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
      setSelectedDate((current) => (
        loaded.dates.some((date) => date.date === current)
          ? current
          : loaded.dates[0]?.date ?? ""
      ));

      const selfAthlete = context?.athlete
        ? loaded.athletes.find((athlete) => athlete.id === context.athlete?.id)
        : undefined;
      if (selfAthlete) {
        const defaults: Record<number, PerformanceAvailabilityDraft> = {};
        for (const weekday of loaded.group.regularWeekdays) {
          defaults[weekday] = defaultToDraft(
            selfAthlete.defaults.find((item) => item.weekday === weekday),
          );
        }
        setDefaultDrafts(defaults);
      } else {
        setDefaultDrafts({});
      }
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
          const snapshot = { ...draft };

          await savePerformanceAvailability({
            organizationId,
            groupId: selectedGroupId,
            personId: parts.personId,
            trainingDate: parts.date,
            target: parts.target,
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

  useNavigationGuard(
    dirtyKeys.size > 0
      ? async () => flushDirty()
      : null,
  );

  function updateDraft(
    target: PerformanceSaveTarget,
    personId: string,
    date: string,
    changes: Partial<PerformanceAvailabilityDraft>,
  ) {
    const key = draftKey(target, personId, date);
    setDrafts((current) => {
      const next = {
        ...current,
        [key]: {
          ...(current[key] ?? emptyDraft()),
          ...changes,
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
    setSuccess(null);
  }

  async function changeWeek(amount: number) {
    if (!(await flushDirty())) return;
    setWeekStart((current) => addWeeks(current, amount));
  }

  async function changeGroup(groupId: string) {
    if (!(await flushDirty())) return;
    setSelectedGroupId(groupId);
  }

  async function goToCurrentWeek() {
    if (!(await flushDirty())) return;
    setWeekStart(currentWeekStart);
  }

  async function refreshWeek() {
    if (!(await flushDirty())) return;
    await loadWeek(true);
  }

  async function handleCopyPreviousWeek() {
    if (!organizationId || !selectedGroupId || !context?.athlete) return;
    if (!window.confirm("Die aktuelle Woche wird durch die Einträge der Vorwoche ersetzt. Fortfahren?")) {
      return;
    }
    if (!(await flushDirty())) return;

    setBusyAction(true);
    setError(null);
    try {
      await copyPerformancePreviousWeek(
        organizationId,
        selectedGroupId,
        context.athlete.id,
        weekStart,
      );
      setSuccess("Die Vorwoche wurde übernommen.");
      await loadWeek(true);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusyAction(false);
    }
  }

  async function handleApplyDefaults() {
    if (!organizationId || !selectedGroupId || !context?.athlete) return;
    if (!window.confirm("Die aktuelle Woche wird durch deine Standardwoche ersetzt. Fortfahren?")) {
      return;
    }
    if (!(await flushDirty())) return;

    setBusyAction(true);
    setError(null);
    try {
      await applyPerformanceDefaults(
        organizationId,
        selectedGroupId,
        context.athlete.id,
        weekStart,
      );
      setSuccess("Die Standardwoche wurde angewendet.");
      await loadWeek(true);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusyAction(false);
    }
  }

  async function handleSaveDefaults() {
    if (!organizationId || !selectedGroupId || !context?.athlete || !week) return;
    setDefaultSaving(true);
    setError(null);
    try {
      for (const weekday of week.group.regularWeekdays) {
        await savePerformanceDefault(
          organizationId,
          selectedGroupId,
          context.athlete.id,
          weekday,
          defaultDrafts[weekday] ?? emptyDraft(),
        );
      }
      setSuccess("Die Standardwoche wurde gespeichert.");
      await loadWeek(true);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setDefaultSaving(false);
    }
  }

  const selectedGroup = context?.groups.find((group) => group.id === selectedGroupId) ?? null;
  const selfAthlete = context?.athlete && week
    ? week.athletes.find((athlete) => athlete.id === context.athlete?.id) ?? null
    : null;
  const selfTrainer = context?.trainer && week
    ? week.trainers.find((trainer) => trainer.id === context.trainer?.id) ?? null
    : null;

  const currentWeekStart = startOfIsoWeek(new Date());
  const maxAthleteWeek = selectedGroup
    ? addWeeks(currentWeekStart, selectedGroup.weeksAhead)
    : currentWeekStart;
  const canMoveNext = context?.canManage || weekStart < maxAthleteWeek;

  if (!canView || !organizationId) return <Navigate to="/kein-zugriff" replace />;

  return (
    <section className="performance-registration-page">
      <div className="page-heading performance-heading">
        <div>
          <p className="eyebrow">Sprint-Leistungsgruppen</p>
          <h1>Leistungsgruppen</h1>
          <p>Trainingsanmeldung und Wochenübersicht für Athleten und Trainer.</p>
        </div>
        <div className={`performance-save-indicator ${saveState}`} aria-live="polite">
          {saveState === "pending" && <><CloudUpload aria-hidden="true" /> Wird gespeichert …</>}
          {saveState === "saving" && <><CloudUpload aria-hidden="true" /> Speichert …</>}
          {saveState === "saved" && <><CloudCheck aria-hidden="true" /> Gespeichert</>}
          {saveState === "error" && <>Speichern fehlgeschlagen</>}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {loading && !context ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" /> Leistungsgruppen werden geladen …</div>
      ) : !context ? null : context.role === "athlete" && !context.athlete ? (
        <div className="empty-state">
          <UserCheck aria-hidden="true" />
          <h2>Dein Konto ist noch keinem Athleten zugeordnet</h2>
          <p>Ein Administrator muss dein App-Benutzerkonto einmalig in den Athletenstammdaten verknüpfen.</p>
        </div>
      ) : context.groups.length === 0 ? (
        <div className="empty-state">
          <UsersRound aria-hidden="true" />
          <h2>Noch keine Leistungsgruppe verfügbar</h2>
          <p>
            Markiere unter „Athleten, Trainer &amp; Gruppen“ mindestens eine Trainingsgruppe als Leistungsgruppe und ordne Athleten beziehungsweise Trainer zu.
          </p>
        </div>
      ) : (
        <>
          <div className="performance-mode-tabs" role="tablist" aria-label="Leistungsgruppenansicht">
            {context.athlete && (
              <button type="button" role="tab" aria-selected={mode === "athlete"} className={mode === "athlete" ? "active" : ""} onClick={() => setMode("athlete")}>
                <CalendarCheck aria-hidden="true" /> Meine Woche
              </button>
            )}
            {context.canManage && (
              <button type="button" role="tab" aria-selected={mode === "overview"} className={mode === "overview" ? "active" : ""} onClick={() => setMode("overview")}>
                <UsersRound aria-hidden="true" /> Wochenübersicht
              </button>
            )}
            {context.trainer && (
              <button type="button" role="tab" aria-selected={mode === "trainer"} className={mode === "trainer" ? "active" : ""} onClick={() => setMode("trainer")}>
                <UserCheck aria-hidden="true" /> Eigene Anwesenheit
              </button>
            )}
          </div>

          <div className="performance-controls-card">
            <label className="performance-group-select">
              Leistungsgruppe
              <select value={selectedGroupId} onChange={(event) => void changeGroup(event.target.value)}>
                {context.groups.map((group) => (
                  <option value={group.id} key={group.id}>{group.name}</option>
                ))}
              </select>
            </label>

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
              <Clock3 aria-hidden="true" />
              Anmeldung bis {PERFORMANCE_WEEKDAY_LABELS[selectedGroup.deadlineWeekday]} {selectedGroup.deadlineTime} vor Beginn der Trainingswoche.
              {selectedGroup.allowLateRegistration
                ? " Späte Änderungen werden markiert."
                : " Danach sind Änderungen nur durch Trainer möglich."}
            </div>
          )}

          {loading || !week ? (
            <div className="management-loading"><div className="spinner" aria-hidden="true" /> Woche wird geladen …</div>
          ) : mode === "athlete" ? (
            selfAthlete ? (
              <SelfWeekPanel
                target="athlete"
                person={selfAthlete}
                week={week}
                drafts={drafts}
                disabled={busyAction}
                canManage={context.canManage}
                onChange={updateDraft}
                actions={(
                  <>
                    <button type="button" className="secondary-button compact-button" onClick={() => void handleCopyPreviousWeek()} disabled={busyAction}>
                      <Copy aria-hidden="true" /> Vorwoche
                    </button>
                    <button type="button" className="secondary-button compact-button" onClick={() => void handleApplyDefaults()} disabled={busyAction}>
                      <RotateCcw aria-hidden="true" /> Standardwoche
                    </button>
                  </>
                )}
              >
                <section className="performance-default-week">
                  <button type="button" className="performance-default-toggle" onClick={() => setShowDefaultWeek((current) => !current)} aria-expanded={showDefaultWeek}>
                    <span><strong>Standardwoche</strong><small>Wiederkehrende Verfügbarkeit je Trainingstag</small></span>
                    <ChevronRight className={showDefaultWeek ? "open" : ""} aria-hidden="true" />
                  </button>
                  {showDefaultWeek && (
                    <div className="performance-default-content">
                      {week.group.regularWeekdays.map((weekday) => (
                        <article className="performance-default-day" key={weekday}>
                          <h3>{PERFORMANCE_WEEKDAY_LABELS[weekday]}</h3>
                          <AvailabilityFields
                            draft={defaultDrafts[weekday] ?? emptyDraft()}
                            disabled={defaultSaving}
                            compact
                            onChange={(changes) => setDefaultDrafts((current) => ({
                              ...current,
                              [weekday]: { ...(current[weekday] ?? emptyDraft()), ...changes },
                            }))}
                          />
                        </article>
                      ))}
                      <button type="button" className="primary-button" onClick={() => void handleSaveDefaults()} disabled={defaultSaving}>
                        <Save aria-hidden="true" /> {defaultSaving ? "Speichert …" : "Standardwoche speichern"}
                      </button>
                    </div>
                  )}
                </section>
              </SelfWeekPanel>
            ) : (
              <div className="empty-state">
                <UserCheck aria-hidden="true" />
                <h2>Kein Athletenkonto verknüpft</h2>
                <p>Verknüpfe dieses App-Konto in den Athletenstammdaten mit einem Athleten.</p>
              </div>
            )
          ) : mode === "trainer" ? (
            selfTrainer ? (
              <SelfWeekPanel
                target="trainer"
                person={selfTrainer}
                week={week}
                drafts={drafts}
                disabled={busyAction}
                canManage={context.canManage}
                onChange={updateDraft}
              />
            ) : (
              <div className="empty-state">
                <UserCheck aria-hidden="true" />
                <h2>Kein zugeordneter Trainer</h2>
                <p>Verknüpfe dieses App-Konto mit einem Trainer und ordne ihn der gewählten Leistungsgruppe zu.</p>
              </div>
            )
          ) : (
            <TrainerOverview
              week={week}
              selectedDate={selectedDate}
              statusFilter={statusFilter}
              drafts={drafts}
              onSelectDate={setSelectedDate}
              onStatusFilter={setStatusFilter}
              onChange={updateDraft}
            />
          )}
        </>
      )}
    </section>
  );
}

function SelfWeekPanel({
  target,
  person,
  week,
  drafts,
  disabled,
  canManage,
  actions,
  children,
  onChange,
}: {
  target: PerformanceSaveTarget;
  person: PerformanceAthlete | PerformanceTrainer;
  week: PerformanceWeek;
  drafts: Record<string, PerformanceAvailabilityDraft>;
  disabled: boolean;
  canManage: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onChange: (
    target: PerformanceSaveTarget,
    personId: string,
    date: string,
    changes: Partial<PerformanceAvailabilityDraft>,
  ) => void;
}) {
  return (
    <div className="performance-self-week">
      <div className="performance-section-heading">
        <div>
          <p className="eyebrow">{target === "athlete" ? "Trainingsanmeldung" : "Traineranwesenheit"}</p>
          <h2>{personName(person)}</h2>
        </div>
        {actions && <div className="performance-inline-actions">{actions}</div>}
      </div>

      <div className="performance-day-grid">
        {week.dates.map((date) => {
          const draft = drafts[draftKey(target, person.id, date.date)] ?? emptyDraft();
          const sourceAvailability = person.availability.find((item) => item.date === date.date);
          const locked = target === "athlete" && isRegistrationLocked(
            date.deadlineAt,
            week.group.allowLateRegistration,
            canManage,
          );
          return (
            <article className={`performance-day-card ${statusClass(draft.status)}`} key={date.date}>
              <div className="performance-day-heading">
                <div>
                  <strong>{formatTrainingDate(date.date)}</strong>
                  <small>Anmeldung bis {formatDeadline(date.deadlineAt)}</small>
                </div>
                {locked
                  ? <span className="locked-badge">Anmeldung geschlossen</span>
                  : sourceAvailability?.isLate && <span className="late-badge">Nachgemeldet</span>}
              </div>
              <AvailabilityFields
                draft={draft}
                disabled={disabled || locked}
                onChange={(changes) => onChange(target, person.id, date.date, changes)}
              />
            </article>
          );
        })}
      </div>
      {children}
    </div>
  );
}

function TrainerOverview({
  week,
  selectedDate,
  statusFilter,
  drafts,
  onSelectDate,
  onStatusFilter,
  onChange,
}: {
  week: PerformanceWeek;
  selectedDate: string;
  statusFilter: StatusFilter;
  drafts: Record<string, PerformanceAvailabilityDraft>;
  onSelectDate: (date: string) => void;
  onStatusFilter: (status: StatusFilter) => void;
  onChange: (
    target: PerformanceSaveTarget,
    personId: string,
    date: string,
    changes: Partial<PerformanceAvailabilityDraft>,
  ) => void;
}) {
  const activeDate = selectedDate || week.dates[0]?.date || "";
  const counts = useMemo(() => {
    const values: Record<PerformanceAvailabilityStatus, number> = {
      open: 0,
      coming: 0,
      maybe: 0,
      unavailable: 0,
    };
    for (const athlete of week.athletes) {
      const draft = drafts[draftKey("athlete", athlete.id, activeDate)] ?? emptyDraft();
      values[draft.status] += 1;
    }
    return values;
  }, [activeDate, drafts, week.athletes]);

  const filteredAthletes = week.athletes.filter((athlete) => {
    const draft = drafts[draftKey("athlete", athlete.id, activeDate)] ?? emptyDraft();
    return statusFilter === "all" || draft.status === statusFilter;
  });

  return (
    <div className="performance-overview">
      <div className="performance-date-tabs" role="tablist" aria-label="Trainingstag">
        {week.dates.map((date) => {
          const coming = week.athletes.filter((athlete) => (
            (drafts[draftKey("athlete", athlete.id, date.date)] ?? emptyDraft()).status === "coming"
          )).length;
          return (
            <button type="button" role="tab" aria-selected={activeDate === date.date} className={activeDate === date.date ? "active" : ""} onClick={() => onSelectDate(date.date)} key={date.date}>
              <span>{formatTrainingDate(date.date)}</span>
              <strong>{coming} kommen</strong>
            </button>
          );
        })}
      </div>

      <div className="performance-summary-row">
        {STATUS_OPTIONS.map((option) => (
          <button type="button" className={`${statusClass(option.value)} ${statusFilter === option.value ? "active" : ""}`} onClick={() => onStatusFilter(statusFilter === option.value ? "all" : option.value)} key={option.value}>
            <span>{option.label}</span><strong>{counts[option.value]}</strong>
          </button>
        ))}
      </div>

      <div className="performance-mobile-roster">
        {filteredAthletes.length === 0 ? (
          <div className="inline-empty-state">Keine Athleten für diesen Filter.</div>
        ) : filteredAthletes.map((athlete) => {
          const draft = drafts[draftKey("athlete", athlete.id, activeDate)] ?? emptyDraft();
          const source = athlete.availability.find((item) => item.date === activeDate);
          return (
            <details className="performance-roster-card" key={athlete.id}>
              <summary>
                <span>
                  <strong>{personName(athlete)}</strong>
                  <small>{athlete.birthYear ? `Jahrgang ${athlete.birthYear}` : ""}</small>
                </span>
                <span className="performance-roster-meta">
                  {source?.isLate && <em>Spät</em>}
                  <span className={`status-pill ${statusClass(draft.status)}`}>{statusLabel(draft.status)}</span>
                  {formatTimeRange(draft) && <small>{formatTimeRange(draft)}</small>}
                </span>
              </summary>
              <AvailabilityFields
                draft={draft}
                disabled={false}
                compact
                onChange={(changes) => onChange("athlete", athlete.id, activeDate, changes)}
              />
            </details>
          );
        })}
      </div>

      <div className="performance-desktop-matrix">
        <table>
          <thead>
            <tr>
              <th>Athlet</th>
              {week.dates.map((date) => <th key={date.date}>{formatTrainingDate(date.date)}</th>)}
            </tr>
          </thead>
          <tbody>
            {week.athletes.map((athlete) => (
              <tr key={athlete.id}>
                <th>{personName(athlete)}</th>
                {week.dates.map((date) => {
                  const draft = drafts[draftKey("athlete", athlete.id, date.date)] ?? emptyDraft();
                  return (
                    <td key={date.date}>
                      <span className={`status-pill ${statusClass(draft.status)}`}>{statusLabel(draft.status)}</span>
                      {formatTimeRange(draft) && <small>{formatTimeRange(draft)}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="performance-trainer-overview">
        <div className="performance-section-heading compact">
          <div>
            <p className="eyebrow">Betreuung</p>
            <h2>Trainer</h2>
          </div>
        </div>
        {week.trainers.length === 0 ? (
          <div className="inline-empty-state">Dieser Leistungsgruppe ist noch kein Trainer zugeordnet.</div>
        ) : (
          <div className="performance-trainer-list">
            {week.trainers.map((trainer) => {
              const draft = drafts[draftKey("trainer", trainer.id, activeDate)] ?? emptyDraft();
              return (
                <details className="performance-roster-card trainer" key={trainer.id}>
                  <summary>
                    <strong>{personName(trainer)}</strong>
                    <span className={`status-pill ${statusClass(draft.status)}`}>{statusLabel(draft.status)}</span>
                  </summary>
                  <AvailabilityFields
                    draft={draft}
                    disabled={false}
                    compact
                    onChange={(changes) => onChange("trainer", trainer.id, activeDate, changes)}
                  />
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
