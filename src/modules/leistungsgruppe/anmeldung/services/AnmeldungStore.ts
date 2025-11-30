// src/modules/leistungsgruppe/anmeldung/services/AnmeldungStore.ts
import { downloadJson, overwriteJsonContent, patchJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

export type DayStatus = "YES" | "NO" | "MAYBE" | null;

export interface AnmeldungData {
  statuses: Record<string, DayStatus>;
  notes: Record<string, string>;
}

export interface AnmeldungDelta {
  /**
   * Nur die geänderten Status-Werte.
   * Key: `${athleteId}:${isoDate}`.
   * Wert: Neuer Status oder null zum Löschen.
   */
  statuses?: Record<string, DayStatus | null>;
  /**
   * Nur die geänderten Notizen.
   * Key: `${athleteId}:${isoDate}`.
   * Wert: Neue Notiz (trimmed) oder null/"" zum Löschen.
   */
  notes?: Record<string, string | null>;
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
 * Vollständiges Speichern des Datensatzes.
 * Wird vom Anmeldungs-Hook beim manuellen Speichern verwendet.
 */
export async function saveAnmeldung(data: AnmeldungData): Promise<void> {
  await overwriteJsonContent(getFileId(), data);
}

/**
 * Delta-Speichern bleibt für eventuelle andere Aufrufer erhalten.
 * Aktuell wird es vom Anmeldungs-Hook nicht verwendet.
 */
export async function saveAnmeldungDelta(delta: AnmeldungDelta): Promise<void> {
  const fileId = getFileId();

  await patchJsonContent(fileId, (prev: any) => {
    const base = prev && typeof prev === "object" ? prev : {};
    const prevStatuses: Record<string, DayStatus> =
      base.statuses && typeof base.statuses === "object" ? { ...base.statuses } : {};
    const prevNotes: Record<string, string> =
      base.notes && typeof base.notes === "object" ? { ...base.notes } : {};

    if (delta.statuses) {
      for (const [key, value] of Object.entries(delta.statuses)) {
        if (value == null) {
          delete prevStatuses[key];
        } else {
          prevStatuses[key] = value;
        }
      }
    }

    if (delta.notes) {
      for (const [key, value] of Object.entries(delta.notes)) {
        if (value == null || value === "") {
          delete prevNotes[key];
        } else {
          prevNotes[key] = value;
        }
      }
    }

    return {
      ...base,
      statuses: prevStatuses,
      notes: prevNotes,
    };
  });
}
