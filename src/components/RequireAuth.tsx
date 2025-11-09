// src/components/RequireAuth.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";
import { isGoogleTokenValid } from "@/lib/googleAuth";

type Props = {
  children: React.ReactNode;
  requiredModules?: string[];
  requireAll?: boolean;
  fallbackPath?: string;
};

export default function RequireAuth({ children, requiredModules = [], requireAll = false, fallbackPath = "/login" }: Props) {
  const loc = useLocation();
  const { user, hasModules } = useAuth();

  // Step 1: Google-Login vorhanden?
  if (!isGoogleTokenValid()) {
    return <Navigate to={"/login"} state={{ from: loc }} replace />;
  }
  // Step 2: App-User vorhanden?
  if (!user) {
    return <Navigate to={"/login2"} state={{ from: loc }} replace />;
  }
  // Step 3: Modulrechte
  if (requiredModules.length > 0 && !hasModules(requiredModules, requireAll)) {
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