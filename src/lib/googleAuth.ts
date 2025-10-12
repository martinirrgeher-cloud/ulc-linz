// src/lib/googleAuth.ts
let accessToken: string | null = null;
let tokenClient: any = null;

export function initGoogleAuth() {
  if (!window.google?.accounts?.oauth2) {
    console.warn("⚠️ Google OAuth2 Client nicht geladen");
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: (resp: any) => {
      // wird dynamisch bei Aufruf überschrieben
    },
  });
}

/**
 * Popup Login
 */
export function signInWithGoogle(): Promise<string> {
  if (!tokenClient) initGoogleAuth();
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        console.error("❌ Google Auth Error:", resp);
        reject(resp);
      } else {
        accessToken = resp.access_token;
        localStorage.setItem("gAccessToken", accessToken);
        resolve(accessToken);
      }
    };
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/**
 * Silent Login (kein Popup)
 */
export function signInSilentWithGoogle(): Promise<string | null> {
  if (!tokenClient) initGoogleAuth();
  return new Promise((resolve) => {
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        console.warn("⚠️ Silent Login fehlgeschlagen");
        resolve(null);
      } else {
        accessToken = resp.access_token;
        localStorage.setItem("gAccessToken", accessToken);
        resolve(accessToken);
      }
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

export function getAccessToken() {
  if (!accessToken) accessToken = localStorage.getItem("gAccessToken");
  return accessToken;
}

export function hasAccessToken() {
  return !!getAccessToken();
}

export function clearAccessToken() {
  accessToken = null;
  localStorage.removeItem("gAccessToken");
}

export function restoreAccessToken() {
  const stored = localStorage.getItem("gAccessToken");
  if (stored) accessToken = stored;
}

export async function getUserInfo() {
  const token = getAccessToken();
  if (!token) throw new Error("Kein Access Token vorhanden");

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    clearAccessToken();
    throw new Error("Fehler beim Laden der User Info");
  }

  return await response.json();
}
