// src/lib/googleAuth.ts

let accessToken: string | null = null;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
// Readonly, damit beliebige Dateien gelesen werden können
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

let tokenClient: any = null;

declare global {
  interface Window {
    google: any;
  }
}

/** Google Identity initialisieren */
export function initGoogleAuth() {
  if (typeof window.google === "undefined" || !window.google?.accounts?.oauth2) {
    console.error("Google Identity Services nicht geladen.");
    return;
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response: any) => {
      if (response?.error) {
        console.error("❌ Token Error:", response);
        return;
      }
      accessToken = response.access_token;
      localStorage.setItem("google_access_token", accessToken);
      const expiresIn = Number(response.expires_in ?? 0);
      if (expiresIn > 0) {
        const expiry = Date.now() + expiresIn * 1000;
        localStorage.setItem("google_access_expiry", String(expiry));
      } else {
        localStorage.removeItem("google_access_expiry");
      }
    },
  });
}

/** Interaktiven Token anfordern (öffnet Popup) */
export function requestAccessToken(prompt: "consent" | "" = "consent") {
  if (!tokenClient) initGoogleAuth();
  tokenClient?.requestAccessToken({ prompt });
}

/** Token aus LocalStorage wiederherstellen, wenn gültig */
export function restoreAccessToken(): boolean {
  const stored = localStorage.getItem("google_access_token");
  const expiry = Number(localStorage.getItem("google_access_expiry") || 0);

  if (!stored) return false;
  if (expiry && Date.now() >= expiry) {
    logoutGoogle();
    return false;
  }
  accessToken = stored;
  return true;
}

/** Aktuellen Token liefern (versucht bei Bedarf Restore) */
export function getAccessToken(): string | null {
  if (!accessToken) {
    const restored = restoreAccessToken();
    if (!restored) return null;
  }
  return accessToken;
}

/** Token & Ablauf löschen */
export function logoutGoogle() {
  accessToken = null;
  localStorage.removeItem("google_access_token");
  localStorage.removeItem("google_access_expiry");
}

/** Komplett-Logout inkl. Redirect */
export function forceLogout() {
  logoutGoogle();
  window.location.href = "/login";
}

/** Button-Login: öffnet Popup, wartet auf Token */
export async function signInWithGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      requestAccessToken("consent");
      const started = Date.now();
      const poll = setInterval(() => {
        const token = getAccessToken();
        if (token) {
          clearInterval(poll);
          resolve();
        } else if (Date.now() - started > 10000) {
          clearInterval(poll);
          reject(new Error("Timeout beim Google Login"));
        }
      }, 200);
    } catch (err) {
      reject(err);
    }
  });
}
