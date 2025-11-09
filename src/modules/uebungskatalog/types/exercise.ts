// types/exercise.ts
export type MediaKind = "image" | "video";
export interface MediaItem { id: string; name: string; mimeType: string; url: string; type: MediaKind; createdAt?: string; }
export interface Exercise {
  id: string; name: string; hauptgruppe: string; untergruppe: string; difficulty: 1|2|3|4|5;
  menge?: number; einheit?: string; info?: string; active: boolean; media?: MediaItem[]; createdAt: string; updatedAt: string;
}
export interface ExercisesJson { exercises: Exercise[]; }
export interface KategorienJson { hauptgruppen: Record<string, string[]>; }
