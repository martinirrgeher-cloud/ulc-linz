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
    isAuthenticated,
    needsBootstrap,
    appContext,
    isInitialized,
    accessError,
    canViewModule,
  } = useAuth();

  const waitingForInitialContext =
    isAuthenticated &&
    !appContext?.membership &&
    isInitialized === null &&
    !accessError;

  // Bereits geladene Module bleiben bei einer Hintergrund-Aktualisierung
  // eingehaengt. Android und iOS loesen nach der Galerie-Auswahl oft
  // focus/visibilitychange aus.
  if (loading || waitingForInitialContext || (contextLoading && !appContext?.membership)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
