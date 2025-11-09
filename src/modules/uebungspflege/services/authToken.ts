import { setAccessTokenProvider } from "@/lib/drive/DriveClientCore";
import { getGoogleAccessTokenFromStorage, tokenExpired, requireGoogleTokenOrRedirect } from "@/lib/googleTokenAdapter";

export async function getAccessToken(): Promise<string | undefined> {
  const t = getGoogleAccessTokenFromStorage();
  if (!t || tokenExpired()) {
    try { requireGoogleTokenOrRedirect(); } catch {}
    return undefined;
  }
  return t;
}
setAccessTokenProvider(getAccessToken);
