let accessToken: string | null = null;

/**
 * ✅ Prüfen, ob ein Access Token existiert
 */
export function hasAccessToken() {
  return !!accessToken || !!localStorage.getItem("g_token");
}

/**
 * ✅ Token aus Speicher lesen (oder lokal zwischengespeichert zurückgeben)
 */
export function getAccessToken() {
  if (!accessToken) {
    const saved = localStorage.getItem("g_token");
    if (saved) accessToken = saved;
  }
  return accessToken;
}

/**
 * ✅ Token speichern
 */
export function setAccessToken(token: string) {
  accessToken = token;
  localStorage.setItem("g_token", token);
}

/**
 * ✅ Token löschen – z. B. bei 401 Unauthorized
 */
export function clearAccessToken() {
  console.warn("🧼 Token wird gelöscht (401 oder abgelaufen)");
  accessToken = null;
  localStorage.removeItem("g_token");
}

/**
 * 🆕 restoreAccessToken – wieder exportiert, damit alter Import funktioniert
 */
export function restoreAccessToken() {
  const saved = localStorage.getItem("g_token");
  if (saved) {
    accessToken = saved;
    return true;
  }
  return false;
}

/**
 * ✅ Interaktiver Login mit Popup
 */
export async function signInWithGoogle() {
  return new Promise<void>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (response.error) {
          console.error("❌ Google Login Error:", response);
          reject(response);
        } else {
          setAccessToken(response.access_token);
          console.log("✅ Neuer Access Token gesetzt");
          resolve();
        }
      },
    });
    client.requestAccessToken();
  });
}

/**
 * ✅ Silent Login ohne Popup (wenn bereits Token oder Refresh möglich)
 */
export async function signInSilentWithGoogle() {
  return new Promise<boolean>((resolve) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      prompt: "", // 👈 kein Popup
      callback: (response) => {
        if (response && response.access_token) {
          setAccessToken(response.access_token);
          console.log("✅ Silent Login erfolgreich");
          resolve(true);
        } else {
          resolve(false);
        }
      },
    });
    client.requestAccessToken();
  });
}
