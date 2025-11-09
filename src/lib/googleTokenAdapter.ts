// Nicht-invasiver Adapter: liefert genau die drei benötigten Funktionen,
// ohne deine bestehende googleAuth.ts zu verändern.

const TOKEN_KEYS = ["google_access_token", "access_token"]; // gängige Keys
const EXP_KEYS = ["google_access_token_expires_at", "access_token_expires_at"]; // optional

export function getGoogleAccessTokenFromStorage(): string | null {
  if (typeof localStorage === "undefined") return null;
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function tokenExpired(): boolean {
  if (typeof localStorage === "undefined") return false;
  for (const k of EXP_KEYS) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    const exp = Number(raw);
    if (Number.isFinite(exp) && Date.now() > exp) return true;
  }
  return false; // kein Expiry gespeichert → als gültig behandeln
}

export function requireGoogleTokenOrRedirect(): string {
  const t = getGoogleAccessTokenFromStorage();
  if (!t || tokenExpired()) {
    try {
      for (const k of TOKEN_KEYS) localStorage.removeItem(k);
    } catch {}
    if (typeof window !== "undefined" && window.location.pathname !== "/login1") {
      window.location.href = "/login1";
    }
    throw new Error("No valid Google token");
  }
  return t;
}
