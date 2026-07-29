import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { useAuth } from "@/features/auth/AuthContext";

export type ProtectedRouteProps = PropsWithChildren<{
  moduleKey?: string;
  allowWithoutMembership?: boolean;
}>;

export function ProtectedRoute({
  children,
  moduleKey,
  allowWithoutMembership = false,
}: ProtectedRouteProps) {
  const location = useLocation();
  const {
    loading,
    contextLoading,
    contextStatus,
    sessionError,
    isAuthenticated,
    needsBootstrap,
    appContext,
    canViewModule,
  } = useAuth();

  const waitingForInitialContext =
    isAuthenticated &&
    !appContext?.membership &&
    (contextStatus === "idle" || contextStatus === "loading");

  // Bereits geladene Module bleiben bei einer Hintergrund-Aktualisierung
  // eingehängt. Android und iOS lösen nach der Galerie-Auswahl oft
  // focus/visibilitychange aus.
  if (loading || waitingForInitialContext || (contextLoading && !appContext?.membership)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    if (sessionError) {
      return (
        <Navigate
          to="/verbindungsfehler"
          replace
          state={{ from: location.pathname }}
        />
      );
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (
    !appContext?.membership &&
    (contextStatus === "offline" || contextStatus === "technical_error")
  ) {
    return (
      <Navigate
        to="/verbindungsfehler"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (needsBootstrap && location.pathname !== "/einrichtung") {
    return <Navigate to="/einrichtung" replace />;
  }

  if (!allowWithoutMembership && !appContext?.membership) {
    return <Navigate to="/kein-zugriff" replace />;
  }

  if (moduleKey && !canViewModule(moduleKey)) {
    return <Navigate to="/kein-zugriff" replace />;
  }

  return children;
}
