// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { isLoggedIn, hasModuleAccess, logout } from "../lib/authStore";
import { hasAccessToken } from "../lib/googleAuth";

export default function ProtectedRoute({ children, module }: { children: React.ReactNode; module?: string }) {
  if (!isLoggedIn() || !hasAccessToken()) {
    logout();
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (module && !hasModuleAccess(module)) {
    return <Navigate to={ROUTES.MENU} replace />;
  }

  return <>{children}</>;
}
