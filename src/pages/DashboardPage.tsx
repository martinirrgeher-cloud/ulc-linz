import { ChevronDown, ChevronRight, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { APP_MODULE_GROUPS, APP_MODULES, type AppModuleGroupKey } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthContext";
import "@/styles/dashboard.css";

type DashboardLocationState = {
  openGroupKey?: AppModuleGroupKey | null;
};

export function DashboardPage() {
  const { appContext, canViewModule } = useAuth();
  const location = useLocation();
  const requestedGroupKey = (location.state as DashboardLocationState | null)?.openGroupKey ?? null;
  const [openGroupKey, setOpenGroupKey] = useState<AppModuleGroupKey | null>(requestedGroupKey);
  const modules = APP_MODULES.filter((module) => canViewModule(module.key));
  const groups = APP_MODULE_GROUPS
    .map((group) => ({
      ...group,
      modules: modules
        .filter((module) => module.groupKey === group.key)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    }))
    .filter((group) => group.modules.length > 0)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Modulübersicht</p>
          <h1>
            Willkommen
            {appContext?.profile?.displayName ? `, ${appContext.profile.displayName}` : ""}
          </h1>
          <p>Die Bereiche lassen sich ein- und ausklappen. Angezeigt werden nur freigeschaltete Module.</p>
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="module-sections">
          {groups.map((group) => (
            <details className="module-section" open={openGroupKey === group.key} key={group.key}>
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  setOpenGroupKey((current) => current === group.key ? null : group.key);
                }}
              >
                <span className="module-section-copy">
                  <strong>{group.title}</strong>
                  <small>{group.description}</small>
                </span>
                <span className="module-section-meta">
                  <span>{group.modules.length}</span>
                  <ChevronDown aria-hidden="true" />
                </span>
              </summary>

              <div className="module-grid">
                {group.modules.map((module) => (
                  <Link className="module-card" to={module.route} key={module.key}>
                    <span className="module-icon">{module.icon}</span>
                    <span className="module-copy">
                      <strong>{module.title}</strong>
                    </span>
                    <ChevronRight className="module-arrow" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </details>
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
