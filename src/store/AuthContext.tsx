// src/store/AuthContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { downloadJson } from "@/lib/drive/DriveClientCore";
import { isGoogleTokenValid, revokeAndClear } from "@/lib/googleAuth";
import { IDS } from "@/config/driveIds";
import { registerTokenProvider } from "@/lib/drive/token"; // ✅ NEU

type AppUser = { username: string; displayName?: string; modules: string[] };
type UsersJsonV2 = {
  version: number;
  users: Array<{ username: string; displayName?: string; modules: string[]; password?: string; active?: boolean; updatedAt?: string; }>;
};

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  loginUser: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasModules: (required: string[] | string, requireAll?: boolean) => boolean;
};

const MODULE_ALIASES: Record<string, string> = {
  "anmeldung": "LEISTUNGSGRUPPE-ANMELDUNG",
  "anmeldung (lg)": "LEISTUNGSGRUPPE-ANMELDUNG",
  "lg-anmeldung": "LEISTUNGSGRUPPE-ANMELDUNG",
  "leistungsgruppe": "LEISTUNGSGRUPPE-ANMELDUNG",
  "leistungsgruppe-anmeldung": "LEISTUNGSGRUPPE-ANMELDUNG",
};

function normalizeModuleKeys(list: any): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .map((k) => MODULE_ALIASES[k.toLowerCase()] || k);
}

const AuthCtx = createContext<AuthState | null>(null);

function normalizeUsersJson(raw: any): UsersJsonV2 {
  if (!raw) return { version: 1, users: [] };
  if (Array.isArray(raw?.users)) return raw as UsersJsonV2;
  if (Array.isArray(raw)) return { version: 1, users: raw as any };
  return { version: Number(raw?.version ?? 1), users: Array.isArray(raw?.users) ? raw.users : [] };
}

/** ✅ Robust: liest den Google-Access-Token aus Storage (JSON oder plain). */
function resolveGoogleAccessToken(): string | null {
  const keys = [
    "google_token",
    "googleAccessToken",
    "gis_token",
    "auth.google",
    "auth",
    "GOOGLE_TOKEN",
    "GIS_TOKEN",
  ];
  const stores = [localStorage, sessionStorage];
  for (const store of stores) {
    for (const k of keys) {
      try {
        const raw = store.getItem(k);
        if (!raw) continue;
        // plain token?
        if (/^[A-Za-z0-9-_.]+$/.test(raw) && raw.length > 20) return raw;
        // JSON mit access_token?
        try {
          const obj = JSON.parse(raw);
          if (obj && typeof obj.access_token === "string") return obj.access_token;
          if (obj?.google && typeof obj.google.access_token === "string") return obj.google.access_token;
          if (obj?.token && typeof obj.token === "string") return obj.token;
        } catch {/* ignore */}
      } catch {/* ignore */}
    }
  }
  // optionaler gapi-Fallback
  try {
    const gapi: any = (globalThis as any).gapi;
    const auth = gapi?.auth2?.getAuthInstance?.();
    const at = auth?.currentUser?.get()?.getAuthResponse(true)?.access_token;
    if (typeof at === "string" && at.length > 10) return at;
  } catch {/* ignore */}
  return null;
}

/** ✅ Registriert den Provider für alle Module (Media-Preview etc.) */
function ensureTokenProviderRegistered() {
  registerTokenProvider(async () => resolveGoogleAccessToken());
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Schon eingeloggten User aus storage laden
    try {
      const cached = localStorage.getItem("app_user");
      if (cached) setUser(JSON.parse(cached));
    } catch {}
    // ✅ Beim Start den Token-Provider setzen (falls Token bereits vorhanden)
    ensureTokenProviderRegistered();
  }, []);

  const loginUser = useCallback(async (username: string, password: string, remember: boolean) => {
    if (!isGoogleTokenValid()) throw new Error("Kein Google-Token. Bitte zuerst Schritt 1 abschließen.");
    setLoading(true);
    try {
      const fileId = IDS.USERS_FILE_ID as string;
      if (!fileId) throw new Error("VITE_DRIVE_USERS_FILE_ID ist nicht gesetzt.");
      const raw = await downloadJson<any>(fileId);
      const users = normalizeUsersJson(raw).users;
      const rec = users.find(u => (u.username || "").toLowerCase() == username.toLowerCase());
      if (!rec) throw new Error("Benutzer nicht gefunden.");
      if (rec.active === false) throw new Error("Benutzer ist deaktiviert.");
      if (rec.password && rec.password !== password) throw new Error("Passwort falsch.");
      const appUser: AppUser = { username: rec.username, displayName: rec.displayName, modules: normalizeModuleKeys(rec.modules || []) };
      setUser(appUser);
      if (remember) localStorage.setItem("app_user", JSON.stringify(appUser));
      else localStorage.removeItem("app_user");

      // ✅ Nach erfolgreichem Login den Token-Provider (neu) registrieren
      ensureTokenProviderRegistered();
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem("app_user");
    await revokeAndClear(); // Google-Token ungültig machen
    // Optional: Provider „leeren“ (nicht zwingend nötig)
    registerTokenProvider(() => null);
  }, []);

  const hasModules = useCallback((required: string[] | string, requireAll = false) => {
    const need = Array.isArray(required) ? required : [required];
    if (!user) return false;
    if (need.length === 0) return true;
    const set = new Set(user.modules || []);
    return requireAll ? need.every(m => set.has(m)) : need.some(m => set.has(m));
  }, [user]);

  const value = useMemo<AuthState>(() => ({ user, loading, loginUser, logout, hasModules }), [user, loading, loginUser, logout, hasModules]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
