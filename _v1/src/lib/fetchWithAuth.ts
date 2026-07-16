// src/lib/fetchWithAuth.ts
import { getValidAccessToken, silentRefreshIfNeeded, redirectToLogin1 } from "@/lib/googleAuth";

/**
 * fetch mit Auto-Auth:
 * - setzt Authorization Header
 * - retry bei 401 nach silent refresh
 * - Redirect zu Login1, wenn auch der Retry fehlschlägt
 */
export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getValidAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    const ok = await silentRefreshIfNeeded();
    if (!ok) { redirectToLogin1(); return res; }
    const t2 = getValidAccessToken();
    if (!t2) { redirectToLogin1(); return res; }
    headers.set("Authorization", `Bearer ${t2}`);
    res = await fetch(input, { ...init, headers });
    if (res.status === 401) {
      redirectToLogin1();
    }
  }
  return res;
}
