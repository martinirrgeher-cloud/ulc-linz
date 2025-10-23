/**
 * Google OAuth Helper – finale stabile Version
 * Enthält:
 *  - loadGoogleScript()
 *  - getAccessToken()
 *  - clearStorage()
 *  - silentRefreshIfNeeded()
 *  - initGoogleAuth()
 */

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Wenn Script bereits geladen ist → nichts tun
    if (window.google) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject("Fehler beim Laden des Google OAuth Scripts");
    document.head.appendChild(script);
  });
}

/**
 * Zugriffstoken aus LocalStorage holen
 */
export function getAccessToken(): string | null {
  return localStorage.getItem("google_access_token");
}

/**
 * Token & Ablaufzeit löschen
 */
export function clearStorage() {
  localStorage.removeItem("google_access_token");
  localStorage.removeItem("google_access_expiry");
}

/**
 * Token still erneuern, wenn nötig
 */
export async function silentRefreshIfNeeded(): Promise<string | null> {
  const expiry = localStorage.getItem("google_access_expiry");
  const token = localStorage.getItem("google_access_token");

  // kein Token vorhanden
  if (!token || !expiry) return null;

  const expiresAt = Number(expiry);
  const now = Date.now();

  // noch gültig (mindestens 1 Minute)
  if (now + 60_000 < expiresAt) {
    return token;
  }

  // still erneuern
  await loadGoogleScript();

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (resp: any) => {
        if (resp.access_token) {
          const newExpiry = Date.now() + resp.expires_in * 1000;
          localStorage.setItem("google_access_token", resp.access_token);
          localStorage.setItem("google_access_expiry", String(newExpiry));
          resolve(resp.access_token);
        } else {
          clearStorage();
          reject("Token Refresh fehlgeschlagen");
        }
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Initialer Google Login Flow
 */
export async function initGoogleAuth() {
  await loadGoogleScript();

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    callback: () => {},
  });

  (tokenClient as any).callback = (resp: any) => {
    if (resp.access_token) {
      const expiresAt = Date.now() + resp.expires_in * 1000;
      localStorage.setItem("google_access_token", resp.access_token);
      localStorage.setItem("google_access_expiry", String(expiresAt));
    } else {
      console.error("Google Auth fehlgeschlagen", resp);
    }
  };

  tokenClient.requestAccessToken();
}
