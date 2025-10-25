
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { ReactElement } from "react";

type Props = {
  children: ReactElement;
  modules?: string[];
};

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { token, user } = useAuth();

  if (!token) return <Navigate to="/login1" replace />;

  // 2) Google ok, aber kein interner User? -> Login2
  if (!user) return <Navigate to="/login2" replace />;

  // 3) Alles ok -> Seite zeigen
  return children;
}
