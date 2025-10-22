// src/lib/drive/DriveClient.ts
import { getAccessToken as getToken } from "@/lib/googleAuth";
import { requireEnv } from "@/lib/requireEnv";

const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

// Prüfe beim Laden ob ENV grundsätzlich vorhanden sind
requireEnv("VITE_DRIVE_KINDERTRAINING_FILE_ID");
requireEnv("VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID");

/**
 * Header mit Google OAuth Token erstellen
 */
async function authHeader(): Promise<HeadersInit> {
  const token = getToken();
  if (!token) throw new Error("Kein Google-Token (Login 1 erforderlich).");
  return { Authorization: `Bearer ${token}` };
}

/**
 * JSON-Datei von Google Drive herunterladen
 */
export async function downloadJson(fileId: string): Promise<any> {
  const hdr = await authHeader();
  const res = await fetch(
    `${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { ...hdr } }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`downloadJson fehlgeschlagen (${res.status}): ${t}`);
  }

  return res.json();
}

/**
 * JSON-Inhalt einer bestehenden Datei auf Google Drive überschreiben
 * ⚠️ Beibehaltung des bestehenden Dateinamens (kein erzwungenes "data.json")
 */
export async function overwriteJsonContent(fileId: string, data: any): Promise<void> {
  const hdr = await authHeader();

  // Nur Inhalt aktualisieren, nicht den Namen
  const metadata = {}; // 👈 hier wird nichts überschrieben

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append(
    "file",
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  );

  const res = await fetch(
    `${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}?uploadType=multipart`,
    {
      method: "PATCH",
      headers: hdr,
      body: form
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`overwriteJsonContent fehlgeschlagen (${res.status}): ${t}`);
  }
}

/**
 * Neue JSON-Datei auf Google Drive anlegen
 * (optional — falls du irgendwann eine neue Datei erstellen willst)
 */
export async function createJsonFile(name: string, data: any, parentFolderId?: string): Promise<string> {
  const hdr = await authHeader();

  const metadata: any = {
    name,
    mimeType: "application/json",
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append(
    "file",
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  );

  const res = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
    method: "POST",
    headers: hdr,
    body: form,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`createJsonFile fehlgeschlagen (${res.status}): ${t}`);
  }

  const json = await res.json();
  return json.id;
}
