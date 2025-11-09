// src/modules/uebungskatalog/services/UebungsgruppenStore.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

export type GruppenMap = Record<string, string[]>;

export async function loadUebungsgruppen(): Promise<GruppenMap> {
  if (!IDS.UEBUNGSGRUPPEN_FILE_ID) throw new Error("UEBUNGSGRUPPEN_FILE_ID fehlt");
  const raw = await downloadJson<any>(IDS.UEBUNGSGRUPPEN_FILE_ID);
  const groups: GruppenMap = raw?.hauptgruppen ?? (raw ?? {});
  return groups || {};
}

export async function saveUebungsgruppen(next: GruppenMap): Promise<void> {
  if (!IDS.UEBUNGSGRUPPEN_FILE_ID) throw new Error("UEBUNGSGRUPPEN_FILE_ID fehlt");
  const sorted: GruppenMap = Object.fromEntries(
    Object.entries(next).map(([h, arr]) => [h, (arr || []).slice().sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"}))])
  );
  await overwriteJsonContent(IDS.UEBUNGSGRUPPEN_FILE_ID, { hauptgruppen: sorted });
}