import { ArrowRight, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_MODULES } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthContext";

export function DashboardPage() {
  const { appContext, canViewModule } = useAuth();
  const modules = APP_MODULES.filter((module) => canViewModule(module.key));

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Modulübersicht</p>
          <h1>Willkommen{appContext?.profile?.displayName ? `, ${appContext.profile.displayName}` : ""}</h1>
          <p>Wähle einen Arbeitsbereich. Angezeigt werden nur freigeschaltete Module.</p>
        </div>
      </div>

      {modules.length > 0 ? (
        <div className="module-grid">
          {modules.map((module) => (
            <Link className="module-card" to={module.route} key={module.key}>
              <span className="module-icon">{module.icon}</span>
              <span className="module-copy">
                <strong>{module.title}</strong>
                <small>{module.description}</small>
              </span>
              <ArrowRight className="module-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <LockKeyhole aria-hidden="true" />
          <h2>Keine Module freigeschaltet</h2>
          <p>Ein Administrator muss deinem Konto mindestens ein Modul zuweisen.</p>
        </div>
      )}
    </section>
  );
}
