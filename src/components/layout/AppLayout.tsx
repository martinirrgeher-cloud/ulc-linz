import { Home, LogOut, ShieldCheck } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  NavigationGuardProvider,
  useNavigationGuardController,
} from "@/components/layout/NavigationGuardContext";
import { useAuth } from "@/features/auth/AuthContext";
import { APP_MODULES } from "@/config/modules";
import { env } from "@/lib/env";

const roleNames = {
  admin: "Administrator",
  trainer: "Trainer",
  athlete: "Athlet",
  parent: "Elternteil",
} as const;

function AppLayoutContent() {
  const { appContext, signOut } = useAuth();
  const { runGuard } = useNavigationGuardController();
  const navigate = useNavigate();
  const location = useLocation();

  const displayName =
    appContext?.profile?.displayName || appContext?.authUser.email || "Benutzer";
  const role = appContext?.membership?.role;

  async function goHome() {
    if (!(await runGuard())) return;

    const currentModule = APP_MODULES
      .filter((module) =>
        location.pathname === module.route || location.pathname.startsWith(`${module.route}/`),
      )
      .sort((left, right) => right.route.length - left.route.length)[0];

    navigate("/", {
      replace: true,
      flushSync: true,
      state: { openGroupKey: currentModule?.groupKey ?? null },
    });

    // Sicherheitsnetz für mobile Browser nach einem asynchronen Autosave.
    window.setTimeout(() => {
      if (window.location.pathname !== "/") window.location.assign("/");
    }, 150);
  }

  async function handleSignOut() {
    if (await runGuard()) await signOut();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="brand brand-button"
          onClick={() => void goHome()}
          aria-label="Zur Modulübersicht"
          title="Zur Modulübersicht"
        >
          <img src="/logo.png" alt="ULC Linz Oberbank" />
          <span className="brand-copy">
            <strong>{env.appName}</strong>
            <small className="brand-user-line">
              <span>{displayName}</span>
              {role && (
                <>
                  <span aria-hidden="true">·</span>
                  <ShieldCheck size={13} aria-hidden="true" />
                  <span>{roleNames[role]}</span>
                </>
              )}
            </small>
          </span>
        </button>

        <div className="user-area">
          <button
            type="button"
            className="icon-button"
            onClick={() => void goHome()}
            aria-label="Zur Modulübersicht"
            title="Zur Modulübersicht"
          >
            <Home aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void handleSignOut()}
            aria-label="Abmelden"
            title="Abmelden"
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}

export function AppLayout() {
  return (
    <NavigationGuardProvider>
      <AppLayoutContent />
    </NavigationGuardProvider>
  );
}
