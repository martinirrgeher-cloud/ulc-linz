// src/lib/userSession.ts
export interface CurrentUser {
  username: string;
  role?: string;
  modules: string[];
}

const LS_USER = "app_current_user";

export function setCurrentUser(user: CurrentUser) {
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

export function getCurrentUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(LS_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCurrentUser() {
  localStorage.removeItem(LS_USER);
}

export function getGrantedModules(): string[] {
  const u = getCurrentUser();
  return Array.isArray(u?.modules) ? u!.modules : [];
}
