export type Einheit = "min" | "m" | "km" | "reps" | "s" | "kg" | string;

export type Exercise = {
  id: string;
  name: string;
  hauptgruppe: string;
  untergruppe?: string;
  difficulty?: number;
  menge?: number;
  einheit?: Einheit;
  media?: { fileId: string; mimeType?: string; title?: string }[];
  createdAt?: string;
  updatedAt?: string;
};
