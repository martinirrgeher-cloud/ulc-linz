import { getAccessToken } from "../googleAuth";

/**
 * Lädt eine JSON-Datei von Google Drive herunter.
 */
export async function downloadJson(fileId: string) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) throw new Error("Download fehlgeschlagen");
  return response.json();
}

/**
 * Überschreibt eine bestehende JSON-Datei auf Google Drive.
 */
export async function uploadJson(fileId: string, content: any) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(content),
    }
  );
  if (!response.ok) throw new Error("Upload fehlgeschlagen");
  return response.json();
}

/**
 * Erstellt eine neue Datei auf Google Drive.
 */
export async function createFile(fileName: string, content: any) {
  const token = await getAccessToken();
  const metadata = {
    name: fileName,
    mimeType: "application/json",
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append(
    "file",
    new Blob([JSON.stringify(content)], { type: "application/json" })
  );

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Fehler bei createFile:", err);
    throw new Error("Fehler beim Erstellen der Datei");
  }

  return res.json();
}

/**
 * Lädt eine bestehende Datei (Text / JSON) herunter.
 */
export async function downloadFile(fileId: string) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) throw new Error("Download fehlgeschlagen");
  return response.text();
}

/**
 * Aktualisiert eine bestehende Datei auf Google Drive mit neuem Inhalt.
 */
export async function saveFile(fileId: string, content: string) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: content,
    }
  );
  if (!response.ok) throw new Error("Upload fehlgeschlagen");
  return response.text();
}

/**
 * 📤 Upload einer Datei (z.B. JPG, PNG oder MP4) in den konfigurierten Media-Ordner.
 * Gibt eine öffentliche URL zurück.
 */
export async function uploadFile(file: File) {
  const token = await getAccessToken();
  if (!token) throw new Error("Kein Token gefunden");

  const folderId = import.meta.env.VITE_DRIVE_MEDIA_FOLDER_ID;
  if (!folderId) throw new Error("Media Folder ID fehlt");

  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", file);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Upload fehlgeschlagen:", errText);
    throw new Error(`Upload fehlgeschlagen: ${res.status}`);
  }

  const data = await res.json();

  // 🔓 Datei öffentlich freigeben
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${data.id}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    }
  );

  if (!permRes.ok) {
    const err = await permRes.text();
    console.warn("⚠️ Freigabe fehlgeschlagen:", err);
  }

  return {
    id: data.id,
    url: `https://drive.google.com/uc?id=${data.id}`,
    type: file.type.startsWith("video") ? "video" : "image",
    name: file.name,
  };
}

/**
 * Holt den Dateinamen einer Datei über die Google Drive API.
 */
export async function getFileName(fileId: string): Promise<string | null> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    console.warn("Konnte Dateinamen nicht abrufen");
    return null;
  }

  const data = await res.json();
  return data.name;
}

/**
 * Löscht eine Datei auf Google Drive anhand der ID.
 */
export async function deleteFile(fileId: string) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Fehler beim Löschen:", err);
    throw new Error("Löschen fehlgeschlagen");
  }
  return true;
}

/**
 * ✍️ Überschreibt den Inhalt einer bestehenden JSON-Datei vollständig.
 * Wird z. B. vom Kindertraining-Modul verwendet.
 */
export async function overwriteJsonContent(fileId: string, content: any) {
  const token = await getAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(content),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ Fehler beim Überschreiben:", errText);
    throw new Error(`Fehler beim Überschreiben: ${response.status}`);
  }

  return response.json();
}
