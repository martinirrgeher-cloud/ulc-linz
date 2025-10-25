export type DayStatus = "YES" | "NO" | "MAYBE" | null;

export interface DayEntry {
  /** ISO-Date yyyy-mm-dd */
  date: string;
  /** Kurzes Label dd.mm.yyyy */
  dateLabel: string;
  /** "Mo", "Di", ... */
  weekday: string;
  status: DayStatus;
  note: string;
}

export interface AnmeldungData {
  weeks: Record<string, DayEntry[]>;
}
