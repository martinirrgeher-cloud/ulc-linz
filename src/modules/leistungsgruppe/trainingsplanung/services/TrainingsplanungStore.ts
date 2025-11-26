import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

/**
 * Zielwerte für eine Übung im Plan.
 * Die bisherigen Felder reps/menge/einheit bleiben zur Kompatibilität erhalten
 * und werden um strukturierte Angaben erweitert.
 */
export type PlanTarget = {
  // bisher: generischer Umfang
  reps: number | null;
  menge: number | null;
  einheit: string | null;

  // neu: strukturierte Trainingsparameter
  sets?: number | null;
  distanceM?: number | null;
  weightKg?: number | null;
  durationSec?: number | null;
};

export type PlanItem = {
  exerciseId: string;
  nameCache?: string;
  groupCache?: { haupt?: string; unter?: string };

  // Default-Werte aus dem Übungskatalog
  default: PlanTarget;

  // konkret geplanter Umfang für diese Einheit
  target: PlanTarget;

  pauseSec?: number | null;
  comment?: string;
};

export type PlanBlockType =
  | "WARM_UP"
  | "SPRINT"
  | "TECHNIK"
  | "KRAFT"
  | "AUSLAUFEN"
  | "STABI"
  | "SONSTIGES";

/**
 * Ein Block fasst mehrere Übungen zusammen (z.B. Aufwärmen, Hauptteil, Stabi).
 * Die Blockinfos sind optional – aktuell nutzt die UI nur die flache order-Liste,
 * das ist aber voll kompatibel.
 */
export type PlanBlock = {
  id: string;
  title: string;
  type?: PlanBlockType;
  targetDurationMin?: number | null; // Orientierungsgröße für den Block
  itemOrder: string[];               // Reihenfolge der Item-IDs in diesem Block
  notes?: string | null;             // optionale Block-Notizen
};

/**
 * Plan für einen Tag eines Athleten.
 *
 * - order: alte flache Reihenfolge (für bestehende UI)
 * - items: alle Übungen, indexiert nach ID
 * - blocks/blockOrder: optionale Blockstruktur (für neue UI)
 */
export type PlanDay = {
  order: string[];
  items: Record<string, PlanItem>;
  blocks?: Record<string, PlanBlock>;
  blockOrder?: string[];
};

export type PlansByAthlete = Record<
  string,                          // athleteId
  Record<string, PlanDay>          // YYYY-MM-DD
>;

export type TrainingsplanData = {
  version: number;
  updatedAt: string;
  plansByAthlete: PlansByAthlete;
};

const fileId = () =>
  IDS.TRAININGSPLAN_FILE_ID || import.meta.env.VITE_DRIVE_TRAININGSPLAN_FILE_ID;

export async function loadPlans(): Promise<TrainingsplanData> {
  const data = await downloadJson<TrainingsplanData>(fileId());
  return (
    data ?? {
      version: 1,
      updatedAt: new Date().toISOString(),
      plansByAthlete: {},
    }
  );
}

export async function upsertAthleteDay(
  athleteId: string,
  dateISO: string,
  day: PlanDay
): Promise<void> {
  const data = await loadPlans();
  data.plansByAthlete[athleteId] ??= {};
  data.plansByAthlete[athleteId][dateISO] = day;
  data.updatedAt = new Date().toISOString();
  await overwriteJsonContent(fileId(), data);
}
