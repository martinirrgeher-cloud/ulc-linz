import { CalendarDays, CheckCircle2, Clock3, FileQuestion, PlayCircle, Users } from "lucide-react";
import { PERFORMANCE_WEEKDAY_LABELS } from "@/features/performance-registration/date";
import type {
  DocumentationAthlete,
  DocumentationGroup,
  DocumentationPlanSummary,
  TrainingSessionStatus,
} from "@/features/training-documentation/types";

const STATUS_LABELS: Record<TrainingSessionStatus, string> = {
  not_started: "Nicht begonnen",
  in_progress: "In Arbeit",
  completed: "Abgeschlossen",
  partial: "Teilweise",
  aborted: "Abgebrochen",
};

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapKey(athleteId: string, date: string): string {
  return `${athleteId}:${date}`;
}

function statusIcon(status: TrainingSessionStatus) {
  if (status === "completed") return <CheckCircle2 aria-hidden="true" />;
  if (status === "in_progress") return <PlayCircle aria-hidden="true" />;
  return <FileQuestion aria-hidden="true" />;
}

type Props = {
  weekStart: string;
  group: DocumentationGroup | null;
  athletes: DocumentationAthlete[];
  plans: DocumentationPlanSummary[];
  onOpen: (planId: string) => void;
};

export function TrainingDocumentationTeamOverview({ weekStart, group, athletes, plans, onOpen }: Props) {
  if (!group) {
    return (
      <div className="empty-state">
        <Users aria-hidden="true" />
        <h2>Keine Trainingsgruppe ausgewählt</h2>
        <p>Wähle eine Gruppe, um den Dokumentationsstatus der Woche zu sehen.</p>
      </div>
    );
  }

  const dates = group.regularWeekdays.map((weekday) => ({
    weekday,
    date: addDays(weekStart, weekday - 1),
  }));
  const plansByKey = new Map(plans.map((plan) => [mapKey(plan.athleteId, plan.trainingDate), plan]));

  if (dates.length === 0) {
    return (
      <div className="empty-state">
        <CalendarDays aria-hidden="true" />
        <h2>Keine Trainingstage hinterlegt</h2>
        <p>Bei dieser Gruppe sind keine regulären Wochentage definiert.</p>
      </div>
    );
  }

  return (
    <section className="training-doc-team-overview">
      <header>
        <div>
          <p className="eyebrow">Traineransicht</p>
          <h2>Dokumentationsstatus der Woche</h2>
        </div>
        <div className="training-doc-status-legend">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <span className={`session-${status}`} key={status}>{label}</span>
          ))}
        </div>
      </header>

      <div className="training-doc-team-matrix-scroll">
        <table className="training-doc-team-matrix">
          <thead>
            <tr>
              <th>Athlet</th>
              {dates.map((date) => (
                <th key={date.date}>
                  <span>{PERFORMANCE_WEEKDAY_LABELS[date.weekday]}</span>
                  <small>{date.date.slice(8, 10)}.{date.date.slice(5, 7)}.</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => (
              <tr key={athlete.id}>
                <th><span>{athlete.firstName}</span><strong>{athlete.lastName}</strong></th>
                {dates.map((date) => {
                  const plan = plansByKey.get(mapKey(athlete.id, date.date));
                  return (
                    <td key={date.date}>
                      {plan ? (
                        <button
                          type="button"
                          className={`training-doc-team-cell session-${plan.sessionStatus}`}
                          onClick={() => onOpen(plan.id)}
                          title={`${plan.athleteName}: ${STATUS_LABELS[plan.sessionStatus]}`}
                        >
                          {statusIcon(plan.sessionStatus)}
                          <span>
                            <strong>{STATUS_LABELS[plan.sessionStatus]}</strong>
                            <small>
                              <Clock3 aria-hidden="true" />
                              {plan.actualMinutes ?? plan.plannedMinutes} min · {plan.completedExerciseCount}/{plan.exerciseCount}
                            </small>
                          </span>
                        </button>
                      ) : (
                        <span className="training-doc-no-plan">kein Plan</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
