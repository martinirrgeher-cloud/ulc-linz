// services/driveMultipart.ts
// Modul-lokaler Upload ohne Änderungen am globalen DriveClientCore.
// Baut einen sauberen multipart/related-Request mit CRLF und Boundary.

import { getGoogleAccessTokenFromStorage, tokenExpired, requireGoogleTokenOrRedirect } from "@/lib/googleTokenAdapter";

type UploadArgs = {
  name: string;
  mimeType: string;
  file: File | Blob;
  parents?: string[];
  fields?: string; // optional: id,name,mimeType,webViewLink,thumbnailLink
};

type UploadResp = {
  id: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  thumbnailLink?: string;
};

async function getToken(): Promise<string> {
  const tok = getGoogleAccessTokenFromStorage?.();
  if (!tok || tokenExpired?.()) {
    // wir triggern Login1-Flow, wenn möglich
    try { requireGoogleTokenOrRedirect?.(); } catch {}
    throw new Error("Kein gültiges Google Access Token.");
  }
  return tok;
}

export async function uploadDriveMultipart(args: UploadArgs): Promise<UploadResp> {
  const token = await getToken();
  const { name, mimeType, file, parents, fields } = args;

  const boundary = "===drive_multipart_" + Math.random().toString(36).slice(2);
  const CRLF = "\r\n";
  const delimiter = `${CRLF}--${boundary}${CRLF}`;
  const closeDelim = `${CRLF}--${boundary}--`;

  const metadata: any = { name };
  if (mimeType) metadata.mimeType = mimeType;
  if (Array.isArray(parents) && parents.length) metadata.parents = parents;

  const metaPart = `Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}${JSON.stringify(metadata)}`;
  const mediaHeader = `Content-Type: ${mimeType || "application/octet-stream"}${CRLF}${CRLF}`;

  const body = new Blob(
    [ delimiter, metaPart, delimiter, mediaHeader, file, closeDelim ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const qs = new URLSearchParams();
  qs.set("uploadType", "multipart");
  qs.set("supportsAllDrives", "true");
  qs.set("fields", fields || "id,name,mimeType,webViewLink,thumbnailLink");

  const url = `https://www.googleapis.com/upload/drive/v3/files?${qs.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  if (!res.ok) {
    let detail: any = null;
    try { detail = await res.json(); } catch {
      try { detail = await res.text(); } catch {}
    }
    throw new Error(`uploadDriveMultipart fehlgeschlagen: ${res.status}${detail ? " — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
  }
  return res.json();
}
