import { useEffect, useRef } from "react";
import { silentRefreshIfNeeded, tokenExpired, getValidAccessToken, redirectToLogin1 } from "@/lib/googleAuth";

export default function useTokenRefresh() {
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/login")) return;

    const onActivity = () => { lastActivity.current = Date.now(); };
    ["pointerdown", "keydown", "scroll", "visibilitychange"].forEach(evt => {
      document.addEventListener(evt, onActivity, { passive: true });
    });

    const onFocus = async () => { await silentRefreshIfNeeded(); };
    window.addEventListener("focus", onFocus);

    const interval = setInterval(async () => {
      // Nur wenn der Nutzer kürzlich aktiv war
      if (Date.now() - lastActivity.current < 3 * 60 * 1000) {
        const ok = await silentRefreshIfNeeded();
        if (!ok) {
          redirectToLogin1(); // Google-Session verloren
          return;
        }
      }
      if (tokenExpired(10) && !getValidAccessToken()) {
        redirectToLogin1();
      }
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      ["pointerdown", "keydown", "scroll", "visibilitychange"].forEach(evt => {
        document.removeEventListener(evt, onActivity);
      });
    };
  }, []);
}
