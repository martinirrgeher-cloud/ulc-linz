export async function readJsonFromDrive<T>(fileId: string, token: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Fehler beim Laden der Datei.");
  return await res.json() as T;
}

export async function writeJsonToDrive<T>(fileId: string, token: string, data: T): Promise<boolean> {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Fehler beim Speichern der Datei.");
  return true;
}
