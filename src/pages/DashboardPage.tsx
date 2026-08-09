import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, Dumbbell, Info, ListChecks, RefreshCw, ShieldCheck, UserRoundCog, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_MODULES } from "@/config/modules";
import { loadDashboardSnapshot } from "@/features/dashboard/api";
import type { DashboardAccess, DashboardSnapshot, DashboardTaskTone } from "@/features/dashboard/types";
import { useAuth } from "@/features/auth/AuthContext";
import "@/styles/dashboard.css";

const roleNames = { admin: "Administrator", trainer: "Trainer", athlete: "Athlet", parent: "Elternteil" } as const;
const EMPTY_SNAPSHOT: DashboardSnapshot = { tasks: [], today: [], warnings: [] };
const taskIcons: Record<DashboardTaskTone, typeof AlertCircle> = { attention: AlertCircle, planning: CalendarDays, documentation: ClipboardCheck, admin: UserRoundCog };

export function DashboardPage() {
  const navigate = useNavigate();
  const { appContext, canViewModule, isSimulationActive } = useAuth();
  const organizationId = appContext?.organization?.id ?? null;
  const role = appContext?.membership?.role;
  const visibleModuleCount = APP_MODULES.filter((module) => canViewModule(module.key)).length;
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const access = useMemo<DashboardAccess>(() => ({
    kindertraining: canViewModule("kindertraining"), u12: canViewModule("u12"), u14: canViewModule("u14"),
    performanceRegistration: canViewModule("performance_registration"), trainingOverview: canViewModule("training_overview"),
    trainingPlanning: canViewModule("training_planning"), trainingDocumentation: canViewModule("training_documentation"), userManagement: canViewModule("user_management"),
  }), [canViewModule]);
  const quickActions = useMemo(() => [
    canViewModule("training_planning") ? { label: "Planung", detail: "Athletenpläne öffnen", route: "/module/training_planning", icon: ListChecks } : null,
    canViewModule("exercise_catalog") ? { label: "Übung suchen", detail: "Katalog öffnen", route: "/module/exercise_catalog", icon: Dumbbell } : null,
    canViewModule("athletes") ? { label: "Stammdaten", detail: "Athleten & Gruppen", route: "/module/athletes", icon: UsersRound } : null,
    canViewModule("training_documentation") ? { label: "Dokumentation", detail: "Training erfassen", route: "/module/training_documentation", icon: ClipboardCheck } : null,
  ].filter((item) => item !== null), [canViewModule]);
  const today = useMemo(() => new Intl.DateTimeFormat("de-AT", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()), []);

  const loadSnapshot = useCallback(async (refresh = false) => {
    if (!organizationId || isSimulationActive) { setSnapshot(EMPTY_SNAPSHOT); return; }
    refresh ? setRefreshing(true) : setLoading(true);
    try { setSnapshot(await loadDashboardSnapshot(organizationId, access)); }
    finally { refresh ? setRefreshing(false) : setLoading(false); }
  }, [access, isSimulationActive, organizationId]);

  useEffect(() => { void loadSnapshot(false); }, [loadSnapshot]);

  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Willkommen{appContext?.profile?.displayName ? `, ${appContext.profile.displayName}` : ""}</h1>
          <p>{today} · Das Wichtigste für deinen nächsten Schritt.</p>
        </div>
        {!isSimulationActive && (
          <button type="button" className="icon-button dashboard-refresh-button" onClick={() => void loadSnapshot(true)} disabled={loading || refreshing} aria-label="Dashboard aktualisieren" title="Dashboard aktualisieren">
            <RefreshCw aria-hidden="true" className={refreshing ? "spin-icon" : undefined} />
          </button>
        )}
      </div>

      {isSimulationActive && <div className="dashboard-notice"><Info aria-hidden="true" /><p>Im Simulationsmodus werden keine Dashboard-Zahlen geladen, weil die serverseitige Datensicht weiterhin deinem Administratorkonto entspricht.</p></div>}

      {quickActions.length > 0 && (
        <nav className="dashboard-quick-actions" aria-label="Schnellzugriffe">
          {quickActions.map((item) => {
            const QuickIcon = item.icon;
            return (
              <button type="button" className="dashboard-quick-action" key={item.route} onClick={() => navigate(item.route)}>
                <span><QuickIcon aria-hidden="true" /></span>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </button>
            );
          })}
        </nav>
      )}

      {!isSimulationActive && <>
        <section className="dashboard-section" aria-labelledby="dashboard-today-title">
          <div className="dashboard-section-heading"><div><span className="dashboard-section-kicker">Heute</span><h2 id="dashboard-today-title">Trainings & Anmeldung</h2></div><CalendarDays aria-hidden="true" /></div>
          {loading ? <div className="dashboard-loading" aria-live="polite">Dashboard wird geladen …</div> : snapshot.today.length > 0 ? (
            <div className="dashboard-today-list">{snapshot.today.map((item) => (
              <button key={item.key} type="button" className={`dashboard-today-row status-${item.status}`} onClick={() => navigate(item.route)}>
                <span className="dashboard-status-dot" aria-hidden="true" /><span className="dashboard-row-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight aria-hidden="true" />
              </button>
            ))}</div>
          ) : <div className="dashboard-empty"><CheckCircle2 aria-hidden="true" /><div><strong>Für heute ist nichts offen.</strong><span>Keine sichtbaren Trainings oder Anmeldungen mit Handlungsbedarf.</span></div></div>}
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-task-title">
          <div className="dashboard-section-heading"><div><span className="dashboard-section-kicker">Offene Aufgaben</span><h2 id="dashboard-task-title">Was noch zu tun ist</h2></div><span className="dashboard-task-total">{snapshot.tasks.reduce((sum, item) => sum + item.count, 0)}</span></div>
          {!loading && snapshot.tasks.length > 0 ? <div className="dashboard-task-list">{snapshot.tasks.map((item) => {
            const TaskIcon = taskIcons[item.tone];
            return <button key={item.key} type="button" className={`dashboard-task-row tone-${item.tone}`} onClick={() => navigate(item.route)}>
              <span className="dashboard-task-icon"><TaskIcon aria-hidden="true" /></span><span className="dashboard-row-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className="dashboard-task-count">{item.count}</span><ChevronRight aria-hidden="true" />
            </button>;
          })}</div> : !loading ? <div className="dashboard-empty success"><CheckCircle2 aria-hidden="true" /><div><strong>Alles erledigt.</strong><span>Für deine freigeschalteten Bereiche gibt es aktuell keine offenen Dashboard-Aufgaben.</span></div></div> : null}
        </section>

        {snapshot.warnings.length > 0 && <div className="dashboard-notice warning" role="status"><AlertCircle aria-hidden="true" /><p>Ein Teil der Dashboard-Daten konnte nicht geladen werden. Die übrigen Informationen sind weiterhin aktuell.</p></div>}
      </>}

      <section className="dashboard-access-card" aria-label="Zugriff und Navigation">
        <ShieldCheck aria-hidden="true" /><div><span>Dein Zugriff</span><strong>{role ? roleNames[role] : "Benutzer"}</strong><small>{visibleModuleCount} freigeschaltete {visibleModuleCount === 1 ? "Funktion" : "Funktionen"}</small></div><p>Weitere Bereiche findest du jederzeit über <strong>Mehr</strong> in der unteren Navigation.</p>
      </section>
    </section>
  );
}
