import { getAccessToken } from "../googleAuth";

/**
 * ------------------------------------------------------------
 *  Basisfunktionen (bestehend)
 * ------------------------------------------------------------
 */

export async function downloadJson(fileId: string) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`);
  return await res.json();
}

export async function uploadJson(fileId: string, content: any) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(content),
  });
  if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`);
  return await res.json();
}

export async function overwriteJsonContent(fileId: string, content: any) {
  return await uploadJson(fileId, content);
}

export async function createFile(fileName: string, content: any) {
  const token = await getAccessToken();
  const metadata = {
    name: fileName,
    mimeType: "application/json",
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(content)], { type: "application/json" }));

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Create File fehlgeschlagen: ${res.status}`);
  return await res.json();
}

export async function saveFile(fileId: string, content: string) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: content,
  });
  if (!res.ok) throw new Error(`Save File fehlgeschlagen: ${res.status}`);
  return await res.json();
}

export async function downloadFile(fileId: string) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download File fehlgeschlagen: ${res.status}`);
  return await res.blob();
}

export async function uploadFile(file: File) {
  const token = await getAccessToken();
  const metadata = {
    name: file.name,
    mimeType: file.type,
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload File fehlgeschlagen: ${res.status}`);
  return await res.json();
}

export async function deleteFile(fileId: string) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete File fehlgeschlagen: ${res.status}`);
  return true;
}

export async function getFileName(fileId: string) {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Get Filename fehlgeschlagen: ${res.status}`);
  const json = await res.json();
  return json.name as string;
}

/**
 * ------------------------------------------------------------
 *  Ergänzungen für Trainingsplan
 * ------------------------------------------------------------
 */

export async function findFileInFolderByName(
  folderId: string,
  name: string
): Promise<{ id: string; name: string; mimeType: string } | null> {
  const token = await getAccessToken();
  const q = [
    `name='${name.replace(/'/g, "\'")}'`,
    `'${folderId}' in parents`,
    "trashed=false",
  ].join(" and ");

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name,mimeType)");
  url.searchParams.set("pageSize", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("findFileInFolderByName fehlgeschlagen:", err);
    throw new Error(`findFileInFolderByName: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data.files) && data.files.length > 0 ? data.files[0] : null;
}

export async function createJsonInFolder(folderId: string, fileName: string, content: any) {
  const token = await getAccessToken();
  const metadata = {
    name: fileName,
    mimeType: "application/json",
    parents: [folderId],
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(content)], { type: "application/json" }));

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("createJsonInFolder fehlgeschlagen:", errText);
    throw new Error(`createJsonInFolder: ${res.status}`);
  }

  return res.json();
}

export async function updateJson(fileId: string, content: any, newName?: string) {
  const token = await getAccessToken();

  if (newName) {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });
    if (!metaRes.ok) {
      const err = await metaRes.text();
      console.error("Dateiname-Update fehlgeschlagen:", err);
      throw new Error(`updateJson (rename): ${metaRes.status}`);
    }
  }

  return await overwriteJsonContent(fileId, content);
}

/**
 * ------------------------------------------------------------
 *  Default-Export (für Trainingsplan)
 * ------------------------------------------------------------
 */
export default class DriveClient {
  async downloadJson(fileId: string) { return downloadJson(fileId); }
  async uploadJson(fileId: string, content: any) { return uploadJson(fileId, content); }
  async overwriteJsonContent(fileId: string, content: any) { return overwriteJsonContent(fileId, content); }

  async createFile(fileName: string, content: any) { return createFile(fileName, content); }
  async saveFile(fileId: string, content: string) { return saveFile(fileId, content); }
  async downloadFile(fileId: string) { return downloadFile(fileId); }
  async uploadFile(file: File) { return uploadFile(file); }
  async deleteFile(fileId: string) { return deleteFile(fileId); }
  async getFileName(fileId: string) { return getFileName(fileId); }

  async findFileInFolderByName(folderId: string, name: string) { return findFileInFolderByName(folderId, name); }
  async createJsonInFolder(folderId: string, fileName: string, content: any) { return createJsonInFolder(folderId, fileName, content); }
  async updateJson(fileId: string, content: any, newName?: string) { return updateJson(fileId, content, newName); }
}
