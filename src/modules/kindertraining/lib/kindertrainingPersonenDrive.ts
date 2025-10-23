import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClient";

const PERSONEN_FILE_ID = import.meta.env.VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID as string;

export interface KTPerson {
  name: string;
  inactive?: boolean;
  notPaid?: boolean;                       // 💰 steuert das €-Symbol
  note?: string;                           // ✏️ Notiz im Popup
  attendance?: Record<string, boolean>;    // Teilnahme je ISO-Tag
  paid?: boolean;                          // optional (Kompatibilität)
};

function stripWrongFields(raw: any): KTPerson[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any) => ({
    name: typeof p?.name === "string" ? p.name : "",
    paid: !!p?.paid,
    inactive: !!p?.inactive,
    generalNote: typeof p?.generalNote === "string" ? p.generalNote : "",
  }));
}

export async function loadPersonen(): Promise<KTPerson[]> {
  const data = await downloadJson(PERSONEN_FILE_ID).catch(() => []);
  return stripWrongFields(data);
}

export async function savePersonen(personen: KTPerson[]): Promise<void> {
  try {
    const clean = stripWrongFields(personen);
    await overwriteJsonContent(PERSONEN_FILE_ID, clean);
    console.log("✅ Personen gespeichert:", clean);
  } catch (err) {
    console.error("❌ Fehler beim Speichern der Personen:", err);
    alert("Speichern der Personen fehlgeschlagen. Bitte Google-Login prüfen.");
    throw err;
  }
}
