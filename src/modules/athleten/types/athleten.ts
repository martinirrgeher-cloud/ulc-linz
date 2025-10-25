export interface TrainingEntry {
  /** ISO week format e.g. "2025-43" */
  week: string;
  /** Wochentag → Status: "?" | "Ja" | "Nein" */
  anmeldung: Record<string, "?" | "Ja" | "Nein">;
  /** optionale Notizen pro Tag */
  notizen?: Record<string, string>;
}

export interface TrainingsplanEinheit {
  tag: string;        // e.g. "Mo", "Di", ...
  inhalt: string;     // Textbeschreibung der Einheit
  umfang?: string;    // z.B. "6x400m" oder "45min locker"
}

export interface Trainingsplan {
  week: string;
  einheiten: TrainingsplanEinheit[];
}

export interface Trainingsfeedback {
  week: string;
  eintrag: string;
  bewertung?: number; // 1–5
}

export interface Athlete {
  id: string;
  name: string;
  geburtsjahr?: number;
  leistungsgruppe?: string;
  info?: string;

  // Wöchentliche Daten
  anmeldung: TrainingEntry[];
  plaene: Trainingsplan[];
  feedback: Trainingsfeedback[];
}

export interface AthletenDatei {
  version: 1;
  updatedAt: string; // ISO string
  athletes: Athlete[];
}
