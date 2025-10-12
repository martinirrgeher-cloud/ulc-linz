// src/lib/training/kindertrainingData.ts
import { loadJsonByName, saveJsonByName } from "../googleDrive";

const FILE_NAME = "kindertraining_data.json";

export async function loadTrainingState(): Promise<{
  people: { name: string; active: boolean }[];
  records: Record<string, Record<string, boolean>>;
  notes: Record<string, string>;
} | null> {
  try {
    const data = await loadJsonByName(FILE_NAME);
    // Fallback-Struktur garantieren
    return data || { people: [], records: {}, notes: {} };
  } catch (err) {
    console.error("❌ Fehler beim Laden:", err);
    return { people: [], records: {}, notes: {} };
  }
}

export async function saveTrainingState(data: any) {
  try {
    await saveJsonByName(FILE_NAME, data);
  } catch (err) {
    console.error("❌ Fehler beim Speichern:", err);
  }
}
