import { LogOut, ShieldCheck } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { env } from "@/lib/env";

const roleNames = {
  admin: "Administrator",
  trainer: "Trainer",
  athlete: "Athlet",
  parent: "Elternteil",
} as const;

export function AppLayout() {
  const { appContext, signOut } = useAuth();

  const displayName =
    appContext?.profile?.displayName || appContext?.authUser.email || "Benutzer";
  const role = appContext?.membership?.role;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand" aria-label="Zur Startseite">
          <img src="/logo.png" alt="ULC Linz Oberbank" />
          <span>
            <strong>{env.appName}</strong>
            <small>Vereins-App</small>
          </span>
        </Link>

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
            onClick={() => void signOut()}
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
