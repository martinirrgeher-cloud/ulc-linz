import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileQuestion,
  PlayCircle,
  Users,
} from "lucide-react";
import { MobileDaySelector } from "@/components/ui/MobileDaySelector";
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

function todayKey(): string {
  const date = new Date();
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
  const dates = useMemo(() => group?.regularWeekdays.map((weekday) => ({
    weekday,
    date: addDays(weekStart, weekday - 1),
  })) ?? [], [group, weekStart]);
  const plansByKey = useMemo(
    () => new Map(plans.map((plan) => [mapKey(plan.athleteId, plan.trainingDate), plan])),
    [plans],
  );
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (dates.length === 0) {
      setSelectedDate("");
      return;
    }
    setSelectedDate((current) => {
      if (dates.some((date) => date.date === current)) return current;
      const today = todayKey();
      return dates.find((date) => date.date === today)?.date ?? dates[0]?.date ?? "";
    });
  }, [dates]);

  if (!group) {
    return (
      <div className="empty-state">
        <Users aria-hidden="true" />
        <h2>Keine Trainingsgruppe ausgewählt</h2>
        <p>Wähle eine Gruppe, um den Dokumentationsstatus der Woche zu sehen.</p>
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="empty-state">
        <CalendarDays aria-hidden="true" />
        <h2>Keine Trainingstage hinterlegt</h2>
        <p>Bei dieser Gruppe sind keine regulären Wochentage definiert.</p>
      </div>
    );
  }

  const mobileDate = selectedDate || dates[0]?.date || "";
  const mobilePlans = plans.filter((plan) => plan.trainingDate === mobileDate);
  const completedCount = mobilePlans.filter((plan) => plan.sessionStatus === "completed").length;

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

      <div className="training-doc-team-desktop">
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
      </div>

      <section className="training-doc-team-mobile" aria-label="Mobile Dokumentationsübersicht">
        <MobileDaySelector
          label="Trainingstag auswählen"
          value={mobileDate}
          onChange={setSelectedDate}
          options={dates.map((date) => ({
            id: date.date,
            label: PERFORMANCE_WEEKDAY_LABELS[date.weekday] ?? "Tag",
            dateLabel: `${date.date.slice(8, 10)}.${date.date.slice(5, 7)}.`,
            meta: `${plans.filter((plan) => plan.trainingDate === date.date).length}/${athletes.length} Pläne`,
          }))}
        />

        <div className="training-doc-team-mobile-summary">
          <span><strong>{mobilePlans.length}</strong> Pläne</span>
          <span><strong>{completedCount}</strong> abgeschlossen</span>
          <span><strong>{athletes.length - mobilePlans.length}</strong> ohne Plan</span>
        </div>

        <div className="training-doc-team-mobile-list">
          {athletes.map((athlete) => {
            const plan = plansByKey.get(mapKey(athlete.id, mobileDate));
            const athleteName = `${athlete.firstName} ${athlete.lastName}`.trim();
            return (
              <article className="training-doc-team-mobile-athlete" key={athlete.id}>
                <header>
                  <strong>{athleteName}</strong>
                  <span className={plan ? `session-${plan.sessionStatus}` : "session-no-plan"}>
                    {plan ? STATUS_LABELS[plan.sessionStatus] : "Kein Plan"}
                  </span>
                </header>
                {plan ? (
                  <button
                    type="button"
                    className={`training-doc-team-mobile-plan session-${plan.sessionStatus}`}
                    onClick={() => onOpen(plan.id)}
                    aria-label={`${athleteName}: ${STATUS_LABELS[plan.sessionStatus]}, Dokumentation öffnen`}
                  >
                    {statusIcon(plan.sessionStatus)}
                    <span>
                      <strong>{plan.actualMinutes ?? plan.plannedMinutes} min · {plan.completedExerciseCount}/{plan.exerciseCount} Übungen</strong>
                      <small>{plan.title}</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ) : (
                  <div className="training-doc-team-mobile-no-plan">Für diesen Tag ist kein Trainingsplan vorhanden.</div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
