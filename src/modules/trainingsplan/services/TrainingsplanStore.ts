// src/modules/trainingsplan/services/TrainingsplanStore.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { Trainingsplan } from "../types/TrainingsplanTypes";

export async function loadTrainingsplan(fileId?: string): Promise<Trainingsplan | null> {
  const id = fileId || IDS.TRAININGSPLAN_FILE_ID;
  if (!id) throw new Error("TRAININGSPLAN_FILE_ID fehlt");
  const raw = await downloadJson<any>(id);
  return raw || null;
}

export async function saveTrainingsplan(plan: Trainingsplan, fileId?: string): Promise<void> {
  const id = fileId || IDS.TRAININGSPLAN_FILE_ID;
  if (!id) throw new Error("TRAININGSPLAN_FILE_ID fehlt");
  await overwriteJsonContent(id, plan);
}