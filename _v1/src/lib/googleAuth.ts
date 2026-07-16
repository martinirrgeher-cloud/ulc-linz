// src/lib/googleAuth.ts
/* Google Identity & Token Handling (FULL DRIVE SCOPE) */
type GoogleToken = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at: number; // epoch ms
};

const STORAGE_KEY = "google_token_v2";
// ✅ NEW: check if token has any Google Drive scope
function hasDriveScope(t: { scope?: string | string[] } | null): boolean {
  const s = Array.isArray(t?.scope) ? t!.scope.join(" ") : String(t?.scope || "");
  return /\bhttps:\/\/www\.googleapis\.com\/auth\/drive(\.[a-z]+)?\b/.test(s);
}

// IMPORTANT: request FULL DRIVE scope to write any existing file
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  // If you also use picker: "https://www.googleapis.com/auth/drive.file" could be added,
  // but DRIVE includes it already.
].join(" ");

declare global {
  interface Window {
    google?: any;
  }
}

export function getStoredToken(): GoogleToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as GoogleToken;
    if (!t?.access_token) return null;
    return t;
  } catch {
    return null;
  }
}

function saveToken(t: Omit<GoogleToken, "expires_at"> & { expires_in: number }) {
  const expires_at = Date.now() + (t.expires_in - 30) * 1000; // 30s safety
  const full: GoogleToken = { ...t, expires_at };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  return full;
}

export function clearStoredToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isGoogleTokenValid(): boolean {
  const t = getStoredToken();
  if (!t) return false;
  if (t.expires_at && t.expires_at <= Date.now()) return false;
  if (!hasDriveScope(t)) return false;
  return true;
}


export async function getValidAccessToken(): Promise<string> {
  if (isGoogleTokenValid()) return getStoredToken()!.access_token;
  await getAccessTokenSilent().catch(() => getAccessTokenInteractive());
  const t = getStoredToken();
  if (!t) throw new Error("Kein Google-Token verfügbar.");
  return t.access_token;
}

let tokenClient: any | null = null;

function initTokenClient() {
  if (tokenClient) return tokenClient;
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services nicht geladen");
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (resp: any) => {
      if (resp?.error) {
        console.error("GIS error", resp.error);
        return;
      }
      if (resp?.access_token) {
        saveToken({
          access_token: resp.access_token,
          expires_in: resp.expires_in || 3600,
          scope: resp.scope || SCOPES,
          token_type: "Bearer",
        });
      }
    },
  });
  return tokenClient;
}

export async function getAccessTokenSilent(): Promise<void> {
  initTokenClient();
  return new Promise((resolve, reject) => {
    try {
      tokenClient!.requestAccessToken({ prompt: "" });
      // We don't get a direct promise; poll briefly for storage write
      const t0 = Date.now();
      const iv = setInterval(() => {
        const t = getStoredToken();
        if (t?.access_token) { clearInterval(iv); resolve(); }
        else if (Date.now() - t0 > 3500) { clearInterval(iv); reject(new Error("Silent-Token fehlgeschlagen")); }
      }, 100);
    } catch (e) {
      reject(e);
    }
  });
}

export async function getAccessTokenInteractive(): Promise<void> {
  initTokenClient();
  return new Promise((resolve, reject) => {
    try {
      tokenClient!.requestAccessToken({ prompt: "consent" });
      const t0 = Date.now();
      const iv = setInterval(() => {
        const t = getStoredToken();
        if (t?.access_token) { clearInterval(iv); resolve(); }
        else if (Date.now() - t0 > 120000) { clearInterval(iv); reject(new Error("Popup-Login abgebrochen")); }
      }, 150);
    } catch (e) {
      reject(e);
    }
  });
}

export async function revokeAndClear(): Promise<void> {
  try {
    const t = getStoredToken();
    if (t?.access_token && window.google?.accounts?.oauth2?.revoke) {
      await window.google.accounts.oauth2.revoke(t.access_token, () => {});
    }
  } finally {
    clearStoredToken();
  }
}


export function tokenExpired(skewSeconds: number = 60): boolean {
  const t = getStoredToken();
  if (!t) return true;
  const exp = typeof t.expires_at === "number" ? t.expires_at : 0;
  return !exp || exp <= Date.now() + skewSeconds * 1000;
}


/**
 * Versucht still zu refreshen, wenn das Token bald abläuft.
 * Gibt true zurück, wenn danach (wieder) ein gültiges Token vorhanden ist.
 */
export async function silentRefreshIfNeeded(leewaySeconds: number = 180): Promise<boolean> {
  try {
    const t = getStoredToken();
    const need = !t || (typeof t.expires_at === "number" && t.expires_at <= Date.now() + leewaySeconds * 1000);
    if (!need && isGoogleTokenValid()) return true;
    await getAccessTokenSilent();
    return isGoogleTokenValid();
  } catch {
    return false;
  }
}


export function redirectToLogin1(): never {
  // optional: lokalen Zustand löschen, damit Router sauber startet
  try { clearStoredToken(); } catch {}
  // harter Redirect – unabhängig vom Router-State
  window.location.replace("/login1");
  throw new Error("Redirecting to /login1");
}
