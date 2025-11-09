// src/components/RequireAuth.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";

type Props = {
  children: React.ReactNode;
  requiredModules?: string[];
  requireAll?: boolean;
  fallbackPath?: string;
};

function userHasModules(user: { modules?: string[] } | null, required: string[], requireAll: boolean): boolean {
  if (!required.length) return true;
  const have = new Set(user?.modules ?? []);
  if (!have.size) return false;
  return requireAll ? required.every(k => have.has(k)) : required.some(k => have.has(k));
}

export default function RequireAuth({ children, requiredModules = [], requireAll = false, fallbackPath = "/login2" }: Props) {
  const loc = useLocation();
  const { user, hasModules } = useAuth();

  if (!user) {
    return <Navigate to={fallbackPath} state={{ from: loc }} replace />;
  }
  // Unterstütze both: hasModules(): boolean ODER eigene Prüfung
  const ok = typeof hasModules === "function"
    ? (hasModules.length ? hasModules() : userHasModules(user, requiredModules, requireAll))
    : userHasModules(user, requiredModules, requireAll);
  if (requiredModules.length > 0 && !ok) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Kein Zugriff</h2>
        <p className="mb-4">Für diese Seite fehlen dir Berechtigungen.</p>
        <a className="underline" href="/">Zur Startseite</a>
      </div>
    );
  }
  return <>{children}</>;
}
