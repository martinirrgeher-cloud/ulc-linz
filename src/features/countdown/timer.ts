export type CountdownPhase = "idle" | "work" | "rest" | "complete";

export type CountdownSettings = {
  workSeconds: number;
  restSeconds: number;
  exerciseCount: number;
  workAnnouncementInterval: number;
  restAnnouncementInterval: number;
  announceRemainingExercises: boolean;
  voiceEnabled: boolean;
};

export const DEFAULT_COUNTDOWN_SETTINGS: CountdownSettings = {
  workSeconds: 30,
  restSeconds: 15,
  exerciseCount: 8,
  workAnnouncementInterval: 10,
  restAnnouncementInterval: 5,
  announceRemainingExercises: true,
  voiceEnabled: true,
};

export const ANNOUNCEMENT_INTERVALS = [0, 5, 10, 15, 20, 30, 60] as const;

export function normalizeInteger(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function plannedDurationSeconds(settings: CountdownSettings): number {
  return (
    settings.exerciseCount * settings.workSeconds +
    Math.max(0, settings.exerciseCount - 1) * settings.restSeconds
  );
}

export function shouldAnnounceRemainingSecond(
  remainingSeconds: number,
  phaseDurationSeconds: number,
  intervalSeconds: number,
): boolean {
  if (remainingSeconds <= 0) return false;
  if (remainingSeconds <= 5) return true;
  if (intervalSeconds <= 0) return false;
  return (
    remainingSeconds < phaseDurationSeconds &&
    remainingSeconds % intervalSeconds === 0
  );
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
