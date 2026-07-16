// services/authToken.ts (with compat getAccessToken shim)
import { getTokenFromProvider } from "@/lib/drive/token";

export type TokenDiag = {
  ok: boolean;
  accessToken?: string | null;
  scope?: string | null;
  reason?: string;
};

export async function resolveAccessTokenWithDiag(): Promise<TokenDiag> {
  try {
    const viaProvider = await getTokenFromProvider();
    if (viaProvider && typeof viaProvider === "string" && viaProvider.length > 20) {
      const scope = getStoredScope();
      return { ok: true, accessToken: viaProvider, scope };
    }
  } catch {}

  const candidates = [
    "google_token_v2",
    "google_token",
    "googleAccessToken",
    "gis_token",
    "auth.google",
    "auth",
    "GOOGLE_TOKEN",
    "GIS_TOKEN",
  ];
  for (const store of [localStorage, sessionStorage]) {
    for (const key of candidates) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        if (/^[A-Za-z0-9-_.]+$/.test(raw) && raw.length > 20) {
          return { ok: true, accessToken: raw, scope: getStoredScope() };
        }
        try {
          const obj = JSON.parse(raw);
          if (obj && typeof obj.access_token === "string") {
            return { ok: true, accessToken: obj.access_token, scope: String(obj.scope || null) };
          }
          if (obj?.google && typeof obj.google.access_token === "string") {
            return { ok: true, accessToken: obj.google.access_token, scope: String(obj.google.scope || null) };
          }
          if (obj?.token && typeof obj.token === "string") {
            return { ok: true, accessToken: obj.token, scope: null };
          }
        } catch {}
      } catch {}
    }
  }

  try {
    const gapi: any = (globalThis as any).gapi;
    const at = gapi?.auth2?.getAuthInstance?.()?.currentUser?.get()?.getAuthResponse(true)?.access_token;
    if (typeof at === "string" && at.length > 10) {
      return { ok: true, accessToken: at, scope: null };
    }
  } catch {}

  return { ok: false, accessToken: null, scope: null, reason: "Kein Token gefunden" };
}

function getStoredScope(): string | null {
  try {
    const raw = localStorage.getItem("google_token_v2") || localStorage.getItem("google_token");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.scope ? (Array.isArray(obj.scope) ? obj.scope.join(" ") : String(obj.scope)) : null;
  } catch { return null; }
}

export function hasDriveScope(scope: string | null): boolean {
  const s = String(scope || "");
  return /https:\/\/www\.googleapis\.com\/auth\/drive(\.[a-z]+)?/.test(s);
}

// ⬇️ Backwards-compat shim expected by older imports
export async function getAccessToken(): Promise<string | null> {
  const d = await resolveAccessTokenWithDiag();
  return d.ok ? (d.accessToken ?? null) : null;
}
