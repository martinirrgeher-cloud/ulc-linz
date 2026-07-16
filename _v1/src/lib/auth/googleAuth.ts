// src/lib/auth/googleAuth.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
type StoredGoogleToken = { access_token: string; expires_at: number; scope?: string };
const STORAGE_KIND = (import.meta.env.VITE_AUTH_STORAGE || "local").toLowerCase() === "session" ? "sessionStorage" : "localStorage";
const STORAGE: Storage = STORAGE_KIND === "sessionStorage" ? window.sessionStorage : window.localStorage;

const TOKEN_KEY = "google_token_v2";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = (import.meta.env.VITE_GOOGLE_SCOPES ||
  "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file").trim();
const DBG = (import.meta.env.VITE_DEBUG_AUTH ?? "0") === "1";

export function getStoredToken(): StoredGoogleToken | null {
  try {
    const raw = STORAGE.getItem(TOKEN_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as StoredGoogleToken;
    return obj?.access_token && obj?.expires_at ? obj : null;
  } catch { return null; }
}
export function clearStoredToken() { STORAGE.removeItem(TOKEN_KEY); }
export function isGoogleTokenValid(bufSec = 30): boolean {
  const t = getStoredToken(); if (!t) return false;
  return Date.now() + bufSec * 1000 < t.expires_at;
}

function initTokenClient(): any {
  const g = (window as any).google?.accounts?.oauth2;
  if (!g) throw new Error("Google Identity Services nicht geladen.");
  return g.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: () => {} });
}

function requestAccessToken(prompt: "none" | "consent"): Promise<StoredGoogleToken> {
  return new Promise((resolve, reject) => {
    try {
      const client = initTokenClient();
      (client as any).callback = (resp: any) => {
        if (DBG) console.log("[AUTH] token callback:", resp);
        if (resp?.error) return reject(new Error(resp.error));
        const expires_in = Number(resp?.expires_in ?? 3600);
        const t: StoredGoogleToken = {
          access_token: resp.access_token,
          expires_at: Date.now() + expires_in * 1000,
          scope: resp.scope,
        };
        STORAGE.setItem(TOKEN_KEY, JSON.stringify(t));
        resolve(t);
      };
      (client as any).requestAccessToken({ prompt }); // <— ohne callback-Param!
    } catch (e) { reject(e); }
  });
}

export async function getAccessTokenInteractive(): Promise<string> { return (await requestAccessToken("consent")).access_token; }
export async function getAccessTokenSilent(): Promise<string> { return (await requestAccessToken("none")).access_token; }
export async function getValidAccessToken(): Promise<string> {
  const t = getStoredToken();
  if (t && isGoogleTokenValid(30)) return t.access_token;
  try { return await getAccessTokenSilent(); } catch { return await getAccessTokenInteractive(); }
}
export async function revokeAndClear(): Promise<void> {
  try {
    const t = getStoredToken(); clearStoredToken();
    if (t?.access_token) {
      await fetch("https://oauth2.googleapis.com/revoke", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body:`token=${encodeURIComponent(t.access_token)}` });
    }
  } catch {}
}

// Aliase für Alt-Code
export const getGoogleAccessTokenInteractive = getAccessTokenInteractive;
export const getStoredGoogleToken = getStoredToken;
export const clearGoogleToken = clearStoredToken;
