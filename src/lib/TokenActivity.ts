const KEY_LAST_ACTIVE = "app_last_active_ts";

export function markActive() {
  try { localStorage.setItem(KEY_LAST_ACTIVE, String(Date.now())); } catch {}
}
export function getLastActive(): number {
  try { return Number(localStorage.getItem(KEY_LAST_ACTIVE) || 0); } catch { return 0; }
}
export function wasActiveWithin(ms: number): boolean {
  const last = getLastActive();
  return last > 0 && (Date.now() - last) <= ms;
}
// attach global listeners once
let wired = false;
export function wireGlobalActivityListeners() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  ["click","keydown","mousemove","touchstart","scroll","visibilitychange"].forEach(evt => {
    window.addEventListener(evt, markActive, { passive: true });
  });
  markActive();
}
