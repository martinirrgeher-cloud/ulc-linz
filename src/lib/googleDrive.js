// src/lib/googleDrive.js
import { getAccessToken } from "./googleAuth";

const API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

const DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

async function requireToken() {
  const token = getAccessToken();
  if (!token) throw new Error("Kein Access Token vorhanden");
  return token;
}

async function findFileIdByName(name) {
  const token = await requireToken();
  const resp = await fetch(
    `${API_BASE}/files?q='${DRIVE_FOLDER_ID}' in parents and name='${name}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Drive-Suche fehlgeschlagen (${resp.status})`);
  const data = await resp.json();
  return data.files?.[0]?.id || null;
}

export async function loadJsonByName(name) {
  const token = await requireToken();
  const fileId = await findFileIdByName(name);
  if (!fileId) return null;

  const fileResp = await fetch(`${API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!fileResp.ok) throw new Error(`Drive-Load fehlgeschlagen (${fileResp.status})`);
  return await fileResp.json();
}

export async function saveJsonByName(name, obj) {
  const token = await requireToken();
  const body = JSON.stringify(obj, null, 2);
  const fileId = await findFileIdByName(name);

  if (fileId) {
    // Update (PATCH / media)
    const patch = await fetch(`${UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body
    });
    if (!patch.ok) throw new Error(`Drive-Update fehlgeschlagen (${patch.status})`);
    return { created: false, id: fileId };
  }

  // Create (multipart)
  const metadata = {
    name,
    mimeType: "application/json",
    parents: [DRIVE_FOLDER_ID]
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([body], { type: "application/json" }));

  const create = await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if (!create.ok) throw new Error(`Drive-Erstellen fehlgeschlagen (${create.status})`);
  const created = await create.json();
  return { created: true, id: created.id };
}
// -------------------------------------------------------------
// 📦 Modul-Datenverwaltung (automatische JSON-Dateitrennung)
// -------------------------------------------------------------

export async function loadModuleData(moduleName) {
  const file = `${moduleName.toLowerCase().replace("ü", "ue")}_data.json`;
  console.log(`☁️ Lade Daten für Modul: ${moduleName} (${file})`);
  return await loadJsonByName(file);
}

export async function saveModuleData(moduleName, data) {
  const file = `${moduleName.toLowerCase().replace("ü", "ue")}_data.json`;
  console.log(`💾 Speichere Daten für Modul: ${moduleName} (${file})`);
  return await saveJsonByName(file, data);
}

