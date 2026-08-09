import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  ListChecks,
  RefreshCw,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import {
  addWeeks,
  formatTrainingDate,
  formatWeekRange,
  isCurrentWeek,
  isoWeekNumber,
  PERFORMANCE_WEEKDAY_LABELS,
  startOfIsoWeek,
} from "@/features/performance-registration/date";
import { loadTrainingWeekOverview } from "@/features/training-overview/api";
import type {
  TrainingOverviewDocumentationStatus,
  TrainingOverviewPlan,
  TrainingOverviewRegistration,
  TrainingOverviewStatus,
  TrainingWeekOverview,
} from "@/features/training-overview/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/training-overview.css";
import "@/styles/training-overview-mobile.css";
const EMPTY_OVERVIEW: TrainingWeekOverview = {
  weekStart: startOfIsoWeek(new Date()),
  weekEnd: startOfIsoWeek(new Date()),
  groups: [],
  group: null,
  dates: [],
  athletes: [],
  plans: [],
};

const STATUS_LABELS: Record<TrainingOverviewStatus, string> = {
  open: "Offen",
  coming: "Kommt",
  maybe: "Unsicher",
  unavailable: "Nein",
};

const STATUS_SHORT_LABELS: Record<TrainingOverviewStatus, string> = {
  open: "–",
  coming: "Ja",
  maybe: "?",
  unavailable: "Nein",
};

const DOCUMENTATION_LABELS: Record<TrainingOverviewDocumentationStatus, string> = {
  not_started: "Doku offen",
  in_progress: "Doku läuft",
  completed: "Doku fertig",
  partial: "Teilweise",
  aborted: "Abgebrochen",
};

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Ein unbekannter Fehler ist aufgetreten.", "training_overview");
}

function personName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function mapKey(athleteId: string, date: string): string {
  return `${athleteId}:${date}`;
}

type AthleteFilter = "all" | "coming" | "maybe";

const ATHLETE_FILTER_LABELS: Record<AthleteFilter, string> = {
  all: "Alle",
  coming: "Angemeldet",
  maybe: "Unsicher",
};

export function TrainingOverviewPage() {
  const navigate = useNavigate();
  const { appContext } = useAuth();
  const organizationId = appContext?.organization?.id ?? null;

  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [groupId, setGroupId] = useState("");
  const [selectedMobileDate, setSelectedMobileDate] = useState("");
  const [athleteFilter, setAthleteFilter] = useState<AthleteFilter>("all");
  const [overview, setOverview] = useState<TrainingWeekOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planByAthleteAndDate = useMemo(
    () => new Map(overview.plans.map((plan) => [mapKey(plan.athleteId, plan.trainingDate), plan])),
    [overview.plans],
  );

  const registrationByAthleteAndDate = useMemo(() => {
    const registrations = new Map<string, TrainingOverviewRegistration>();
    for (const athlete of overview.athletes) {
      for (const registration of athlete.registrations) {
        registrations.set(mapKey(athlete.id, registration.date), registration);
      }
    }
    return registrations;
  }, [overview.athletes]);

  const desktopAthletes = useMemo(() => {
    if (athleteFilter === "all") return overview.athletes;
    return overview.athletes.filter((athlete) => (
      athlete.registrations.some((registration) => registration.status === athleteFilter)
    ));
  }, [athleteFilter, overview.athletes]);

  const mobileAthletes = useMemo(() => {
    if (athleteFilter === "all" || !selectedMobileDate) return overview.athletes;
    return overview.athletes.filter((athlete) => (
      athlete.registrations.some((registration) => (
        registration.date === selectedMobileDate && registration.status === athleteFilter
      ))
    ));
  }, [athleteFilter, overview.athletes, selectedMobileDate]);

  useEffect(() => {
    if (overview.dates.length === 0) {
      setSelectedMobileDate("");
      return;
    }
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setSelectedMobileDate((current) => {
      if (overview.dates.some((date) => date.date === current)) return current;
      if (overview.dates.some((date) => date.date === todayKey)) return todayKey;
      return overview.dates[0]?.date ?? "";
    });
  }, [overview.dates]);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setLoading(true);
    setError(null);

    void loadTrainingWeekOverview(organizationId, weekStart, groupId || null)
      .then((next) => {
        if (!active) return;
        setOverview(next);
        if (!groupId && next.group) setGroupId(next.group.id);
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [groupId, organizationId, weekStart]);

  async function refresh() {
    if (!organizationId) return;
    setRefreshing(true);
    setError(null);
    try {
      const next = await loadTrainingWeekOverview(organizationId, weekStart, groupId || null);
      setOverview(next);
      if (!groupId && next.group) setGroupId(next.group.id);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setRefreshing(false);
    }
  }

  function changeWeek(amount: number) {
    setWeekStart((current) => addWeeks(current, amount));
  }

  function openPlanning(athleteId: string, trainingDate: string) {
    if (!overview.group) return;
    const parameters = new URLSearchParams({
      date: trainingDate,
      group: overview.group.id,
      athlete: athleteId,
    });
    navigate(`/module/training_planning?${parameters.toString()}`);
  }

  function openDocumentation(plan: TrainingOverviewPlan) {
    if (!overview.group) return;
    const parameters = new URLSearchParams({
      group: overview.group.id,
      athlete: plan.athleteId,
      plan: plan.id,
      date: plan.trainingDate,
      view: "document",
    });
    navigate(`/module/training_documentation?${parameters.toString()}`);
  }

  function planCellLabel(
    athleteName: string,
    trainingDate: string,
    registration: TrainingOverviewRegistration,
    plan: TrainingOverviewPlan | undefined,
  ): string {
    const planText = plan
      ? `Plan vorhanden, ${plan.totalMinutes} Minuten, ${plan.exerciseCount} Übungen, ${DOCUMENTATION_LABELS[plan.documentationStatus]}`
      : "noch kein Plan";
    return `${athleteName}, ${formatTrainingDate(trainingDate)}: Anmeldung ${STATUS_LABELS[registration.status]}, ${planText}. Planung öffnen.`;
  }

  return (
    <section className="training-overview-page">
      <header className="training-overview-heading">
        <div>
          <p className="eyebrow">Trainingsplanung</p>
          <h1>Trainingsplan-Übersicht</h1>
          <p>Anmeldestatus und vorhandene Athletenpläne für eine komplette Trainingswoche.</p>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="training-overview-controls" aria-label="Woche, Trainingsgruppe und Athletenfilter auswählen">
        <label className="ui-labeled-field">
          <span className="ui-field-label"><Users aria-hidden="true" />Trainingsgruppe</span>
          <select className="ui-field-control"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            disabled={loading || overview.groups.length === 0}
          >
            {overview.groups.length === 0 && <option value="">Keine Leistungsgruppe</option>}
            {overview.groups.map((group) => (
              <option value={group.id} key={group.id}>{group.shortName || group.name}</option>
            ))}
          </select>
        </label>

        <div className="training-overview-athlete-filter" role="group" aria-label="Athleten nach Anmeldung filtern">
          {(["all", "coming", "maybe"] as const).map((filter) => (
            <button
              type="button"
              className={athleteFilter === filter ? "active" : ""}
              aria-pressed={athleteFilter === filter}
              onClick={() => setAthleteFilter(filter)}
              key={filter}
            >
              {ATHLETE_FILTER_LABELS[filter]}
            </button>
          ))}
        </div>

        <div className="training-overview-navigation-actions">
          <div className="training-overview-week-navigation">
            <button type="button" className="icon-button" onClick={() => changeWeek(-1)} aria-label="Vorherige Woche">
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="training-overview-week-label"
              onClick={() => setWeekStart(startOfIsoWeek(new Date()))}
              title="Zur aktuellen Woche"
            >
              <strong>KW {isoWeekNumber(weekStart)}</strong>
              <span>{formatWeekRange(weekStart)}</span>
              {isCurrentWeek(weekStart) && <small>Aktuelle Woche</small>}
            </button>
            <button type="button" className="icon-button" onClick={() => changeWeek(1)} aria-label="Nächste Woche">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="icon-button training-overview-refresh-button"
            onClick={() => void refresh()}
            disabled={loading || refreshing}
            aria-label="Übersicht aktualisieren"
            title="Aktualisieren"
          >
            <RefreshCw className={refreshing ? "spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </section>

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Wochenübersicht wird geladen …</div>
      ) : overview.groups.length === 0 ? (
        <div className="empty-state">
          <Users aria-hidden="true" />
          <h2>Keine Leistungsgruppe vorhanden</h2>
          <p>Für die Übersicht wird eine aktive Gruppe mit Trainingsanmeldung benötigt.</p>
        </div>
      ) : overview.dates.length === 0 ? (
        <div className="empty-state">
          <CalendarDays aria-hidden="true" />
          <h2>Keine Trainingstage hinterlegt</h2>
          <p>Lege bei der ausgewählten Trainingsgruppe reguläre Wochentage fest.</p>
        </div>
      ) : overview.athletes.length === 0 ? (
        <div className="empty-state">
          <Users aria-hidden="true" />
          <h2>Keine relevanten Athleten</h2>
          <p>In dieser Woche ist kein aktiver Athlet der ausgewählten Gruppe zugeordnet.</p>
        </div>
      ) : (
        <>
          <div className="training-overview-legend" aria-label="Legende">
            <span className="status-coming">Ja</span>
            <span className="status-maybe">Unsicher</span>
            <span className="status-unavailable">Nein</span>
            <span className="status-open">Offen</span>
            <span className="has-plan"><Clock3 aria-hidden="true" />Plan vorhanden</span>
            <span className="documentation-completed"><ListChecks aria-hidden="true" />Doku abgeschlossen</span>
          </div>

          <div className="training-overview-desktop-matrix">
            <div className="training-overview-matrix-scroll">
              <table className="training-overview-matrix">
                <thead>
                  <tr>
                    <th>Athlet</th>
                    {overview.dates.map((date) => (
                      <th key={date.date}>
                        <span>{PERFORMANCE_WEEKDAY_LABELS[date.weekday]}</span>
                        <small>{date.date.slice(8, 10)}.{date.date.slice(5, 7)}.</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {desktopAthletes.length === 0 && (
                    <tr>
                      <td className="training-overview-filter-empty" colSpan={overview.dates.length + 1}>
                        Keine Athleten mit diesem Anmeldestatus in der ausgewählten Woche.
                      </td>
                    </tr>
                  )}
                  {desktopAthletes.map((athlete) => {
                    const athleteName = personName(athlete.firstName, athlete.lastName);
                    return (
                      <tr key={athlete.id}>
                        <th title={athleteName}>
                          <span>{athlete.firstName}</span>
                          <strong>{athlete.lastName}</strong>
                        </th>
                        {overview.dates.map((date) => {
                          const registration = registrationByAthleteAndDate.get(mapKey(athlete.id, date.date)) ?? {
                            date: date.date,
                            status: "open" as const,
                            comment: "",
                            isLate: false,
                          };
                          const plan = planByAthleteAndDate.get(mapKey(athlete.id, date.date));
                          return (
                            <td key={date.date}>
                              <div className="training-overview-cell-actions">
                                <button
                                  type="button"
                                  className={`training-overview-cell status-${registration.status}${plan ? " has-plan" : ""}`}
                                  onClick={() => openPlanning(athlete.id, date.date)}
                                  title={planCellLabel(athleteName, date.date, registration, plan)}
                                  aria-label={planCellLabel(athleteName, date.date, registration, plan)}
                                >
                                  <span className="training-overview-registration">
                                    {STATUS_SHORT_LABELS[registration.status]}
                                    {registration.isLate && <small>spät</small>}
                                  </span>
                                  <span className="training-overview-plan-state">
                                    {plan ? (
                                      <>
                                        <Clock3 aria-hidden="true" />
                                        <strong>{plan.actualMinutes ?? plan.totalMinutes} min</strong>
                                        <small>{plan.exerciseCount} Üb. · {DOCUMENTATION_LABELS[plan.documentationStatus]}</small>
                                      </>
                                    ) : (
                                      <small>kein Plan</small>
                                    )}
                                  </span>
                                </button>
                                {plan && (
                                  <button
                                    type="button"
                                    className={`training-overview-documentation-button documentation-${plan.documentationStatus}`}
                                    onClick={() => openDocumentation(plan)}
                                    title={`Trainingsdokumentation öffnen: ${DOCUMENTATION_LABELS[plan.documentationStatus]}`}
                                    aria-label={`${athleteName}, ${formatTrainingDate(date.date)}: Trainingsdokumentation öffnen`}
                                  >
                                    <ListChecks aria-hidden="true" />
                                    <span>Doku</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <section className="training-overview-mobile" aria-label="Mobile Wochenübersicht">
            <div className="training-overview-mobile-days" role="tablist" aria-label="Trainingstag auswählen">
              {overview.dates.map((date) => {
                const visibleAthleteIds = new Set(
                  athleteFilter === "all"
                    ? overview.athletes.map((athlete) => athlete.id)
                    : overview.athletes
                      .filter((athlete) => athlete.registrations.some((registration) => (
                        registration.date === date.date && registration.status === athleteFilter
                      )))
                      .map((athlete) => athlete.id),
                );
                const planCount = overview.plans.filter((plan) => (
                  plan.trainingDate === date.date && visibleAthleteIds.has(plan.athleteId)
                )).length;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedMobileDate === date.date}
                    className={selectedMobileDate === date.date ? "active" : ""}
                    onClick={() => setSelectedMobileDate(date.date)}
                    key={date.date}
                  >
                    <strong>{PERFORMANCE_WEEKDAY_LABELS[date.weekday]}</strong>
                    <small>{date.date.slice(8, 10)}.{date.date.slice(5, 7)}.</small>
                    <span>{planCount}/{visibleAthleteIds.size} geplant</span>
                  </button>
                );
              })}
            </div>

            <div className="training-overview-mobile-athletes">
              {mobileAthletes.length === 0 && (
                <p className="training-overview-filter-empty">
                  Keine Athleten mit diesem Anmeldestatus am ausgewählten Trainingstag.
                </p>
              )}
              {mobileAthletes.map((athlete) => {
                const trainingDate = selectedMobileDate || overview.dates[0]?.date || "";
                if (!trainingDate) return null;
                const athleteName = personName(athlete.firstName, athlete.lastName);
                const registration = registrationByAthleteAndDate.get(mapKey(athlete.id, trainingDate)) ?? {
                  date: trainingDate,
                  status: "open" as const,
                  comment: "",
                  isLate: false,
                };
                const plan = planByAthleteAndDate.get(mapKey(athlete.id, trainingDate));
                return (
                  <article className="training-overview-mobile-athlete" key={athlete.id}>
                    <header>
                      <strong>{athleteName}</strong>
                      <span className={`status-${registration.status}`}>
                        {STATUS_LABELS[registration.status]}{registration.isLate ? " · spät" : ""}
                      </span>
                    </header>
                    <div className={plan ? "" : "single"}>
                      <button
                        type="button"
                        className={`training-overview-mobile-plan${plan ? " has-plan" : ""}`}
                        onClick={() => openPlanning(athlete.id, trainingDate)}
                        aria-label={planCellLabel(athleteName, trainingDate, registration, plan)}
                      >
                        <Dumbbell aria-hidden="true" />
                        <span>
                          <strong>{plan ? `${plan.actualMinutes ?? plan.totalMinutes} min · ${plan.exerciseCount} Übungen` : "Plan anlegen"}</strong>
                          <small>{plan ? DOCUMENTATION_LABELS[plan.documentationStatus] : "Noch kein Trainingsplan"}</small>
                        </span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                      {plan && (
                        <button
                          type="button"
                          className={`training-overview-mobile-documentation documentation-${plan.documentationStatus}`}
                          onClick={() => openDocumentation(plan)}
                          aria-label={`${athleteName}, ${formatTrainingDate(trainingDate)}: Trainingsdokumentation öffnen`}
                        >
                          <ListChecks aria-hidden="true" />
                          <span>Doku</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <p className="training-overview-hint">Die Tagesfläche öffnet die Planung. „Doku“ öffnet bei vorhandenen Plänen direkt die Trainingsdokumentation.</p>
        </>
      )}
    </section>
  );
}
