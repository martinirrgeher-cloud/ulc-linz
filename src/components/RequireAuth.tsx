import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, loadFromStorage, tokenExpired } from "../lib/googleAuth";

/**
 * Schützt private Routen:
 * - gültiger Google Access Token (Login 1)
 * - oder gespeicherter Benutzer (Login 2 → aktuell optional)
 *
 * Wenn beides fehlt → automatische Umleitung auf Login 1
 */
export default function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const stored = loadFromStorage();
  const token = getAccessToken();

  if (!token || (stored && tokenExpired(stored.expiry))) {
    return <Navigate to="/login1" state={{ from: location }} replace />;
  }

  return children;
}
