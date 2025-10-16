// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken } from "../lib/googleAuth";
import { getCurrentUser } from "../lib/userSession";
import type { CurrentUser } from "../lib/userSession";
import type { UserData } from "../lib/users";
import { ROUTES } from "../routes";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireModule?: string;
  requireRole?: string;
}

export default function ProtectedRoute({ children, requireModule, requireRole }: ProtectedRouteProps) {
  const location = useLocation();

  // 1) Token-Prüfung (Stufe 1)
  const token = getAccessToken();
  if (!token) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // 2) Optional: Benutzer-Prüfungen (Stufe 2)
  const user = getCurrentUser() as CurrentUser | null;
  if ((requireModule || requireRole) && !user) {
    // Stufe-2-Anmeldung erforderlich
    return <Navigate to={ROUTES.LOGIN_INTERNAL} state={{ from: location }} replace />;
  }

  if (requireRole && user && user.role !== requireRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requireModule && user && (!Array.isArray(user.modules) || !user.modules.includes(requireModule))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
