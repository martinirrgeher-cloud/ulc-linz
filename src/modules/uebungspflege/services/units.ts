import { downloadJson } from "@/lib/drive/DriveClientCore";

function getUnitsFileId(): string | undefined {
  return import.meta.env.VITE_DRIVE_EINHEITEN_FILE_ID || import.meta.env.VITE_DRIVE_UNITS_FILE_ID;
}

export async function loadEinheiten(): Promise<string[]> {
  const id = getUnitsFileId();
  if (!id) return ["WH","sec","min","m","kg"];
  try {
    const json = await downloadJson<any>(id);
    if (Array.isArray(json?.items)) return json.items.map((x:any) => x.name ?? x);
    if (Array.isArray(json)) return json.map((x:any) => x.name ?? x);
    if (Array.isArray(json?.einheiten)) return json.einheiten.map((x:any) => x.name ?? x);
  } catch {}
  return ["WH","sec","min","m","kg"];
}
