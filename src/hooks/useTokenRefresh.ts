import { useEffect } from "react";
import { getValidAccessToken, silentRefreshIfNeeded } from "@/lib/googleAuth";

/**
 * Führt regelmäßig einen Best-Effort Silent-Refresh aus.
 * Läuft nicht auf /login* und nicht ohne vorhandenes Access-Token.
 */
export default function useTokenRefresh(intervalMs: number = 60_000) {
  useEffect(() => {
    const shouldRun = () => {
      const path = window.location.pathname;
      if (path.startsWith("/login")) return false;
      if (typeof document !== "undefined" && document.hidden) return false;
      return !!getValidAccessToken();
    };

    const tick = async () => {
      if (!shouldRun()) return;
      try {
        await silentRefreshIfNeeded();
      } catch (err) {
        console.error("token refresh failed", err);
      }
    };

    void tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
