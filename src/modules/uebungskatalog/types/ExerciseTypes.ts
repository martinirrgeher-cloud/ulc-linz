export type Einheit = "WH" | "m" | "sec" | "min" | "kg";
export const exerciseUnits: Einheit[] = ["WH", "m", "sec", "min", "kg"];

export interface Exercise {
  id: string;
  name: string;
  hauptgruppe: string;
  untergruppe: string;
  active: boolean;
  difficulty: 1 | 2 | 3 | 4 | 5;

  // Bisheriger generischer Umfang
  menge: number | null;
  einheit: Einheit | "";

  // Medien-Infos (wie bisher)
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  mediaName?: string;

  createdAt?: string;
  updatedAt?: string;

  // NEU: strukturierte Defaults für Trainingsplanung
  defaultSets?: number | null;
  defaultReps?: number | null;
  defaultDistanceM?: number | null;
  defaultWeightKg?: number | null;
  defaultDurationSec?: number | null;
  defaultPauseSec?: number | null;
}
