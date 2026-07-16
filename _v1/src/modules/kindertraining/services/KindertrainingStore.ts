// src/modules/kindertraining/services/KindertrainingStore.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

export type DayState = true | false | null;

export type Person = {
  name: string;
  paid?: boolean;
  inactive?: boolean;
  generalNote?: string;
};

export type TrainingData = {
  weeks: Record<string, Record<string, DayState>>; // weekId -> personName -> state
  notes?: Record<string, Record<string, string>>;  // weekId -> personName -> note
};

export async function loadPersons(): Promise<Person[]> {
  if (!IDS.KT_PERSONEN_FILE_ID) throw new Error("KT_PERSONEN_FILE_ID fehlt");
  const raw = await downloadJson<any>(IDS.KT_PERSONEN_FILE_ID);
  if (Array.isArray(raw)) return raw as Person[];
  if (Array.isArray(raw?.persons)) return raw.persons as Person[];
  return [];
}

export async function loadTrainingData(): Promise<TrainingData> {
  if (!IDS.KT_DATA_FILE_ID) throw new Error("KT_DATA_FILE_ID fehlt");
  const raw = await downloadJson<any>(IDS.KT_DATA_FILE_ID);
  const weeks = (raw?.weeks && typeof raw.weeks === "object") ? raw.weeks : {};
  const notes = (raw?.notes && typeof raw.notes === "object") ? raw.notes : {};
  return { weeks, notes };
}

export async function saveTrainingData(next: TrainingData): Promise<void> {
  if (!IDS.KT_DATA_FILE_ID) throw new Error("KT_DATA_FILE_ID fehlt");
  await overwriteJsonContent(IDS.KT_DATA_FILE_ID, next);
}