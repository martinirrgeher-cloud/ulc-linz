// Zentral & strikt typisiert – bitte in anderen Modulen wiederverwenden, nicht duplizieren.

export type ISOWeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface WeekKey {
  year: number;      // ISO-Jahr
  isoWeek: number;   // ISO-KW (1..53)
}

export interface ExerciseRef {
  id: string;                // Eindeutige ID aus Übungskatalog
  name: string;              // Anzeigename (redundant für Snapshot-Konsistenz)
  wiederholungen?: number;   // optional
  distanz?: number;          // optional (m/km)
  dauerSek?: number;         // optional
  stern?: 1 | 2 | 3 | 4 | 5; // Schwierigkeitslevel
  notiz?: string;            // Freitext
}

export interface DayPlan {
  dateISO: string;           // YYYY-MM-DD (immer Datum der aktuellen ISO-Woche)
  items: ExerciseRef[];
  note?: string;
}

export type WeekDays = Record<ISOWeekDay, DayPlan>;

export interface Trainingsplan {
  key: WeekKey;
  version: number;                // Schema-Version für zukünftige Migrationspfade
  updatedAt: string;         // ISO-Zeitstempel
  days: WeekDays;            // Mo–So
}

export interface LoadState {
  loading: boolean;
  error?: string;
}

export interface SaveState {
  saving: boolean;
  error?: string;
  lastSavedAt?: string; // ISO
}
