// services/_legacyMap.ts
import type { Exercise, MediaItem } from "../types/exercise";

function clampDifficulty(d?: any): 1|2|3|4|5 {
  const n = Number(d ?? 1);
  return (n < 1 ? 1 : n > 5 ? 5 : n) as 1|2|3|4|5;
}

export function mapLegacyExercise(x: any): Exercise {
  const now = new Date().toISOString();
  // legacy media fields -> media[]
  const media: MediaItem[] = [];
  const mediaUrl = x.mediaUrl ?? x.url ?? "";
  const mediaType = (x.mediaType ?? "").toLowerCase();
  const mediaName = x.mediaName ?? x.name ?? "";
  const mediaId = x.mediaId ?? x.id ?? "";
  if (mediaUrl && mediaType) {
    media.push({
      id: String(mediaId),
      name: String(mediaName || "media"),
      mimeType: mediaType === "video" ? "video/mp4" : "image/png",
      url: String(mediaUrl),
      type: mediaType === "video" ? "video" : "image",
      createdAt: now,
    });
  }
  return {
    id: String(x.id),
    name: String(x.name || ""),
    hauptgruppe: String(x.hauptgruppe || ""),
    untergruppe: String(x.untergruppe || ""),
    menge: x.menge != null ? Number(x.menge) : undefined,
    einheit: x.einheit != null ? String(x.einheit) : undefined,
    info: x.info ?? undefined,
    active: x.active !== false,
    difficulty: clampDifficulty(x.difficulty),
    media,
    createdAt: x.createdAt || now,
    updatedAt: x.updatedAt || x.createdAt || now,
  };
}
