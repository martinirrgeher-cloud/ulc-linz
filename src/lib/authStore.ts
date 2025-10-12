// src/lib/authStore.ts
import { clearAccessToken } from "./googleAuth";
import type { User } from "./users";

const STORAGE_KEY = "currentUser";

export function setCurrentUser(user: User) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return !!getCurrentUser();
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  clearAccessToken();
}

export function hasModuleAccess(moduleName: string) {
  const user = getCurrentUser();
  if (!user) return false;
  return user.modules?.some((m) => m.toLowerCase() === moduleName.toLowerCase()) ?? false;
}
