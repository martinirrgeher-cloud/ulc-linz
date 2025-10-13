// src/lib/googleDrive.js
import { getAccessToken } from "./googleAuth";

const USERS_FILE_ID = import.meta.env.VITE_USERS_FILE_ID; // optional, empfohlen

async function driveRequest(url, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Kein Access Token vorhanden");
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive API Fehler ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

/**
 * JSON-Datei per ID laden
 */
export async function loadJsonById(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await driveRequest(url);
  return await res.json();
}

/**
 * JSON-Datei per Dateiname laden
 */
export async function loadJsonByName(filename) {
  if (USERS_FILE_ID && filename === "users.json") {
    try {
      return await loadJsonById(USERS_FILE_ID);
    } catch (e) {
      console.warn(`Laden per ID fehlgeschlagen (${USERS_FILE_ID}) → Fallback Name`, e);
    }
  }

  const q = encodeURIComponent(`name='${filename}' and trashed=false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
  const listRes = await driveRequest(listUrl);
  const listJson = await listRes.json();

  if (!listJson.files || listJson.files.length === 0) {
    console.warn(`⚠️ Datei '${filename}' nicht gefunden`);
    throw new Error(`Datei '${filename}' nicht gefunden`);
  }
  return await loadJsonById(listJson.files[0].id);
}

/**
 * JSON-Datei per Dateiname speichern (neu oder überschreiben)
 */
export async function saveJsonByName(filename, data) {
  const token = getAccessToken();
  if (!token) throw new Error("Kein Access Token vorhanden");

  // Prüfen, ob Datei bereits existiert
  const q = encodeURIComponent(`name='${filename}' and trashed=false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listJson = await listRes.json();

  let fileId = null;
  if (listJson.files && listJson.files.length > 0) {
    fileId = listJson.files[0].id;
  }

  const fileContent = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  if (fileId) {
    // ✅ Bestehende Datei überschreiben
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const res = await fetch(uploadUrl, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: fileContent,
    });
    if (!res.ok) throw new Error(`Fehler beim Speichern der Datei '${filename}'`);
  } else {
    // 🆕 Neue Datei anlegen
    const metadata = { name: filename, mimeType: "application/json" };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", fileContent);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );
    if (!res.ok) throw new Error(`Fehler beim Anlegen der Datei '${filename}'`);
  }
}
