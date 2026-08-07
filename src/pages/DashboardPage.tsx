import { CalendarDays, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { APP_MODULES } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthContext";
import "@/styles/dashboard.css";

const roleNames = {
  admin: "Administrator",
  trainer: "Trainer",
  athlete: "Athlet",
  parent: "Elternteil",
} as const;

export function DashboardPage() {
  const { appContext, canViewModule } = useAuth();
  const visibleModuleCount = APP_MODULES.filter((module) => canViewModule(module.key)).length;
  const role = appContext?.membership?.role;
  const today = new Intl.DateTimeFormat("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>
            Willkommen
            {appContext?.profile?.displayName ? `, ${appContext.profile.displayName}` : ""}
          </h1>
          <p>Offene Aufgaben und wichtige Informationen werden hier zentral gebündelt.</p>
        </div>
      </div>

      <div className="dashboard-overview-grid">
        <article className="dashboard-overview-card dashboard-overview-card-primary">
          <div className="dashboard-overview-icon"><CheckCircle2 aria-hidden="true" /></div>
          <div>
            <span className="dashboard-overview-kicker">Offene Aufgaben</span>
            <h2>Noch keine Aufgabenquellen verknüpft</h2>
            <p>Offene Punkte aus Anmeldung, Planung und Dokumentation können hier zentral zusammengeführt werden.</p>
          </div>
        </article>

        <article className="dashboard-overview-card">
          <div className="dashboard-overview-icon"><CalendarDays aria-hidden="true" /></div>
          <div>
            <span className="dashboard-overview-kicker">Heute</span>
            <h2>{today}</h2>
            <p>Dieser Bereich ist für heutige Trainings, Anmeldungen und kurzfristige Hinweise vorbereitet.</p>
          </div>
        </article>

        <article className="dashboard-overview-card">
          <div className="dashboard-overview-icon"><ShieldCheck aria-hidden="true" /></div>
          <div>
            <span className="dashboard-overview-kicker">Dein Zugriff</span>
            <h2>{role ? roleNames[role] : "Benutzer"}</h2>
            <p>{visibleModuleCount} freigeschaltete {visibleModuleCount === 1 ? "Funktion" : "Funktionen"} in der Navigation.</p>
          </div>
        </article>
      </div>

      <div className="dashboard-info-strip">
        <Info aria-hidden="true" />
        <p>Die wichtigsten Bereiche erreichst du jetzt dauerhaft über die Navigationsleiste am unteren Bildschirmrand.</p>
      </div>
    </section>
  );
}
