// src/modules/leistungsgruppe/anmeldung/services/AnmeldungStore.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

export type DayStatus = "YES" | "NO" | "MAYBE" | null;
export interface AnmeldungData {
  statuses: Record<string, DayStatus>;
  notes: Record<string, string>;
}

function getFileId(): string {
  const anyIDS = IDS as any;
  const id =
    anyIDS.LG_ANMELDUNG_FILE_ID ||
    anyIDS.ANMELDUNG_FILE_ID ||
    import.meta.env.VITE_DRIVE_LG_ANMELDUNG_FILE_ID;
  if (!id) throw new Error("ANMELDUNG_FILE_ID fehlt (IDS/ENV).");
  return id as string;
}

export async function loadAnmeldung(): Promise<AnmeldungData> {
  const raw = await downloadJson<any>(getFileId());
  return {
    statuses: (raw && typeof raw === "object" && raw.statuses) || {},
    notes: (raw && typeof raw === "object" && raw.notes) || {},
  };
}

export async function saveAnmeldung(data: AnmeldungData): Promise<void> {
  await overwriteJsonContent(getFileId(), data);
}
