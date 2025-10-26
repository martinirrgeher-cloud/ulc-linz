// src/lib/googleAuth.ts

let tokenClient: google.accounts.oauth2.TokenClient | null = null;

/**
 * Initialisiert den Google OAuth Token Client.
 * Gibt ein Promise zurück, damit Login1.tsx .then() nutzen kann.
 */
export function initGoogleAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!tokenClient) {
        console.log("[GIS] Client ID aus ENV:", import.meta.env.VITE_GOOGLE_CLIENT_ID);

        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: "email profile openid https://www.googleapis.com/auth/drive.readonly",
          callback: (response) => {
            console.log("🔐 Access Token erhalten:", response.access_token);
            localStorage.setItem("google_token", response.access_token);
            // ⚠️ callback wird beim Login überschrieben
          },
        });

        console.log("[GIS] Popup init erfolgreich.");
      }

      resolve();
    } catch (err) {
      console.error("❌ Fehler bei initGoogleAuth:", err);
      reject(err);
    }
  });
}

/**
 * Startet den Google Login Popup und gibt ein Promise zurück,
 * das erst nach erfolgreicher Token-Übergabe aufgelöst wird.
 */
export function loginGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      console.warn("[GIS] Token Client fehlte — wird initialisiert");
      initGoogleAuth().then(() => loginGoogle().then(resolve).catch(reject));
      return;
    }

    console.log("[GIS] Google Login Button geklickt (Popup)");

    tokenClient!.callback = (response) => {
      if (response && response.access_token) {
        console.log("🔐 Access Token erhalten:", response.access_token);
        localStorage.setItem("google_token", response.access_token);
        resolve();
      } else {
        console.error("❌ Kein Access Token erhalten.");
        reject(new Error("Kein Access Token erhalten"));
      }
    };

    tokenClient!.requestAccessToken({ prompt: "select_account" });
  });
}

/**
 * Liefert den gespeicherten Access Token zurück.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem("google_token");
}

/**
 * Prüft, ob ein Token vorhanden und gültig ist.
 */
export async function validateGoogleToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ Token gültig für Benutzer:", data.email);
      return true;
    } else {
      console.warn("⚠️ Token ungültig oder abgelaufen.");
      clearStorage();
      return false;
    }
  } catch (err) {
    console.error("❌ Fehler bei der Tokenvalidierung:", err);
    clearStorage();
    return false;
  }
}

/**
 * Löscht Token & lokale Daten.
 */
export function clearStorage() {
  localStorage.removeItem("google_token");
}

/**
 * Meldet den User ab und deaktiviert Google Auto-Select.
 */
export function logoutGoogle() {
  clearStorage();
  try {
    google.accounts.id.disableAutoSelect();
    console.log("👋 Google Auto-Login deaktiviert.");
  } catch (err) {
    console.warn("⚠️ Konnte Auto-Select nicht deaktivieren:", err);
  }
}
