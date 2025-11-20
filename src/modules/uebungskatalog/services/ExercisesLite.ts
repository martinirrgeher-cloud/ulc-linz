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
};

export async function listExercisesLite(): Promise<ExerciseLite[]> {
  const fileId =
    IDS.UEBUNGEN_FILE_ID || import.meta.env.VITE_DRIVE_UEBUNGEN_FILE_ID;
  if (!fileId) return [];

  const data = await downloadJson<any>(fileId);
  // Erwartetes Format (Beispiel aus deinem Projekt):
  // { exercises: Exercise[] } ODER direkt ein Array
  const arr: any[] = Array.isArray(data) ? data : (data?.exercises ?? []);

  return arr
    .filter((x) => x && (x.active ?? true))
    .map((x) => ({
      id: x.id,
      name: x.name,
      haupt: x.hauptgruppe ?? null,
      unter: x.untergruppe ?? null,
      reps: x.reps ?? null,           // falls vorhanden, sonst null
      menge: x.menge ?? null,         // z. B. 5
      einheit: x.einheit ?? null      // z. B. "min"
    }));
}
