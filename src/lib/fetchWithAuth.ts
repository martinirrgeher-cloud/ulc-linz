import { loadFromStorage, tokenExpired, silentRefreshIfNeeded, getAccessToken } from "@/lib/googleAuth";

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const stored = loadFromStorage();

  if (!stored || tokenExpired()) {
  await silentRefreshIfNeeded();
}

  const token = getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resp = await fetch(input, { ...init, headers });

  if (resp.status === 401) {
    console.warn("401 Unauthorized – Token ungültig oder abgelaufen");
  }

  return resp;
}
