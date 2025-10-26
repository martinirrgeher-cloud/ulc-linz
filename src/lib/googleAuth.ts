let tokenClient: google.accounts.oauth2.TokenClient | null = null;

const TOKEN_KEY = "google_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Google Identity Services initialisieren */
export function initGoogleAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file openid email profile",
          callback: () => {},
        } as any);
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/** Login-Popup starten und Token speichern */
export function loginGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("TokenClient nicht initialisiert"));

    (tokenClient as any).callback = (resp: google.accounts.oauth2.TokenResponse) => {
      try {
        if (resp && resp.access_token) {
          setAccessToken(resp.access_token);
          resolve();
        } else {
          reject(new Error("Kein Access Token erhalten"));
        }
      } catch (e) {
        reject(e);
      }
    };

    (tokenClient as any).requestAccessToken({ prompt: "consent" });
  });
}

/** Optional: Token validieren */
export async function validateGoogleToken(): Promise<boolean> {
  return !!getAccessToken();
}

/** Logout */
export function logoutGoogle() {
  clearStorage();
  try {
    (google.accounts.id as any)?.disableAutoSelect?.();
  } catch (err) {
    console.warn("Auto-Select konnte nicht deaktiviert werden:", err);
  }
}

/** Silent Refresh (ohne Popup) */
export async function refreshAccessToken(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("TokenClient nicht initialisiert"));

    (tokenClient as any).callback = (resp: google.accounts.oauth2.TokenResponse) => {
      if (resp && resp.access_token) {
        setAccessToken(resp.access_token);
        resolve();
      } else {
        reject(new Error("Silent refresh: kein Token erhalten"));
      }
    };

    (tokenClient as any).requestAccessToken({ prompt: "" });
  });
}

/** Best-effort: nur versuchen, wenn bereits ein Token existiert */
export async function silentRefreshIfNeeded(): Promise<void> {
  const token = getAccessToken();
  if (!token) return;
  try {
    await refreshAccessToken();
    console.log("[GIS] Silent refresh erfolgreich");
  } catch (err) {
    console.warn("[GIS] Silent refresh fehlgeschlagen", err);
  }
}
