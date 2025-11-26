import { downloadJson } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

export type ExerciseLite = {
  id: string;
  name: string;
  haupt?: string | null;
  unter?: string | null;
  reps?: number | null;
  menge?: number | null;
  einheit?: string | null;
  active?: boolean;
  difficulty?: 1 | 2 | 3 | 4 | 5 | null;
};

/**
 * Liefert eine leichte Liste der Übungen aus dem Übungskatalog.
 * Erwartetes Drive-Format:
 * - aktuelles Format: { items: Exercise[] }
 * - ältere Varianten: { exercises: Exercise[] } oder direkt ein Array
 */
export async function listExercisesLite(): Promise<ExerciseLite[]> {
  const fileId =
    IDS.UEBUNGEN_FILE_ID || import.meta.env.VITE_DRIVE_UEBUNGEN_FILE_ID;
  if (!fileId) return [];

  const data = await downloadJson<any>(fileId);

  // Aktuelles Format ({ items: [...] }) + Altformate abdecken
  const arr: any[] = Array.isArray(data)
    ? data
    : (data?.exercises ?? data?.items ?? []);

  if (!Array.isArray(arr) || arr.length === 0) {
    return [];
  }

  return arr
    .filter((x) => x && (x.active ?? true))
    .map((x) => ({
      id: x.id,
      name: x.name,
      haupt: x.hauptgruppe ?? null,
      unter: x.untergruppe ?? null,
      reps: x.reps ?? null,
      menge: x.menge ?? null,
      einheit: x.einheit ?? null,
      active: x.active ?? true,
      difficulty: x.difficulty ?? null,
    }));
}
