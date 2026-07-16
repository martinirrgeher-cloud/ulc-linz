import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

export type BlockGroup = {
  id: string;
  name: string;
  order: number;
};

export type BlockGroupsData = {
  version: number;
  updatedAt: string;
  groups: BlockGroup[];
};

const fileId = () =>
  IDS.TRAININGSBLOECKE_GROUPS_FILE_ID ||
  import.meta.env.VITE_DRIVE_TRAININGSBLOECKE_GROUPS_FILE_ID;

function createDefault(): BlockGroupsData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    groups: [
      {
        id: "grp-allgemein",
        name: "Allgemein",
        order: 0,
      },
    ],
  };
}

export async function loadBlockGroups(): Promise<BlockGroupsData> {
  try {
    const data = await downloadJson<BlockGroupsData | null>(fileId());
    if (!data || !Array.isArray((data as any).groups)) {
      return createDefault();
    }

    const normalized: BlockGroup[] = (data.groups ?? []).map((g: any, idx: number) => ({
      id: String(g.id ?? `grp-${idx}`),
      name: (g.name ?? "").trim() || "Allgemein",
      order:
        typeof g.order === "number" && Number.isFinite(g.order)
          ? g.order
          : idx,
    }));

    normalized.sort((a, b) => a.order - b.order);

    return {
      version: data.version ?? 1,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      groups: normalized,
    };
  } catch (err) {
    console.error("Trainingsblock-Gruppen: downloadJson fehlgeschlagen", err);
    return createDefault();
  }
}

async function saveBlockGroups(data: BlockGroupsData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await overwriteJsonContent(fileId(), data);
}

export async function ensureBlockGroupExists(
  name: string
): Promise<BlockGroupsData> {
  const trimmed = name.trim() || "Allgemein";
  let data = await loadBlockGroups();
  const exists = data.groups.find(
    (g) => g.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) {
    return data;
  }
  const maxOrder =
    data.groups.length > 0
      ? Math.max(...data.groups.map((g) => g.order ?? 0))
      : -1;
  const newGroup: BlockGroup = {
    id: `grp-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: trimmed,
    order: maxOrder + 1,
  };
  data.groups = [...data.groups, newGroup];
  await saveBlockGroups(data);
  return data;
}

export async function saveBlockGroupsData(
  data: BlockGroupsData
): Promise<BlockGroupsData> {
  await saveBlockGroups(data);
  return data;
}
