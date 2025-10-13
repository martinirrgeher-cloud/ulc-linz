// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { getAccessToken } from "../lib/googleAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const loggedIn = !!getAccessToken();
  if (!loggedIn) {
    console.log("🚪 Kein/abgelaufener Token – redirect → Login");
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
