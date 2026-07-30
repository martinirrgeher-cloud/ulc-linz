const LEGACY_TRAINING_DOCUMENTATION_DRAFT_PREFIX = "ulc-training-documentation:";
const LEGACY_TRAINING_DOCUMENTATION_UPLOAD_PREFIX = "ulc-training-doc-video:";
const LEGACY_EXERCISE_VIDEO_UPLOAD_PREFIX = "ulc-exercise-video-tus:";

const TRAINING_DOCUMENTATION_DRAFT_PREFIX = "ulc-training-documentation:v2:";
const TRAINING_DOCUMENTATION_UPLOAD_PREFIX = "ulc-training-doc-video:v2:";
const EXERCISE_VIDEO_UPLOAD_PREFIX = "ulc-exercise-video-tus:v2:";

export const TRAINING_DOCUMENTATION_DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const RESUMABLE_UPLOAD_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const ALL_SENSITIVE_PREFIXES = [
  LEGACY_TRAINING_DOCUMENTATION_DRAFT_PREFIX,
  LEGACY_TRAINING_DOCUMENTATION_UPLOAD_PREFIX,
  LEGACY_EXERCISE_VIDEO_UPLOAD_PREFIX,
] as const;

const VERSIONED_SENSITIVE_PREFIXES = [
  TRAINING_DOCUMENTATION_DRAFT_PREFIX,
  TRAINING_DOCUMENTATION_UPLOAD_PREFIX,
  EXERCISE_VIDEO_UPLOAD_PREFIX,
] as const;

type ScopedStoredValue = {
  ownerUserId?: unknown;
  organizationId?: unknown;
  expiresAt?: unknown;
};

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function storageKeys(): string[] {
  if (!storageAvailable()) return [];

  const keys: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

function removeStorageKey(key: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Lokale Browserdaten dürfen die App nicht blockieren.
  }
}

function removeKeysWithPrefixes(prefixes: readonly string[]): void {
  for (const key of storageKeys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) removeStorageKey(key);
  }
}

function scopedKey(
  prefix: string,
  organizationId: string,
  ownerUserId: string,
  entityFingerprint: string,
): string {
  return `${prefix}${organizationId}:${ownerUserId}:${entityFingerprint}`;
}

export function trainingDocumentationDraftKey(
  organizationId: string,
  ownerUserId: string,
  sessionId: string,
): string {
  return scopedKey(TRAINING_DOCUMENTATION_DRAFT_PREFIX, organizationId, ownerUserId, sessionId);
}

export function trainingDocumentationVideoUploadKey(
  organizationId: string,
  ownerUserId: string,
  fingerprint: string,
): string {
  return scopedKey(TRAINING_DOCUMENTATION_UPLOAD_PREFIX, organizationId, ownerUserId, fingerprint);
}

export function exerciseVideoUploadKey(
  organizationId: string,
  ownerUserId: string,
  fingerprint: string,
): string {
  return scopedKey(EXERCISE_VIDEO_UPLOAD_PREFIX, organizationId, ownerUserId, fingerprint);
}

export function clearSensitiveSessionData(): void {
  removeKeysWithPrefixes(ALL_SENSITIVE_PREFIXES);
}

export function purgeSensitiveSessionData(
  currentUserId: string | null = null,
  now = Date.now(),
): number {
  if (!storageAvailable()) return 0;

  let removed = 0;
  for (const key of storageKeys()) {
    if (!ALL_SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;

    const isVersioned = VERSIONED_SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix));
    if (!isVersioned) {
      // Alte Einträge waren nicht an einen Benutzer gebunden und werden aus
      // Sicherheitsgründen nicht automatisch einem neuen Login zugeordnet.
      removeStorageKey(key);
      removed += 1;
      continue;
    }

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }

    let shouldRemove = false;
    try {
      const value = JSON.parse(raw ?? "") as ScopedStoredValue;
      const ownerUserId = typeof value.ownerUserId === "string" ? value.ownerUserId : null;
      const organizationId = typeof value.organizationId === "string" ? value.organizationId : null;
      const expiresAt = typeof value.expiresAt === "string" ? Date.parse(value.expiresAt) : Number.NaN;

      shouldRemove = !ownerUserId
        || !organizationId
        || !Number.isFinite(expiresAt)
        || expiresAt <= now
        || Boolean(currentUserId && ownerUserId !== currentUserId);
    } catch {
      shouldRemove = true;
    }

    if (shouldRemove) {
      removeStorageKey(key);
      removed += 1;
    }
  }

  return removed;
}
