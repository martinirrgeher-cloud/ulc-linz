// src/lib/googleAuth.ts
// → stabile Version mit Google OAuth Popup Login (ohne One-Tap Prompt)

declare global {
  interface Window {
    google?: any;
  }
}

let gisInitialized = false;
let tokenClient: any = null;

// =========================================================
// Hilfsfunktionen
// =========================================================
function log(...args: any[]) {
  console.log("[GIS]", ...args);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = atob(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getJwtExp(token: string): number | null {
  const data = decodeJwt(token);
  return data && typeof data.exp === "number" ? data.exp : null;
}

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

async function ensureGisScriptLoaded(): Promise<void> {
  const src = "https://accounts.google.com/gsi/client";
  let tag = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (tag) return;

  log("GIS-Script nicht im DOM → lade nach…");
  tag = document.createElement("script");
  tag.src = src;
  tag.async = true;
  tag.defer = true;

  await new Promise<void>((resolve, reject) => {
    tag!.onload = () => resolve();
    tag!.onerror = () => reject(new Error("GIS-Script konnte nicht geladen werden"));
    document.head.appendChild(tag!);
  });
}

// =========================================================
// Initialisierung
// =========================================================
export async function initGoogleAuth(): Promise<void> {
  if (gisInitialized) return;

  await ensureGisScriptLoaded();

  // Warten bis GIS geladen ist
  const timeoutMs = 5000;
  const pollMs = 100;
  let waited = 0;

  log("Client ID aus ENV:", import.meta.env.VITE_GOOGLE_CLIENT_ID);

  while (!(window.google && window.google.accounts && window.google.accounts.oauth2)) {
    await delay(pollMs);
    waited += pollMs;
    if (waited >= timeoutMs) {
      throw new Error("GIS nicht verfügbar (oauth2 API kam nicht).");
    }
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID fehlt oder ist leer (.env prüfen!)");
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "openid email profile",
    callback: (response: any) => {
      log("Popup Callback:", response);
      if (response && response.access_token) {
        localStorage.setItem("google_access_token", response.access_token);
      }
    },
  });

  gisInitialized = true;
  log("GIS Popup init erfolgreich.");
}

// =========================================================
// Login via Popup
// =========================================================
export async function loginGoogle(): Promise<void> {
  if (!gisInitialized) {
    await initGoogleAuth();
  }

  log("Google Login Button geklickt (Popup)");

  if (!tokenClient) {
    console.error("Token Client nicht initialisiert");
    return;
  }

  tokenClient.requestAccessToken();

  // aktiv warten, bis Token gespeichert ist
  const maxWait = 10000;
  const interval = 100;
  let waited = 0;

  while (waited < maxWait) {
    const tok = getAccessToken();
    if (tok) {
      log("Access Token angekommen.");
      return;
    }
    await delay(interval);
    waited += interval;
  }

  console.error("Kein Token erhalten");
}

// =========================================================
// Tokenprüfung / Logout
// =========================================================
export async function validateGoogleToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function logoutGoogle(): void {
  try {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch {
    // ignore
  } finally {
    clearStorage();
  }
}

// Alias für Kompatibilität
export const signOutGoogle = logoutGoogle;

// =========================================================
// Abwärtskompatible Exporte
// =========================================================
export function getAccessToken(): string | null {
  return loadFromStorage();
}

export function loadFromStorage(): string | null {
  return localStorage.getItem("google_access_token");
}

export function clearStorage(): void {
  localStorage.removeItem("google_access_token");
}

export function tokenExpired(): boolean {
  const token = loadFromStorage();
  if (!token) return true;
  const exp = getJwtExp(token);
  if (exp === null) return false; // Access Tokens haben oft kein exp → dann OK
  return exp <= nowEpoch();
}

export async function silentRefreshIfNeeded(): Promise<string | null> {
  const token = loadFromStorage();
  if (!token) return null;
  if (tokenExpired()) return null;
  return token;
}
