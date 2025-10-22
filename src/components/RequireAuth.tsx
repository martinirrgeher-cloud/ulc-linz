// src/components/RequireAuth.tsx
import { Navigate, useLocation } from 'react-router-dom'
import { getAccessToken, loadFromStorage } from '../lib/googleAuth'

/**
 * Schützt private Routen.
 * Akzeptiert:
 *  - gültigen Google Access Token (Login 1)
 *  - oder gespeicherten Benutzer (Login 2)
 *
 * Wenn beides fehlt → automatische Umleitung auf Login 1
 */
export default function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation()
  const token = getAccessToken()
  const stored = loadFromStorage()
  const user = stored?.user

  // Wenn kein Google-Token und kein User hinterlegt ist → redirect
  if (!token && !user) {
    return <Navigate to="/login1" state={{ from: location }} replace />
  }

  return children
}
