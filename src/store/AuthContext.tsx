import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from "react";
import { fetchUsersAndLogin } from "@/lib/users";

export type AuthUser = { id: string; name: string; username?: string; email?: string; roles?: string[]; modules?: string[] };

export type AuthContextValue = {
  user: AuthUser | null;
  login: (user: AuthUser) => Promise<void>;
  /** Abwärtskompatibel: (username, password, remember?) */
  loginUser: (username: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  /** true, wenn irgendein Modul vorhanden ist */
  hasModules: () => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback(async (u: AuthUser) => {
    setUser({ ...u, username: u.username ?? u.name });
  }, []);

  const loginUser = useCallback(async (username: string, password: string, remember: boolean = true) => {
    const u = await fetchUsersAndLogin(username, password);
    if (!u) throw new Error("Ungültige Zugangsdaten");
    // Option „remember“ hier optional für spätere Persistenz nutzbar
    await login(u);
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const hasModules = useCallback(() => !!(user?.modules && user.modules.length > 0), [user]);

  const value = useMemo<AuthContextValue>(() => ({ user, login, loginUser, logout, hasModules }), [user, login, loginUser, logout, hasModules]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
