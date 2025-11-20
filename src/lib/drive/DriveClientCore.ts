
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DriveClientCore.ts — Google Drive helper utilities
 *
 * - Keine harten Abhängigkeiten zu AuthContext mehr.
 * - Pluggable Access-Token: per `setAccessTokenProvider(() => Promise<string>)` registrieren.
 * - Rückwärtskompatibles `downloadJson` (liefert NUR JSON).
 * - Zusätzlich `downloadJsonWithMeta` (liefert { data, modifiedTime, version }).
 * - Bewahrt/ergänzt gängige Helpers (overwriteJsonContent, uploadFile, deleteFile, list, metadata, rename, parents, patch).
 */

type JsonRecord = Record<string, any>;

const DRIVE_V3 = "https://www.googleapis.com/drive/v3";
const UPLOAD_V3 = "https://www.googleapis.com/upload/drive/v3";

/** Extern registrierbarer Token-Resolver */
let tokenResolver: null | (() => Promise<string | undefined>) = null;

/** Von außen setzen, z. B. im AuthContext nach Login. */
export function setAccessTokenProvider(fn: () => Promise<string | undefined> | string | undefined) {
  if (typeof fn === "function") {
    tokenResolver = async () => {
      const v = typeof fn === "function" ? await Promise.resolve(fn()) : fn;
      return v ?? undefined;
    };
  } else {
    tokenResolver = async () => (fn as any) ?? undefined;
  }
}

/** interner AccessToken-Getter mit Fallbacks */
async function getAccessToken(): Promise<string> {
  // 1) bevorzugt: registrierter Provider
  if (tokenResolver) {
    const t = await tokenResolver();
    if (t) return t;
  }
  // 2) mögliche Fallbacks – passe bei Bedarf Keys an dein Projekt an
  const win = globalThis as any;
  const guess =
    win?.__GOOGLE_ACCESS_TOKEN__ ||
    win?.__ACCESS_TOKEN__ ||
    (typeof localStorage !== "undefined" && (
      localStorage.getItem("google_access_token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("gis_token")
    ));
  if (guess) return String(guess);
  throw new Error("DriveClient: Kein Access Token verfügbar. Registriere einen Provider mit setAccessTokenProvider(fn).");
}

/** Erzeugt die Auth-Header mit Bearer Token. */
async function authHeaders(extra: Record<string, string> = {}) {
  const token = await getAccessToken();
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  };
}

/** Prüft HTTP-Response und wirft verständlichen Fehler. */
async function assertOk(res: Response, context: string) {
  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`${context} fehlgeschlagen: ${res.status} ${res.statusText}${body ? " — " + body : ""}`);
  }
}

/** Shortcut/targetId auflösen, falls fileId auf einen Shortcut zeigt. */
export async function resolveShortcutOrId(fileId: string): Promise<string> {
  if (!fileId) throw new Error("resolveShortcutOrId: fileId fehlt");
  const res = await fetch(
    `${DRIVE_V3}/files/${encodeURIComponent(fileId)}?fields=id,mimeType,shortcutDetails`,
    { headers: await authHeaders() }
  );
  await assertOk(res, "resolveShortcutOrId(meta)");
  const meta = await res.json();
  if (meta?.mimeType === "application/vnd.google-apps.shortcut" && meta?.shortcutDetails?.targetId) {
    return meta.shortcutDetails.targetId as string;
  }
  return fileId;
}

/** Datei-Metadaten lesen (Felder frei wählbar). */
export async function getFileMetadata<T = any>(fileId: string, fields: string): Promise<T> {
  const realId = await resolveShortcutOrId(fileId);
  const res = await fetch(
    `${DRIVE_V3}/files/${encodeURIComponent(realId)}?fields=${encodeURIComponent(fields)}`,
    { headers: await authHeaders() }
  );
  await assertOk(res, "getFileMetadata");
  return res.json() as Promise<T>;
}

/** JSON-Datei lesen – liefert NUR das JSON (rückwärtskompatibel) */
export async function downloadJson<T = any>(fileId: string): Promise<T> {
  if (!fileId) throw new Error("downloadJson: fileId fehlt");
  const realId = await resolveShortcutOrId(fileId);

  const metaReq = fetch(
    `${DRIVE_V3}/files/${encodeURIComponent(realId)}?fields=modifiedTime,version`,
    { headers: await authHeaders() }
  );
  const dataReq = fetch(
    `${DRIVE_V3}/files/${encodeURIComponent(realId)}?alt=media`,
    { headers: await authHeaders() }
  );

  const [metaRes, dataRes] = await Promise.all([metaReq, dataReq]);
  await assertOk(metaRes, "downloadJson(meta)");
  await assertOk(dataRes, "downloadJson(data)");

  const json = await dataRes.json();
  return json as T;
}

/** JSON-Datei lesen – JSON + Meta (neue Variante, eigener Name) */
export async function downloadJsonWithMeta<T = any>(fileId: string): Promise<{ data: T; modifiedTime?: string; version?: string }> {
  if (!fileId) throw new Error("downloadJsonWithMeta: fileId fehlt");
  const realId = await resolveShortcutOrId(fileId);

  const metaReq = fetch(
    `${DRIVE_V3}/files/${encodeURIComponent(realId)}?fields=modifiedTime,version`,
    { headers: await authHeaders() }
  );
  const dataReq = fetch(
    `${DRIVE_V3}/files/${encodeURIComponent(realId)}?alt=media`,
    { headers: await authHeaders() }
  );

  const [metaRes, dataRes] = await Promise.all([metaReq, dataReq]);
  await assertOk(metaRes, "downloadJsonWithMeta(meta)");
  await assertOk(dataRes, "downloadJsonWithMeta(data)");

  const meta = await metaRes.json().catch(() => ({} as any));
  const data = await dataRes.json();
  return { data: data as T, modifiedTime: meta?.modifiedTime, version: meta?.version };
}

/** JSON-Inhalt (komplett) überschreiben. */
export async function overwriteJsonContent(fileId: string, json: JsonRecord | any[]): Promise<void> {
  if (!fileId) throw new Error("overwriteJsonContent: fileId fehlt");
  const realId = await resolveShortcutOrId(fileId);

  const res = await fetch(
    `${UPLOAD_V3}/files/${encodeURIComponent(realId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: await authHeaders({ "Content-Type": "application/json; charset=UTF-8" }),
      body: JSON.stringify(json),
    }
  );
  await assertOk(res, "overwriteJsonContent");
}

/** Datei in Drive hochladen (multipart). */
export async function uploadFile(params: {
  blob: Blob;
  name: string;
  mimeType: string;
  parentFolderId?: string;
}): Promise<{ fileId: string; webViewLink?: string; thumbnailLink?: string; name?: string; mimeType?: string }> {
  const { blob, name, mimeType, parentFolderId } = params;
  if (!blob) throw new Error("uploadFile: blob fehlt");
  if (!name) throw new Error("uploadFile: name fehlt");
  if (!mimeType) throw new Error("uploadFile: mimeType fehlt");

  const metadata: any = { name, mimeType };
  if (parentFolderId) metadata.parents = [parentFolderId];

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadataPart = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
  ], { type: "text/plain" });

  const filePartHeader = new Blob(['\r\nContent-Type: ' + mimeType + '\r\n\r\n'], { type: "text/plain" });
  const closePart = new Blob([closeDelim], { type: "text/plain" });

  const multipartBody = new Blob([metadataPart, filePartHeader, blob, closePart], {
    type: "multipart/related; boundary=" + boundary,
  });

  const res = await fetch(
    `${UPLOAD_V3}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,thumbnailLink`,
    {
      method: "POST",
      headers: await authHeaders({ "Content-Type": `multipart/related; boundary=${boundary}` }),
      body: multipartBody,
    }
  );
  await assertOk(res, "uploadFile");
  const data = await res.json();
  return {
    fileId: data?.id,
    webViewLink: data?.webViewLink,
    thumbnailLink: data?.thumbnailLink,
    name: data?.name,
    mimeType: data?.mimeType,
  };
}

/** Datei löschen. */
export async function deleteFile(fileId: string): Promise<void> {
  if (!fileId) throw new Error("deleteFile: fileId fehlt");
  const realId = await resolveShortcutOrId(fileId);
  const res = await fetch(`${DRIVE_V3}/files/${encodeURIComponent(realId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  await assertOk(res, "deleteFile");
}

/** Dateien in einem Ordner auflisten. */


/**
 * Rückwärtskompatible Listen-Funktion.
 * Akzeptiert eine freie Drive-Query (q) und gibt wie früher { files: [...] } zurück.
 * Neue Aufrufer sollten bevorzugt listFilesInFolder nutzen.
 */
export async function list(params: {
  q: string;
  fields?: string;
  pageSize?: number;
  orderBy?: string;
}): Promise<{ files: Array<Record<string, any>> }> {
  const {
    q,
    fields = "files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,thumbnailLink)",
    pageSize = 100,
    orderBy = "modifiedTime desc",
  } = params;
  if (!q) throw new Error("list: q fehlt");

  const res = await fetch(
    `${DRIVE_V3}/files?q=${encodeURIComponent(q)}&pageSize=${pageSize}&orderBy=${encodeURIComponent(orderBy)}&fields=${encodeURIComponent(fields)}`,
    { headers: await authHeaders() }
  );
  await assertOk(res, "list");
  return res.json();
}

export async function listFilesInFolder(params: {
  folderId: string;
  mimeTypeStartsWith?: string;
  nameContains?: string;
  fields?: string;
  pageSize?: number;
  orderBy?: string;
}): Promise<{ files: Array<Record<string, any>> }> {
  const {
    folderId,
    mimeTypeStartsWith,
    nameContains,
    fields = "files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink,thumbnailLink)",
    pageSize = 100,
    orderBy = "modifiedTime desc",
  } = params;
  if (!folderId) throw new Error("listFilesInFolder: folderId fehlt");

  const queryParts = [`'${folderId}' in parents`, "trashed = false"];
  if (mimeTypeStartsWith) queryParts.push(`mimeType contains '${mimeTypeStartsWith}'`);
  if (nameContains) queryParts.push(`name contains '${nameContains.replace(/'/g, "\'")}'`);

  const q = encodeURIComponent(queryParts.join(" and "));
  const res = await fetch(
    `${DRIVE_V3}/files?q=${q}&pageSize=${pageSize}&orderBy=${encodeURIComponent(orderBy)}&fields=${encodeURIComponent(fields)}`,
    { headers: await authHeaders() }
  );
  await assertOk(res, "listFilesInFolder");
  return res.json();
}

/** Nur den Dateinamen ändern. */
export async function updateFileName(fileId: string, newName: string): Promise<void> {
  if (!fileId) throw new Error("updateFileName: fileId fehlt");
  if (!newName) throw new Error("updateFileName: newName fehlt");
  const realId = await resolveShortcutOrId(fileId);
  const res = await fetch(`${DRIVE_V3}/files/${encodeURIComponent(realId)}`, {
    method: "PATCH",
    headers: await authHeaders({ "Content-Type": "application/json; charset=UTF-8" }),
    body: JSON.stringify({ name: newName }),
  });
  await assertOk(res, "updateFileName");
}

/** Elternordner setzen/ändern (optional zum Verschieben). */
export async function setParents(fileId: string, addParents?: string[], removeParents?: string[]): Promise<void> {
  if (!fileId) throw new Error("setParents: fileId fehlt");
  const realId = await resolveShortcutOrId(fileId);
  const params = new URLSearchParams();
  if (addParents?.length) params.set("addParents", addParents.join(","));
  if (removeParents?.length) params.set("removeParents", removeParents.join(","));
  const res = await fetch(`${DRIVE_V3}/files/${encodeURIComponent(realId)}?${params.toString()}`, {
    method: "PATCH",
    headers: await authHeaders(),
  });
  await assertOk(res, "setParents");
}

/** JSON-Teilstruktur patchen (read-modify-write). */
export async function patchJsonContent<T extends JsonRecord>(fileId: string, mutator: (current: T) => T): Promise<T> {
  const current = await downloadJson<T>(fileId);
  const next = mutator({ ...(current as any) });
  await overwriteJsonContent(fileId, next);
  return next;
}


/** BACKCOMPAT: alter Alias-Name für overwriteJsonContent */
export async function uploadJson(fileId: string, json: any): Promise<void> {
  return overwriteJsonContent(fileId, json);
}
export default {
  setAccessTokenProvider,
  uploadJson,
  downloadJson,
  downloadJsonWithMeta,
  overwriteJsonContent,
  uploadFile,
  deleteFile,
  list,
  listFilesInFolder,
  getFileMetadata,
  resolveShortcutOrId,
  updateFileName,
  setParents,
  patchJsonContent,
};
