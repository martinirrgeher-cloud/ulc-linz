import { BookOpenText, CircleHelp, Home, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  NavigationGuardProvider,
  useNavigationGuardController,
} from "@/components/layout/NavigationGuardContext";
import { useAuth } from "@/features/auth/AuthContext";
import { APP_MODULES } from "@/config/modules";
import { env } from "@/lib/env";
import { buildHelpHref } from "@/features/help/help-context";
import "@/styles/app-layout.css";

import { copySupportInformation, reportTechnicalError } from "@/lib/diagnostics";
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const displayName =
    appContext?.profile?.displayName || appContext?.authUser.email || "Benutzer";
  const role = appContext?.membership?.role;

  useEffect(() => {
    if (!userMenuOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [userMenuOpen]);

  async function goHome() {
    if (!(await runGuard())) return;

    setUserMenuOpen(false);
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

  async function openHelp(central = false) {
    if (!(await runGuard())) return;

    setUserMenuOpen(false);
    const returnPath = `${location.pathname}${location.search}`;
    navigate(central ? `/hilfe?from=${encodeURIComponent(returnPath)}` : buildHelpHref(returnPath));
  }

  async function handleCopyDiagnostics() {
    try {
      await copySupportInformation();
      setDiagnosticsCopied(true);
      window.setTimeout(() => setDiagnosticsCopied(false), 2500);
    } catch (error) {
      reportTechnicalError(error, "app_menu.copy_diagnostics");
    }
  }

  async function handleSignOut() {
    setUserMenuOpen(false);
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


          <div className="app-user-menu" ref={userMenuRef}>
            <button
              type="button"
              className={`icon-button app-user-menu-toggle ${userMenuOpen ? "active" : ""}`}
              onClick={() => setUserMenuOpen((current) => !current)}
              aria-label={userMenuOpen ? "Benutzermenü schließen" : "Benutzermenü öffnen"}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              title="Benutzermenü"
            >
              <UserRound aria-hidden="true" />
            </button>

            {userMenuOpen && (
              <div className="app-user-menu-panel" role="menu" aria-label="Benutzermenü">
                <div className="app-user-menu-identity">
                  <strong>{displayName}</strong>
                  {role && <small>{roleNames[role]}</small>}
                  <small>App-Stand: {env.appBuildLabel}</small>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void handleCopyDiagnostics()}
                    role="menuitem"
                  >
                    {diagnosticsCopied ? "Diagnoseinformationen kopiert" : "Diagnoseinformationen kopieren"}
                  </button>
                </div>
                <button
                  type="button"
                  className="app-user-menu-help"
                  onClick={() => void openHelp(true)}
                  role="menuitem"
                >
                  <BookOpenText aria-hidden="true" />
                  Hilfe & Handbuch
                </button>
                <button
                  type="button"
                  className="app-user-menu-signout"
                  onClick={() => void handleSignOut()}
                  role="menuitem"
                >
                  <LogOut aria-hidden="true" />
                  Abmelden
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-content">
        <div className="page-context-help-slot">
          <button
            type="button"
            className="icon-button page-context-help-button"
            onClick={() => void openHelp()}
            aria-label="Hilfe für diese Seite"
            title="Hilfe für diese Seite"
          >
            <CircleHelp aria-hidden="true" />
          </button>
        </div>
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
