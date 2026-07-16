// src/modules/uebungskatalog/services/categoriesStore.ts
import { downloadJson } from "@/lib/drive/DriveClientCore";

/** Struktur der Gruppen-Datei */
type GroupsJson = { hauptgruppen?: Record<string, string[]> } | null | undefined;

/** Lädt komplette Kategorienstruktur (für Uebungskatalog.tsx wird loadKategorien erwartet) */
export async function loadKategorien(): Promise<{ hauptgruppen: Record<string, string[]> }> {
  const id = import.meta.env.VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID;
  if (!id) throw new Error("VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID fehlt.");
  const raw = await downloadJson<GroupsJson>(String(id)).catch(() => null);
  const map = (raw && typeof raw === "object" && raw.hauptgruppen) ? raw.hauptgruppen : {};
  return { hauptgruppen: map };
}
