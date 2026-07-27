const TRAINING_DOCUMENTATION_DRAFT_PREFIX = "ulc-training-documentation:";
const TRAINING_DOCUMENTATION_UPLOAD_PREFIX = "ulc-training-doc-video:";

export const TRAINING_DOCUMENTATION_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function removeKeysWithPrefixes(prefixes: readonly string[]): void {
  if (!storageAvailable()) return;

  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function trainingDocumentationDraftKey(
  organizationId: string,
  sessionId: string,
): string {
  return `${TRAINING_DOCUMENTATION_DRAFT_PREFIX}${organizationId}:${sessionId}`;
}

export function clearSensitiveSessionData(): void {
  removeKeysWithPrefixes([
    TRAINING_DOCUMENTATION_DRAFT_PREFIX,
    TRAINING_DOCUMENTATION_UPLOAD_PREFIX,
  ]);
}

export function purgeExpiredTrainingDocumentationDrafts(
  now = Date.now(),
): number {
  if (!storageAvailable()) return 0;

  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(TRAINING_DOCUMENTATION_DRAFT_PREFIX)) keys.push(key);
  }

  let removed = 0;
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const value = JSON.parse(raw) as { savedAt?: unknown; expiresAt?: unknown };
      const savedAt = typeof value.savedAt === "string" ? Date.parse(value.savedAt) : Number.NaN;
      const expiresAt = typeof value.expiresAt === "string" ? Date.parse(value.expiresAt) : Number.NaN;
      const isExpired = Number.isFinite(expiresAt)
        ? expiresAt <= now
        : !Number.isFinite(savedAt) || savedAt + TRAINING_DOCUMENTATION_DRAFT_MAX_AGE_MS <= now;

      if (!isExpired) continue;
    } catch {
      // Unlesbare sensible Entwürfe nicht dauerhaft auf dem Gerät behalten.
    }

    window.localStorage.removeItem(key);
    removed += 1;
  }

  return removed;
}
