import { Home, LogOut, ShieldCheck } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  NavigationGuardProvider,
  useNavigationGuardController,
} from "@/components/layout/NavigationGuardContext";
import { useAuth } from "@/features/auth/AuthContext";
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

  const displayName =
    appContext?.profile?.displayName || appContext?.authUser.email || "Benutzer";
  const role = appContext?.membership?.role;

  async function goHome() {
    if (await runGuard()) navigate("/");
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
          <span>
            <strong>{env.appName}</strong>
            <small>Vereins-App</small>
          </span>
        </button>

        <div className="user-area">
          <div className="user-meta">
            <strong>{displayName}</strong>
            {role && (
              <small>
                <ShieldCheck size={14} aria-hidden="true" />
                {roleNames[role]}
              </small>
            )}
          </div>
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
