import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";

type GruppenMap = { hauptgruppen: Record<string, string[]> };

function getGroupsFileId(): string | undefined {
  return import.meta.env.VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID;
}

async function loadMap(): Promise<GruppenMap> {
  const id = getGroupsFileId();
  if (!id) return { hauptgruppen: {} };
  try {
    const json = await downloadJson<any>(id);
    const map: GruppenMap = { hauptgruppen: {} };
    if (json && typeof json === "object" && json.hauptgruppen && typeof json.hauptgruppen === "object") {
      for (const [hg, arr] of Object.entries(json.hauptgruppen)) {
        map.hauptgruppen[hg] = Array.isArray(arr) ? (arr as string[]) : [];
      }
    }
    return map;
  } catch {
    return { hauptgruppen: {} };
  }
}

export async function loadHauptgruppen(): Promise<string[]> {
  const map = await loadMap();
  return Object.keys(map.hauptgruppen);
}

export async function loadUntergruppen(haupt?: string): Promise<string[]> {
  const map = await loadMap();
  if (!haupt) {
    const all = new Set<string>();
    for (const arr of Object.values(map.hauptgruppen)) {
      for (const u of arr) all.add(u);
    }
    return Array.from(all);
  }
  return map.hauptgruppen[haupt] || [];
}

export async function addHauptgruppe(name: string): Promise<void> {
  const id = getGroupsFileId();
  if (!id) throw new Error("VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID fehlt.");
  const map = await loadMap();
  if (!map.hauptgruppen[name]) {
    map.hauptgruppen[name] = [];
    await overwriteJsonContent(id, map as any);
  }
}

export async function addUntergruppe(name: string, haupt?: string): Promise<void> {
  const id = getGroupsFileId();
  if (!id) throw new Error("VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID fehlt.");
  if (!haupt) throw new Error("Hauptgruppe erforderlich, um Untergruppe anzulegen.");
  const map = await loadMap();
  const arr = map.hauptgruppen[haupt] || [];
  if (!arr.includes(name)) arr.push(name);
  map.hauptgruppen[haupt] = arr;
  await overwriteJsonContent(id, map as any);
}
