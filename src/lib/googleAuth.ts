/// <reference types="google.accounts" />
const STORAGE_TOKEN = "google_access_token";
const STORAGE_EXP = "google_access_expiry";
const SCOPES = "https://www.googleapis.com/auth/drive";
let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let expiry: number | null = null;

export function loadFromStorage() {
  const t = localStorage.getItem(STORAGE_TOKEN);
  const e = localStorage.getItem(STORAGE_EXP);
  if (t && e) {
    accessToken = t;
    expiry = parseInt(e, 10);
  }
}

export function getAccessToken(): string | null {
  if (!accessToken || !expiry) loadFromStorage();
  return accessToken;
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_EXP);
  accessToken = null;
  expiry = null;
}

export function initGoogleAuth() {
  if (!(window as any).google) return;
  if (tokenClient) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    scope: SCOPES,
    callback: () => {}
  });
}

export function requestAccessToken({ prompt = "consent" as "none" | "consent" } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error("Google API nicht geladen."));
      return;
    }
    if (!tokenClient) initGoogleAuth();
    if (!tokenClient) {
      reject(new Error("TokenClient nicht initialisiert."));
      return;
    }
    tokenClient.callback = (resp: google.accounts.oauth2.TokenResponse) => {
      if (resp && (resp as any).error) {
        reject(new Error((resp as any).error_description || "Tokenfehler."));
        return;
      }
      const token = (resp as any).access_token as string;
      const expiresIn = Number((resp as any).expires_in || 3600);
      const expMs = Date.now() + Math.max(0, expiresIn - 5) * 1000;
      accessToken = token;
      expiry = expMs;
      localStorage.setItem(STORAGE_TOKEN, token);
      localStorage.setItem(STORAGE_EXP, String(expMs));
      resolve();
    };
    tokenClient.requestAccessToken({ prompt });
  });
}

export function tokenExpired(): boolean {
  if (!expiry) return true;
  return Date.now() >= (expiry - 60000);
}

export async function silentRefreshIfNeeded(): Promise<boolean> {
  loadFromStorage();
  if (!accessToken || tokenExpired()) {
    try {
      await requestAccessToken({ prompt: "none" });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}