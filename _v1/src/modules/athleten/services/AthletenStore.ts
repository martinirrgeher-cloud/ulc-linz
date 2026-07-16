// src/modules/athleten/services/AthletenStore.ts
/* Service-Layer für Athleten: kapselt Drive-IDs, Format & Save/Load. */
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { Athlete } from "../types/athleten";

type DriveAthleten = { athletes?: Athlete[]; athleten?: Athlete[] } | Athlete[];

function normalize(raw: DriveAthleten): Athlete[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray((raw as any)?.athletes)) return (raw as any).athletes;
  if (Array.isArray((raw as any)?.athleten)) return (raw as any).athleten;
  return [];
}

export async function loadAthleten(): Promise<Athlete[]> {
  if (!IDS.ATHLETEN_FILE_ID) throw new Error("ATHLETEN_FILE_ID fehlt");
  const raw = await downloadJson<DriveAthleten>(IDS.ATHLETEN_FILE_ID);
  return normalize(raw);
}

export async function saveAthleten(list: Athlete[]): Promise<void> {
  if (!IDS.ATHLETEN_FILE_ID) throw new Error("ATHLETEN_FILE_ID fehlt");
  // Schreibe im Standardformat { athletes: [...] }
  await overwriteJsonContent(IDS.ATHLETEN_FILE_ID, { athletes: list });
}
