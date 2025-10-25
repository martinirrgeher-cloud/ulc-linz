
import { Navigate } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";
import { ReactElement } from "react";

type Props = {
  children: ReactElement;
  modules?: string[];
};

export default function RequireAuth({ children, modules }: Props) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login2" replace />;
  }

  if (modules && !modules.some((m) => user.modules?.includes(m))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
