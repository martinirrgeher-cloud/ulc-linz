// src/lib/googleAuth.ts
let auth2: gapi.auth2.GoogleAuth | null = null;

/**
 * Initialisiert die Google Auth2 Library
 */
export async function initGoogleAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("google-api-script");

    const loadClient = () => {
      if (typeof gapi === "undefined") {
        reject(new Error("gapi nicht verfügbar"));
        return;
      }

      gapi.load("auth2", () => {
        gapi.auth2
          .init({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          })
          .then((auth) => {
            auth2 = auth;
            resolve();
          })
          .catch(reject);
      });
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-api-script";
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.defer = true;
      script.onload = loadClient;
      script.onerror = () => reject(new Error("Fehler beim Laden der Google API"));
      document.body.appendChild(script);
    } else {
      loadClient();
    }
  });
}

/**
 * Startet den Google Login Flow
 */
export async function signInWithGoogle(): Promise<string | null> {
  if (!auth2) {
    await initGoogleAuth();
  }

  try {
    const googleUser = await auth2!.signIn();
    const token = googleUser.getAuthResponse().access_token;
    return token || null;
  } catch (err) {
    console.error("Fehler beim Google Login:", err);
    return null;
  }
}

/**
 * Holt den Access Token, wenn bereits eingeloggt
 */
export function getAccessToken(): string | null {
  if (!auth2) return null;
  const user = auth2.currentUser.get();
  if (!user || !user.isSignedIn()) return null;
  return user.getAuthResponse().access_token || null;
}

/**
 * Prüft, ob ein Token bei Google noch gültig ist
 */
export async function validateGoogleToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    return res.ok;
  } catch (err) {
    console.error("Fehler bei der Tokenvalidierung:", err);
    return false;
  }
}

/**
 * Loggt den User bei Google aus
 */
export async function signOutGoogle(): Promise<void> {
  if (auth2 && auth2.isSignedIn.get()) {
    await auth2.signOut();
    await auth2.disconnect();
  }
}
