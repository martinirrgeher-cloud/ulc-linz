import { LogIn, RefreshCw, ServerCrash, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { useAuth } from "@/features/auth/AuthContext";

export function ConnectionErrorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    loading,
    contextLoading,
    contextStatus,
    contextError,
    sessionError,
    isAuthenticated,
    needsBootstrap,
    appContext,
    refreshContext,
    signOut,
  } = useAuth();
  const [busy, setBusy] = useState(false);

  const destination = useMemo(() => {
    if (
      typeof location.state === "object" &&
      location.state &&
      "from" in location.state &&
      typeof location.state.from === "string" &&
      location.state.from !== "/verbindungsfehler"
    ) {
      return location.state.from;
    }
    return "/";
  }, [location.state]);

  useEffect(() => {
    if (contextStatus === "ready" && appContext?.membership) {
      navigate(destination, { replace: true });
    }
  }, [appContext?.membership, contextStatus, destination, navigate]);

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated && !sessionError) {
    return <Navigate to="/login" replace state={{ from: destination }} />;
  }

  if (needsBootstrap) {
    return <Navigate to="/einrichtung" replace />;
  }

  if (contextStatus === "no_membership") {
    return <Navigate to="/kein-zugriff" replace />;
  }

  async function retryConnection() {
    if (busy || contextLoading) return;
    setBusy(true);
    try {
      if (!isAuthenticated) {
        window.location.reload();
        return;
      }
      await refreshContext();
    } finally {
      setBusy(false);
    }
  }

  async function returnToLogin() {
    if (busy) return;
    setBusy(true);
    try {
      if (isAuthenticated) await signOut();
    } catch {
      // Der lokale Zustand wird auch bei vorübergehend nicht erreichbarem
      // Supabase bereinigt.
    } finally {
      navigate("/login", { replace: true, state: { from: destination } });
    }
  }

  const offline = contextStatus === "offline" || !navigator.onLine;
  const message =
    contextError ??
    sessionError ??
    (offline
      ? "Die App kann derzeit keine Verbindung zum Server herstellen."
      : "Der Vereinskontext konnte vorübergehend nicht geladen werden.");

  return (
    <main className="status-page">
      <section className="status-card status-card-compact" aria-live="polite">
        {offline ? <WifiOff aria-hidden="true" /> : <ServerCrash aria-hidden="true" />}
        <h1>{offline ? "Keine Verbindung" : "Verbindung fehlgeschlagen"}</h1>
        <p>
          {message}{" "}
          {isAuthenticated
            ? "Deine Anmeldung und ein bereits geladener Vereinskontext bleiben erhalten."
            : "Die gespeicherte Sitzung wird erneut geprüft, sobald die Verbindung verfügbar ist."}
        </p>
        <button
          type="button"
          className="primary-button status-login-button"
          onClick={() => void retryConnection()}
          disabled={busy || contextLoading}
        >
          <RefreshCw aria-hidden="true" />
          {busy || contextLoading ? "Verbindung wird geprüft …" : "Erneut versuchen"}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => void returnToLogin()}
          disabled={busy}
        >
          <LogIn aria-hidden="true" />
          Zur Anmeldung
        </button>
      </section>
    </main>
  );
}
