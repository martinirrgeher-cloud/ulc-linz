import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Baby,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Save,
  TrendingUp,
  TrendingDown,
  CornerUpLeft,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { loadGroupTrainingConfiguration } from "@/features/group-training/api";
import {
  loadGroupTrainingStatistics,
  saveGroupTrainingStatisticsDefault,
} from "@/features/group-training-statistics/api";
import type { GroupTrainingModuleDefinition } from "@/features/group-training/modules";
import type { TrainingStatistics } from "@/features/training-session/statistics-types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import {
  environmentLabel,
  formatDate,
  formatMonth,
  isoToday,
  isValidIsoDate,
} from "@/features/training-session/statistics-core";
import "@/styles/statistics.css";
import "@/styles/statistics-mobile.css";

type StatisticsTab = "sessions" | "athletes" | "development" | "trainers";

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Statistik konnte nicht geladen werden.", "group_training.statistics");
}

type GroupTrainingStatisticsPageProps = {
  definition: GroupTrainingModuleDefinition;
};

export function GroupTrainingStatisticsPage({ definition }: GroupTrainingStatisticsPageProps) {
  const { moduleKey, title, trainingRoute } = definition;
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule(moduleKey);
  const canEdit = canEditModule(moduleKey);

  const [statistics, setStatistics] = useState<TrainingStatistics | null>(null);
  const [groupTrainerIds, setGroupTrainerIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<string>(() => isoToday());
  const [toDate, setToDate] = useState<string>(() => isoToday());
  const [sessionLimit, setSessionLimit] = useState(10);
  const [tab, setTab] = useState<StatisticsTab>("sessions");
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async (requestedFromDate?: string | null) => {
    if (!organizationId || !canView) return;
    const today = isoToday();
    const safeToDate = isValidIsoDate(toDate) ? toDate : today;
    const requestedValue = requestedFromDate === undefined ? fromDate : requestedFromDate;
    const safeFromDate = requestedValue === null
      ? null
      : isValidIsoDate(requestedValue)
        ? requestedValue
        : today;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [data, configuration] = await Promise.all([
        loadGroupTrainingStatistics(
          organizationId,
          moduleKey,
          safeFromDate,
          safeToDate,
          sessionLimit,
        ),
        loadGroupTrainingConfiguration(organizationId, moduleKey),
      ]);
      setStatistics(data);
      setGroupTrainerIds(configuration.groupTrainerIds);
      setFromDate(isValidIsoDate(data.fromDate) ? data.fromDate : safeFromDate ?? today);
      setToDate(isValidIsoDate(data.toDate) ? data.toDate : today);
    } catch (loadError) {
      setFromDate((current) => isValidIsoDate(current) ? current : today);
      setToDate((current) => isValidIsoDate(current) ? current : today);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canView, fromDate, moduleKey, organizationId, sessionLimit, toDate]);

  useEffect(() => {
    void loadData(null);
    // Die Statistik wird bewusst nur beim ersten Öffnen automatisch geladen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, canView]);

  const maximumMonthlyAttendance = useMemo(
    () => Math.max(1, ...(statistics?.monthly.map((row) => row.averagePresent) ?? [1])),
    [statistics?.monthly],
  );
  const visibleTrainers = useMemo(() => {
    const assigned = new Set(groupTrainerIds);
    return (statistics?.trainers ?? []).filter(
      (trainer) => assigned.has(trainer.id) || trainer.sessionCount > 0,
    );
  }, [groupTrainerIds, statistics?.trainers]);

  if (!canView || !organizationId) return <Navigate to="/kein-zugriff" replace />;

  async function saveDefaultFromDate() {
    if (!fromDate || !organizationId || !canEdit) return;
    setSavingDefault(true);
    setError(null);
    try {
      await saveGroupTrainingStatisticsDefault(organizationId, moduleKey, fromDate);
      setStatistics((current) => current ? { ...current, defaultFromDate: fromDate } : current);
      setSuccess("Das Von-Datum wurde als globaler Standard gespeichert.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSavingDefault(false);
    }
  }

  return (
    <section className="kindertraining-statistics-page">
      <div className="statistics-heading">
        <div>
          <p className="eyebrow">Statistik</p>
          <h1>{title}</h1>
        </div>
        <Link
          className="icon-button link-button statistics-back-button"
          to={trainingRoute}
          aria-label="Zurück zum Training"
          title="Zurück zum Training"
        >
          <CornerUpLeft aria-hidden="true" />
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <details className="statistics-filter-card statistics-filter-details">
        <summary>
          <span>Zeitraum &amp; Filter</span>
          <small>{formatDate(fromDate)} – {formatDate(toDate)}</small>
        </summary>
        <div className="statistics-filter-content">
        <div className="statistics-filter-grid">
          <label className="ui-labeled-field">
            <span className="ui-field-label">Von</span>
            <input className="ui-field-control" type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(isValidIsoDate(event.target.value) ? event.target.value : isoToday())} />
          </label>
          <label className="ui-labeled-field">
            <span className="ui-field-label">Bis</span>
            <input className="ui-field-control" type="date" value={toDate} min={fromDate} max={isoToday()} onChange={(event) => setToDate(isValidIsoDate(event.target.value) ? event.target.value : isoToday())} />
          </label>
          <label className="ui-labeled-field">
            <span className="ui-field-label">Trainingsliste</span>
            <select className="ui-field-control" value={sessionLimit} onChange={(event) => setSessionLimit(Number(event.target.value))}>
              <option value={10}>Letzte 10 im Zeitraum</option>
              <option value={25}>Letzte 25 im Zeitraum</option>
              <option value={500}>Alle im Zeitraum</option>
            </select>
          </label>
        </div>
        <div className="statistics-filter-actions">
          <button type="button" className="primary-button" onClick={() => void loadData()} disabled={loading || !fromDate}>
            <RefreshCw className={loading ? "spin-icon" : ""} aria-hidden="true" /> Auswerten
          </button>
          {canEdit && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void saveDefaultFromDate()}
              disabled={savingDefault || !fromDate || statistics?.defaultFromDate === fromDate}
              title="Dieses Von-Datum wird künftig für alle Benutzer vorbelegt"
            >
              <Save aria-hidden="true" />
              {savingDefault ? "Speichert …" : "Von als Standard"}
            </button>
          )}
        </div>
        {statistics?.defaultFromDate && (
          <small>Globaler Standard: {formatDate(statistics.defaultFromDate)} · Bis wird beim Öffnen immer auf heute gesetzt.</small>
        )}
        </div>
      </details>

      {loading && !statistics ? (
        <div className="management-loading"><span className="spinner" aria-hidden="true" /> Statistik wird geladen …</div>
      ) : statistics ? (
        <>
          <div className="statistics-summary-grid">
            <div className="statistics-summary-row single">
              <div className="statistics-summary-card"><CalendarDays aria-hidden="true" /><strong>{statistics.summary.sessionCount}</strong><span>Trainings</span></div>
            </div>
            <div className="statistics-summary-row paired">
              <div className="statistics-summary-card"><UsersRound aria-hidden="true" /><strong>{statistics.summary.averagePresent}</strong><span>Ø Kinder</span></div>
              <div className="statistics-summary-card"><CheckCircle2 aria-hidden="true" /><strong>{statistics.summary.uniquePresent}</strong><span>versch. Kinder</span></div>
            </div>
            <div className="statistics-summary-row paired">
              <div className="statistics-summary-card"><TrendingDown aria-hidden="true" /><strong>{statistics.summary.minPresent}</strong><span>Minimum</span></div>
              <div className="statistics-summary-card"><TrendingUp aria-hidden="true" /><strong>{statistics.summary.maxPresent}</strong><span>Maximum</span></div>
            </div>
          </div>

          <div className="statistics-tabs ui-tabs" role="tablist" aria-label="Statistikbereich">
            {([
              ["sessions", "Trainings"],
              ["athletes", "Athleten"],
              ["development", "Trend"],
              ["trainers", "Trainer"],
            ] as const).map(([value, label]) => (
              <button type="button" role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>
            ))}
          </div>

          {tab === "sessions" && (
            <section className="statistics-panel">
              <div className="statistics-panel-heading">
                <div><h2>Trainings nach Datum</h2><p>{statistics.sessions.length === 10 && sessionLimit === 10 ? "Die letzten zehn Termine im Zeitraum." : `${statistics.sessions.length} Termine im Zeitraum.`}</p></div>
                {statistics.summary.cancelledCount > 0 && <span>{statistics.summary.cancelledCount} abgesagt</span>}
              </div>
              {statistics.sessions.length === 0 ? (
                <div className="inline-empty-state">Im gewählten Zeitraum wurden noch keine Trainings gespeichert.</div>
              ) : (
                <div className="statistics-session-list">
                  {statistics.sessions.map((session) => (
                    <details className={`statistics-session-card ${session.state}`} key={session.id}>
                      <summary>
                        <div>
                          <strong>{formatDate(session.sessionDate)}</strong>
                          <small>{[session.isSpecial ? "Sondertraining" : null, environmentLabel(session.environment), session.state === "cancelled" ? "Abgesagt" : null].filter(Boolean).join(" · ")}</small>
                        </div>
                        <div className="statistics-session-counts">
                          <span aria-label={`${session.presentCount} Kinder`} title="Kinder"><Baby aria-hidden="true" />{session.presentCount}</span>
                          <span aria-label={`${session.trainers.length} Trainer`} title="Trainer"><UserRoundCog aria-hidden="true" />{session.trainers.length}</span>
                        </div>
                      </summary>
                      <div className="statistics-session-details">
                        <div><strong>Anwesende Kinder</strong><p>{session.presentAthletes.length > 0 ? session.presentAthletes.map((item) => item.name).join(", ") : "Keine"}</p></div>
                        <div><strong>Trainer</strong><p>{session.trainers.length > 0 ? session.trainers.map((item) => item.name).join(", ") : "Nicht erfasst"}</p></div>
                        {session.note && <div><strong>Notiz</strong><p>{session.note}</p></div>}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "athletes" && (
            <section className="statistics-panel">
              <div className="statistics-panel-heading"><div><h2>Athletenstatistik</h2><p>Sortiert nach der Häufigkeit „Da“.</p></div></div>
              {statistics.athletes.length === 0 ? (
                <div className="inline-empty-state">Keine Athletendaten im gewählten Zeitraum.</div>
              ) : (
                <div className="athlete-statistics-list">
                  {statistics.athletes.map((athlete, index) => (
                    <article className={`athlete-statistics-row ${athlete.isActive ? "" : "inactive"}`} key={athlete.id}>
                      <span className="statistics-rank">{index + 1}</span>
                      <div className="athlete-statistics-name"><strong>{athlete.firstName} {athlete.lastName}</strong>{!athlete.isActive && <small>Inaktiv</small>}</div>
                      <div className="athlete-statistics-main"><strong>{athlete.presentCount}x</strong></div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "development" && (
            <section className="statistics-panel">
              <div className="statistics-panel-heading"><div><h2>Teilnehmerentwicklung</h2><p>Durchschnittlich anwesende Kinder pro Monat.</p></div></div>
              {statistics.monthly.length === 0 ? (
                <div className="inline-empty-state">Noch keine Monatsdaten vorhanden.</div>
              ) : (
                <div className="monthly-statistics-list">
                  {statistics.monthly.map((month) => (
                    <article key={month.month}>
                      <div><strong>{formatMonth(month.month)}</strong><small>{month.sessionCount} Trainings</small></div>
                      <div className="monthly-bar-track"><span style={{ width: `${Math.max(4, (month.averagePresent / maximumMonthlyAttendance) * 100)}%` }} /></div>
                      <strong>{month.averagePresent}</strong>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "trainers" && (
            <section className="statistics-panel">
              <div className="statistics-panel-heading"><div><h2>Trainereinsätze</h2><p>Anzahl der betreuten Trainings im Zeitraum.</p></div></div>
              {visibleTrainers.length === 0 ? (
                <div className="inline-empty-state">Keine Gruppentrainer oder Trainereinsätze im Zeitraum.</div>
              ) : (
                <div className="trainer-statistics-list">
                  {visibleTrainers.map((trainer, index) => (
                    <article key={trainer.id}><span>{index + 1}</span><div><strong>{trainer.firstName} {trainer.lastName}</strong><small>{trainer.isActive ? "Aktiv" : "Inaktiv"}</small></div><strong>{trainer.sessionCount}</strong></article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : null}
    </section>
  );
}
