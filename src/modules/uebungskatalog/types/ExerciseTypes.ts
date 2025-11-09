export type Einheit = "WH" | "m" | "sec" | "min" | "kg";
export const exerciseUnits = ["WH", "m", "sec", "min", "kg"];

export interface Exercise {
  id: string;
  name: string;
  hauptgruppe: string;
  untergruppe: string;
  active: boolean;
  difficulty: 1 | 2 | 3 | 4 | 5;
  menge: number | null;
  einheit: Einheit | "";
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  mediaName?: string;
  createdAt?: string;
  updatedAt?: string;
}
