import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClient";

const FILE_ID = import.meta.env.VITE_DRIVE_KINDERTRAINING_FILE_ID as string;

export async function loadDataForWeek(week: string) {
  const json = await downloadJson(FILE_ID);
  return json?.[week] || {};
}

export async function saveDataForWeek(week: string, data: any) {
  const json = await downloadJson(FILE_ID).catch(() => ({} as any));
  const next = { ...(json || {}), [week]: data };
  await overwriteJsonContent(FILE_ID, next);
}

/** ---- Einstellungen global im selben JSON ---- */
export type KTSettings = {
  activeDays: string[];
  showInactive?: boolean;
  sortOrder?: "vorname" | "nachname";
};

const SETTINGS_KEY = "__settings__";

export async function loadSettings(): Promise<KTSettings | null> {
  try {
    const json = await downloadJson(FILE_ID);
    const obj = json && typeof json === "object" ? json : null;
    const s = obj && (obj as any)[SETTINGS_KEY];
    if (s && typeof s === "object") {
      const activeDays = Array.isArray((s as any).activeDays) ? (s as any).activeDays : [];
      const showInactive = typeof (s as any).showInactive === "boolean" ? (s as any).showInactive : true;
      const sortOrder = ((s as any).sortOrder === "nachname" || (s as any).sortOrder === "vorname")
        ? (s as any).sortOrder
        : undefined;
      return { activeDays, showInactive, sortOrder };
    }
  } catch {}
  return null;
}

export async function saveSettings(next: KTSettings): Promise<void> {
  const json = await downloadJson(FILE_ID).catch(() => ({} as any));
  const merged = { ...(json || {}), [SETTINGS_KEY]: next };
  await overwriteJsonContent(FILE_ID, merged);
}
