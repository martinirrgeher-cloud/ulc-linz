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
    import.meta.env.VITE_DRIVE_LG_ANMELDUNG_FILE_ID ||
    import.meta.env.VITE_DRIVE_ANMELDUNG_FILE_ID;

  if (!id) {
    throw new Error("AnmeldungStore: keine Drive File ID für die Leistungsgruppen-Anmeldung gefunden.");
  }

  return String(id);
}

export async function loadAnmeldung(): Promise<AnmeldungData> {
  const raw = await downloadJson<any>(getFileId());
  const safe = raw && typeof raw === "object" ? raw : {};

  return {
    statuses: (safe.statuses && typeof safe.statuses === "object" ? safe.statuses : {}) as Record<
      string,
      DayStatus
    >,
    notes: (safe.notes && typeof safe.notes === "object" ? safe.notes : {}) as Record<string, string>,
  };
}

/**
 * Speichert den kompletten Anmeldestatus (alle Athleten / alle Tage).
 * Änderungen werden nur mehr über die expliziten Speichern-Buttons
 * in der UI ausgelöst.
 */
export async function saveAnmeldung(data: AnmeldungData): Promise<void> {
  await overwriteJsonContent(getFileId(), data);
}
