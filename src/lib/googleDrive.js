// src/lib/googleDrive.js
import { getAccessToken } from "./googleAuth";

/**
 * Interner Helper: führt einen HTTP-Request gegen die Drive-API
 * und hängt den Bearer-Token automatisch an.
 */
async function driveRequest(url, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Kein Access Token vorhanden");

  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    const msg = detail || res.statusText || `HTTP ${res.status}`;
    throw new Error(`Drive API Fehler ${res.status}: ${msg}`);
  }

  return res;
}

/**
 * Sucht eine Datei per Name in Drive (nur nicht gelöschte).
 * Gibt das erste Match zurück (id, name, mimeType) oder null.
 */
async function findFileByName(filename) {
  const q = encodeURIComponent(`name='${filename}' and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&spaces=drive`;

  const res = await driveRequest(url);
  const json = await res.json();
  const file = Array.isArray(json.files) && json.files.length > 0 ? json.files[0] : null;
  return file;
}

/**
 * Lädt eine JSON-Datei per File-ID.
 */
export async function loadJsonById(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await driveRequest(url);
  return await res.json();
}

/**
 * Speichert JSON (PATCH uploadType=media) per File-ID.
 */
export async function saveJsonById(fileId, data) {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  await driveRequest(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return true;
}

/**
 * Lädt JSON, indem eine Datei per Name gesucht wird.
 * Erwartet, dass die Datei existiert. Wirf einen klaren Fehler, wenn nicht.
 */
export async function loadJsonByName(filename) {
  const file = await findFileByName(filename);
  if (!file) {
    console.warn(`⚠️ Datei '${filename}' nicht gefunden`);
    throw new Error(`Datei '${filename}' nicht gefunden`);
  }
  return await loadJsonById(file.id);
}

/**
 * Speichert JSON unter einem Dateinamen:
 * - existiert die Datei → PATCH (uploadType=media)
 * - existiert sie nicht → multipart POST anlegen
 */
export async function saveJsonByName(filename, data) {
  const existing = await findFileByName(filename);

  if (existing) {
    // Update per PATCH (uploadType=media)
    const url = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
    await driveRequest(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return true;
  }

  // Neu anlegen via multipart
  const token = getAccessToken();
  if (!token) throw new Error("Kein Access Token vorhanden");

  const metadata = {
    name: filename,
    mimeType: "application/json",
  };

  // multipart/form-data Body
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const bodyParts = [
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(data),
    closeDelim,
  ];

  const multipartBody = new Blob(bodyParts, { type: `multipart/related; boundary="${boundary}"` });

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    const msg = detail || res.statusText || `HTTP ${res.status}`;
    throw new Error(`Fehler beim Anlegen der Datei '${filename}': ${msg}`);
  }

  return true;
}
