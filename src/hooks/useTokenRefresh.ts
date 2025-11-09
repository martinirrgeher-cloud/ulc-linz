import { useEffect } from "react";
import { getValidAccessToken } from "@/lib/googleAuth"; // <- einziges named import

export default function useTokenRefresh() {
  useEffect(() => {
    const shouldRun = () => {
      const path = window.location.pathname;
      if (path.startsWith("/login")) return false;
      return !!getValidAccessToken();
    };

    const interval = setInterval(() => {
      if (shouldRun()) {
        // Optional: Zugriff triggert ggf. internen Refresh-Flow
        void getValidAccessToken();
      }
    }, 5 * 60 * 1000); // alle 5 min

    return () => clearInterval(interval);
  }, []);
}