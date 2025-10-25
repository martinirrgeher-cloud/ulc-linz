import { getAccessToken, silentRefreshIfNeeded, clearStorage } from "@/lib/googleAuth";

/**
 * Führt einen Google Drive API Request mit Tokenprüfung und automatischem Logout bei Fehlern aus.
 */
export async function driveFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Token ggf. still verlängern
  const refreshed = await silentRefreshIfNeeded();
  if (!refreshed) {
    clearStorage();
    window.location.href = "/login1";
    throw new Error("Token ungültig");
  }

  // Token aus Storage holen
  const token = getAccessToken();
  if (!token) {
    window.location.href = "/login1";
    throw new Error("Kein Token vorhanden");
  }

  // Request ausführen
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  // Token ist abgelaufen oder nicht mehr gültig → Logout erzwingen
  if (res.status === 401) {
    clearStorage();
    window.location.href = "/login1";
  }

  return res;
}

/**
 * Lädt eine JSON-Datei direkt von Google Drive (per File-ID).
 * Nutzt automatisch das Tokenhandling von driveFetch.
 */
export async function downloadJson(fileId: string): Promise<any> {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  if (!res.ok) {
    throw new Error(`Fehler beim Laden der Datei ${fileId}`);
  }
  return res.json();
}

/**
 * Überschreibt den Inhalt einer bestehenden JSON-Datei auf Google Drive.
 * Die Datei muss dem authentifizierten User gehören oder für die App freigegeben sein.
 */
export async function overwriteJsonContent(fileId: string, data: any): Promise<void> {
  const boundary = "xxxxxxxxxx";
  const metadata = { name: fileId };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    JSON.stringify(data) + `\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Fehler beim Überschreiben der Datei ${fileId}: ${txt}`);
  }
}
/**
 * Schreibt JSON-Inhalt in eine bestehende Drive-Datei.
 * Thin-Wrapper um overwriteJsonContent für Kompatibilität mit neuen Modulen.
 */
export async function uploadJson(fileId: string, data: any): Promise<void> {
  await overwriteJsonContent(fileId, data);
}

