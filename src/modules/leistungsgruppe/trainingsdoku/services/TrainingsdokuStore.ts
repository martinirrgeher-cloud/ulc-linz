import {
  downloadJson,
  overwriteJsonContent,
  uploadFile,
  list,
} from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

export type DokuItemStatus = "AS_PLANNED" | "MODIFIED" | "SKIPPED" | "EXTRA";

/**
 * Gemeinsame Struktur für geplante/Ist-Werte in der Doku.
 * Alle Felder sind optional, damit alte Einträge weiterhin gültig bleiben.
 */
export type DokuLoad = {
  reps?: number | null;
  menge?: number | null;
  einheit?: string | null;

  gewicht?: number | null;
  strecke?: number | null;
  dauerMin?: number | null;

  // optional: Serien (für spätere Auswertungen)
  sets?: number | null;
};

export type ExecutionQuality = "SEHR_GUT" | "GUT" | "OK" | "SCHLECHT";
export type PerceivedDifficulty = "EASY" | "MEDIUM" | "HARD";

export type DokuItem = {
  exerciseId: string;
  status: DokuItemStatus;

  // Planwerte, abgeleitet aus Trainingsplanung (target)
  planned: DokuLoad;

  // Tatsächlich erledigte Werte
  actual?: DokuLoad;

  // allgemeiner Kommentar (z.B. „Muskelkater“, „zu leicht“)
  comment?: string;

  // NEU: Qualität der Ausführung
  executionQuality?: ExecutionQuality;       // z.B. „SEHR_GUT“, „OK“, „SCHLECHT“
  perceivedDifficulty?: PerceivedDifficulty; // z.B. „EASY“, „MEDIUM“, „HARD“
  executionComment?: string;                 // kurze Technik-Bemerkung
};

export type DokuDay = {
  startedAt?: string;
  finishedAt?: string;
  items: DokuItem[];
  summary?: any; // wird im Hook berechnet (wie bisher)
};

export type DokuData = {
  version: number;
  athleteId: string;
  logsByDate: Record<string, DokuDay>;
};

const folderId = (): string => {
  const id = import.meta.env.VITE_DRIVE_TRAININGSDOKU_FOLDER_ID as string | undefined;
  if (!id) {
    throw new Error("VITE_DRIVE_TRAININGSDOKU_FOLDER_ID ist nicht gesetzt");
  }
  return id;
};

async function resolveFileId(athleteId: string): Promise<string> {
  const name = `trainingsdoku_${athleteId}.json`;
  const res = await list({
    q: `'${folderId()}' in parents and name='${name}' and trashed=false`,
  });
  if (res?.files?.[0]?.id) return res.files[0].id;

  // neu anlegen
  const blob = new Blob(
    [
      JSON.stringify(
        { version: 1, athleteId, logsByDate: {} },
        null,
        2
      ),
    ],
    { type: "application/json" }
  );
  const up = await uploadFile({
    name,
    mimeType: "application/json",
    blob,
    parentFolderId: folderId(),
  });
  return up.fileId!;
}

export async function loadDoku(athleteId: string): Promise<DokuData> {
  const id = await resolveFileId(athleteId);
  return (await downloadJson<DokuData>(id))!;
}

export async function saveDoku(
  athleteId: string,
  data: DokuData
): Promise<void> {
  const id = await resolveFileId(athleteId);
  await overwriteJsonContent(id, data);
}
