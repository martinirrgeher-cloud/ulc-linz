export type MediaType = "image" | "video";

export type MediaItem = {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  type: MediaType;
  createdAt: string;
};

export type Exercise = {
  id: string;
  name: string;
  hauptgruppe?: string;
  untergruppe?: string;
  active: boolean;
  difficulty?: number;
  menge?: number;
  einheit?: string;
  beschreibung?: string;
  media?: MediaItem[];
  createdAt: string;
  updatedAt: string;
};

export type ExercisesJson = {
  version: 1;
  items: Exercise[];
  updatedAt: string;
};
