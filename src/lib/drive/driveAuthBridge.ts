// src/lib/drive/driveAuthBridge.ts
/* Small bridge that wires googleAuth token into DriveClient. */
import { setAccessTokenProvider } from "@/lib/drive/DriveClientCore";
import { getStoredToken } from "@/lib/googleAuth";

/** Mirror the stored GIS token into globals some legacy code expects. */
export function syncTokenMirror() {
  try {
    const stored = getStoredToken();
    const t = stored?.access_token;
    if (!t) return;
    (window as any).__GOOGLE_ACCESS_TOKEN__ = t;
    localStorage.setItem("google_access_token", t);
    // also keep a generic alias for other old code paths
    (window as any).__ACCESS_TOKEN__ = t;
    localStorage.setItem("access_token", t);
  } catch {}
}

/** Register token provider for DriveClient and mirror once. */
function initBridge() {
  setAccessTokenProvider(async () => {
    const stored = getStoredToken();
    return stored?.access_token;
  });
  syncTokenMirror();
}

// Keep in sync if token changes in another tab/window.
window.addEventListener("storage", (e) => {
  if (e.key && e.key.includes("google_token")) {
    syncTokenMirror();
  }
});

initBridge();
export default {};