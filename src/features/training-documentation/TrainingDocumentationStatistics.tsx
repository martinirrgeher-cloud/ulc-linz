import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  Dumbbell,
  Gauge,
  Printer,
  Star,
} from "lucide-react";
import type { TrainingDocumentationStatistics } from "@/features/training-documentation/types";

function numberLabel(value: number | null, digits = 1): string {
  if (value === null) return "–";
  return value.toLocaleString("de-AT", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("de-AT", { month: "long", year: "numeric" }).format(new Date(Number(year), Number(month) - 1, 1));
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

type Props = {
  statistics: TrainingDocumentationStatistics;
};

export function TrainingDocumentationStatisticsView({ statistics }: Props) {
  const maxDuration = Math.max(1, ...statistics.sessions.map((session) => Math.max(session.plannedMinutes, session.actualMinutes ?? 0)));

  return (
    <section className="training-doc-statistics">
      <header className="training-doc-statistics-heading">
        <div>
          <p className="eyebrow">Trainingsauswertung</p>
          <h2>{statistics.athleteName}</h2>
          <small>{dateLabel(statistics.dateFrom)} bis {dateLabel(statistics.dateTo)}</small>
        </div>
        <button type="button" className="secondary-button" onClick={() => window.print()}>
          <Printer aria-hidden="true" />Bericht drucken
        </button>
      </header>

      <div className="training-doc-stat-cards">
        <article><CalendarDays aria-hidden="true" /><div><strong>{statistics.summary.sessionCount}</strong><span>Trainingseinheiten</span></div></article>
        <article><Clock3 aria-hidden="true" /><div><strong>{statistics.summary.actualMinutes}</strong><span>Ist-Minuten</span><small>Soll {statistics.summary.plannedMinutes}</small></div></article>
        <article><Gauge aria-hidden="true" /><div><strong>{numberLabel(statistics.summary.averageRpe)}</strong><span>Ø RPE</span></div></article>
        <article><Star aria-hidden="true" /><div><strong>{numberLabel(statistics.summary.averageRating)}</strong><span>Ø Bewertung</span></div></article>
        <article><Dumbbell aria-hidden="true" /><div><strong>{statistics.summary.exerciseCount}</strong><span>Übungen dokumentiert</span></div></article>
        <article><Activity aria-hidden="true" /><div><strong>{numberLabel(statistics.summary.completionRate)} %</strong><span>Abschlussquote</span></div></article>
        <article className={statistics.summary.painSessionCount > 0 ? "warning" : ""}><AlertTriangle aria-hidden="true" /><div><strong>{statistics.summary.painSessionCount}</strong><span>Trainings mit Beschwerden</span></div></article>
      </div>

      <section className="training-doc-report-section">
        <header><ChartNoAxesCombined aria-hidden="true" /><div><h3>Belastung und Trainingsdauer</h3><small>Soll-Ist-Vergleich je Trainingstag</small></div></header>
        {statistics.sessions.length === 0 ? (
          <p className="training-doc-report-empty">Im ausgewählten Zeitraum gibt es noch keine dokumentierten Trainings.</p>
        ) : (
          <div className="training-doc-session-trends">
            {statistics.sessions.map((session) => (
              <article key={session.id}>
                <div className="training-doc-trend-label">
                  <strong>{dateLabel(session.trainingDate)}</strong>
                  <span>{session.title}</span>
                  <small>{session.completedExerciseCount}/{session.exerciseCount} Übungen · RPE {session.overallRpe ?? "–"}</small>
                </div>
                <div className="training-doc-duration-bars" aria-label={`Soll ${session.plannedMinutes} Minuten, Ist ${session.actualMinutes ?? 0} Minuten`}>
                  <span className="planned" style={{ width: `${(session.plannedMinutes / maxDuration) * 100}%` }}>Soll {session.plannedMinutes}</span>
                  <span className="actual" style={{ width: `${((session.actualMinutes ?? 0) / maxDuration) * 100}%` }}>Ist {session.actualMinutes ?? "–"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="training-doc-report-section">
        <header><Dumbbell aria-hidden="true" /><div><h3>Übungsentwicklung</h3><small>Häufigkeit, Bewertung und Belastung</small></div></header>
        <div className="training-doc-report-table-scroll">
          <table className="training-doc-report-table">
            <thead><tr><th>Übung</th><th>Einheiten</th><th>Wie geplant</th><th>Geändert</th><th>Ausgelassen</th><th>Ø Bewertung</th><th>Ø RPE</th><th>Beschwerden</th></tr></thead>
            <tbody>
              {statistics.exercises.map((exercise) => (
                <tr key={`${exercise.exerciseId ?? "snapshot"}:${exercise.exerciseName}`}>
                  <th>{exercise.exerciseName}</th>
                  <td data-label="Einheiten">{exercise.sessionCount}</td>
                  <td data-label="Wie geplant">{exercise.completedCount}</td>
                  <td data-label="Geändert">{exercise.changedCount}</td>
                  <td data-label="Ausgelassen">{exercise.skippedCount}</td>
                  <td data-label="Ø Bewertung">{numberLabel(exercise.averageRating)}</td>
                  <td data-label="Ø RPE">{numberLabel(exercise.averageRpe)}</td>
                  <td data-label="Beschwerden">{exercise.painCount}</td>
                </tr>
              ))}
              {statistics.exercises.length === 0 && <tr className="training-doc-report-empty-row"><td colSpan={8}>Noch keine Übungsdaten vorhanden.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="training-doc-report-section">
        <header><Activity aria-hidden="true" /><div><h3>Soll-Ist-Parameter</h3><small>Numerische Werte wie Distanz, Wiederholungen, Gewicht oder Dauer</small></div></header>
        <div className="training-doc-report-table-scroll">
          <table className="training-doc-report-table">
            <thead><tr><th>Übung</th><th>Parameter</th><th>Messungen</th><th>Ø Soll</th><th>Ø Ist</th><th>Erreichung</th></tr></thead>
            <tbody>
              {statistics.parameters.map((parameter) => (
                <tr key={`${parameter.exerciseId ?? "snapshot"}:${parameter.exerciseName}:${parameter.parameterKey}`}>
                  <th>{parameter.exerciseName}</th>
                  <td data-label="Parameter">{parameter.label}{parameter.unit ? ` (${parameter.unit})` : ""}</td>
                  <td data-label="Messungen">{parameter.sampleCount}</td>
                  <td data-label="Ø Soll">{numberLabel(parameter.plannedAverage)}</td>
                  <td data-label="Ø Ist">{numberLabel(parameter.actualAverage)}</td>
                  <td data-label="Erreichung">{parameter.achievementPercent === null ? "–" : `${numberLabel(parameter.achievementPercent)} %`}</td>
                </tr>
              ))}
              {statistics.parameters.length === 0 && <tr className="training-doc-report-empty-row"><td colSpan={6}>Noch keine vergleichbaren Zahlenwerte vorhanden.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="training-doc-report-columns">
        <section className="training-doc-report-section">
          <header><CalendarDays aria-hidden="true" /><div><h3>Monatsübersicht</h3><small>Umfang und Belastung</small></div></header>
          <div className="training-doc-month-list">
            {statistics.months.map((month) => (
              <article key={month.month}>
                <strong>{monthLabel(month.month)}</strong>
                <span>{month.sessionCount} Trainings</span>
                <span>{month.actualMinutes}/{month.plannedMinutes} min</span>
                <span>RPE {numberLabel(month.averageRpe)} · Bewertung {numberLabel(month.averageRating)}</span>
              </article>
            ))}
            {statistics.months.length === 0 && <p className="training-doc-report-empty">Keine Monatsdaten.</p>}
          </div>
        </section>

        <section className="training-doc-report-section">
          <header><AlertTriangle aria-hidden="true" /><div><h3>Abweichungen und Beschwerden</h3><small>Häufigste Auffälligkeiten</small></div></header>
          <div className="training-doc-reason-list">
            {statistics.reasons.map((reason) => (
              <article key={reason.key}><span>{reason.label}</span><strong>{reason.count}</strong></article>
            ))}
            {statistics.reasons.length === 0 && <p className="training-doc-report-empty">Keine Auffälligkeiten erfasst.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
