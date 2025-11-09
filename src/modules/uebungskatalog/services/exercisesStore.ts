// src/modules/uebungskatalog/services/exercisesStore.ts
import { downloadJson } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { Exercise } from "../types/exercise";

/** Drive-ID für die Übungsdatei aus IDS oder .env */
function getExercisesFileId(): string {
  const anyIDS = IDS as any;
  const id =
    anyIDS.UEBUNGEN_FILE_ID ||
    anyIDS.EXERCISES_FILE_ID ||
    import.meta.env.VITE_DRIVE_UEBUNGEN_FILE_ID ||
    import.meta.env.VITE_DRIVE_EXERCISES_FILE_ID;
  if (!id) throw new Error("UEBUNGEN/EXERCISES_FILE_ID fehlt (IDS/ENV).");
  return String(id);
}

/** Vereinheitlicht alte/neue Exercise-Objekte */
function mapExercise(raw: any): Exercise {
  // Medien-Kompatibilität: erlaubte Felder: url|fileId, type|mimeType
  const media = Array.isArray(raw.media) ? raw.media.map((m: any) => {
    const url = m.url ?? m.fileId ?? "";
    const mime = m.mimeType ?? "";
    // type ableiten
    let type = m.type;
    if (!type && typeof mime === "string") {
      type = mime.startsWith("video/") ? "video" : "image";
    }
    return { ...m, url, type };
  }) : [];

  return {
    id: String(raw.id ?? crypto.randomUUID()),
    name: String(raw.name ?? raw.titel ?? ""),
    hauptgruppe: raw.hauptgruppe ?? raw.mainGroup ?? "",
    untergruppe: raw.untergruppe ?? raw.subGroup ?? "",
    active: raw.active !== false,
    difficulty: typeof raw.difficulty === "number"
      ? raw.difficulty
      : (typeof raw.stars === "number" ? raw.stars : undefined),
    menge: typeof raw.menge === "number" ? raw.menge
      : (typeof raw.amount === "number" ? raw.amount : undefined),
    einheit: raw.einheit ?? raw.unit ?? "",
    // 'info' wird in Uebungskatalog.tsx für die Suche verwendet
    info: raw.info ?? raw.beschreibung ?? raw.description ?? "",
    media,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  } as Exercise;
}

/** Lädt Übungen – unterstützt neues Schema {items:[]} und Legacy (Array oder {exercises:[]}) */
export async function loadExercises(): Promise<Exercise[]> {
  const fileId = getExercisesFileId();
  const raw = await downloadJson<any>(fileId).catch(() => null);
  if (!raw) return [];

  const data = (raw as any)?.data ?? raw;

  if (data && typeof data === "object" && Array.isArray((data as any).items)) {
    return (data as any).items.map(mapExercise);
  }
  if (data && typeof data === "object" && Array.isArray((data as any).exercises)) {
    return (data as any).exercises.map(mapExercise);
  }
  if (Array.isArray(data)) {
    return data.map(mapExercise);
  }
  return [];
}
