// src/lib/googleAuth.ts
const STORAGE_KEY = "google_access_token_v1";
type StoredToken = { access_token: string; expires_at?: number; token_type?: string; scope?: string; };
const now = () => Date.now();

export function getStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj as StoredToken;
  } catch { return null; }
}
export function setStoredToken(tok: StoredToken | null): void {
  if (!tok) return localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tok));
}
export function clearStoredToken(): void { localStorage.removeItem(STORAGE_KEY); }
export function revokeAndClear(): void { clearStoredToken(); }
export function tokenExpired(): boolean {
  const t = getStoredToken();
  if (!t?.expires_at) return false;
  return t.expires_at <= now();
}
export function getValidAccessToken(): string | null {
  const t = getStoredToken();
  if (!t) return null;
  if (tokenExpired()) return null;
  return t.access_token || null;
}
export function isGoogleTokenValid(): boolean {
  return !!getValidAccessToken();
}
export async function getAccessTokenSilent(): Promise<string | null> {
  const ext = (window as any).__googleAuth;
  if (ext?.getAccessTokenSilent) {
    const tok = await ext.getAccessTokenSilent();
    if (tok) return tok;
  }
  return getValidAccessToken();
}
export async function getAccessTokenInteractive(): Promise<string | null> {
  const ext = (window as any).__googleAuth;
  if (ext?.getAccessTokenInteractive) {
    const tok = await ext.getAccessTokenInteractive();
    if (tok) return tok;
  }
  return null;
}
export async function silentRefreshIfNeeded(): Promise<void> {
  const ext = (window as any).__googleAuth;
  if (ext?.silentRefreshIfNeeded) {
    await ext.silentRefreshIfNeeded();
  }
}
