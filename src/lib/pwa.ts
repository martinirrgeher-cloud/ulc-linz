import { reportTechnicalError } from "@/lib/diagnostics";
import { env } from "@/lib/env";

export function registerPwaServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const build = encodeURIComponent(env.appCommit || env.appVersion);
    void navigator.serviceWorker
      .register(`/sw.js?build=${build}`, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => registration.update())
      .catch((error) => reportTechnicalError(error, "pwa.service_worker_registration"));
  }, { once: true });
}
