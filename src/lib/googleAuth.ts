/// <reference types="google.accounts" />
// src/lib/googleAuth.ts
// Google Identity Services (GIS) access token handling – single source of truth

import { requireEnv } from "@/lib/requireEnv";

const GOOGLE_CLIENT_ID = requireEnv("VITE_GOOGLE_CLIENT_ID");

let accessToken: string | null = null;
let expiry: number | null = null;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

const SCOPES = [
  // Full Drive access to avoid "appNotAuthorizedToFile" when editing files
  // not originally created by this app. If you prefer a narrower scope,
  // ensure files are created by the app or granted to it via Drive Picker.
  "https://www.googleapis.com/auth/drive"
].join(" ");
const TOKEN_MARGIN_MS = 60_000; // refresh 60s before expiry
const STORAGE_TOKEN = "google_access_token";
const STORAGE_EXP = "google_access_expiry";

export function loadFromStorage() {
  const t = localStorage.getItem(STORAGE_TOKEN);
  const e = localStorage.getItem(STORAGE_EXP);
  if (t && e) {
    accessToken = t;
    const parsed = parseInt(e, 10);
    expiry = Number.isFinite(parsed) ? parsed : null;
  }
}

export function saveToStorage(token: string, expiresIn: number) {
  accessToken = token;
  const expMs = Date.now() + Math.max(0, expiresIn - 5) * 1000; // subtract 5s safety
  expiry = expMs;
  localStorage.setItem(STORAGE_TOKEN, token);
  localStorage.setItem(STORAGE_EXP, String(expMs));
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_EXP);
  accessToken = null;
  expiry = null;
}

export function getAccessToken(): string | null {
  if (!accessToken || !expiry) loadFromStorage();
  return accessToken;
}

export function tokenExpired(): boolean {
  if (!expiry) return true;
  return Date.now() >= (expiry - TOKEN_MARGIN_MS);
}

export function isLoggedIn(): boolean {
  loadFromStorage();
  return !!accessToken && !!expiry && Date.now() < expiry;
}

export function initGoogleAuth() {
  // Idempotent init; also waits until window.google exists.
  // Call this early (e.g., in App mount or Login1).
  if (!(window as any).google) return; // caller may retry later
  if (tokenClient) return;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    scope: SCOPES,
    // The callback will be set per request to return a Promise.
    callback: () => {}
  });
}

// Request an access token. Returns a Promise that resolves when the token is stored.
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
      // Token response includes access_token and expires_in
      const token = (resp as any).access_token as string;
      const expiresIn = Number((resp as any).expires_in || 3600);
      if (!token) {
        reject(new Error("Kein Access-Token erhalten."));
        return;
      }
      saveToStorage(token, expiresIn);
      resolve();
    };

    try {
      tokenClient.requestAccessToken({ prompt });
    } catch (e) {
      reject(e);
    }
  });
}

// Silent refresh if close to expiry.
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
