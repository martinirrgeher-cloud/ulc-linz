// types/exercise.ts

export type MediaKind = "image" | "video";

export interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  type: MediaKind;
  createdAt?: string;
}

/**
 * Vollständiger Übungstyp wie er aus der JSON auf Drive kommt.
 * Die neuen default*-Felder werden später von Trainingsplanung / Trainingsdoku genutzt.
 */
export interface Exercise {
  id: string;
  name: string;
  hauptgruppe: string;
  untergruppe: string;
  difficulty: 1 | 2 | 3 | 4 | 5;

  // Bisherige, generische Vorgabe (z.B. 10 WH, 200 m, 20 min)
  menge?: number;
  einheit?: string;

  // Zusätzliche strukturierte Default-Werte für die Trainingsplanung
  defaultSets?: number | null;
  defaultReps?: number | null;
  defaultDistanceM?: number | null;
  defaultWeightKg?: number | null;
  defaultDurationSec?: number | null;
  defaultPauseSec?: number | null;

  info?: string;
  active: boolean;
  media?: MediaItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ExercisesJson {
  exercises: Exercise[];
}

export interface KategorienJson {
  hauptgruppen: Record<string, string[]>;
}
