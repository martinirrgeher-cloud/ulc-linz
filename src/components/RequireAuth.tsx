import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { loading, googleToken, user } = useAuth();

  if (loading) return null; // oder Spinner

  // 1) Kein Google-Login? -> Login1
  if (!googleToken) return <Navigate to="/login" replace />;

  // 2) Google ok, aber kein interner User? -> Login2
  if (!user) return <Navigate to="/login2" replace />;

  // 3) Alles ok -> Seite zeigen
  return children;
}
