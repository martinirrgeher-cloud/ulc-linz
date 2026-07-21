import { env } from "@/lib/env";
import { requireSupabase } from "@/lib/supabase";

export const EXERCISE_VIDEO_BUCKET = "exercise-videos";
export const EXERCISE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const TUS_VERSION = "1.0.0";
const CHUNK_SIZE_BYTES = 5 * 1024 * 1024;
const RETRY_DELAYS_MS = [0, 3_000, 5_000, 10_000, 20_000];

export type ExerciseVideoUploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
};

type UploadOptions = {
  organizationId: string;
  exerciseId: string;
  file: File;
  onProgress?: (progress: ExerciseVideoUploadProgress) => void;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function projectReference(): string {
  const host = new URL(env.supabaseUrl).hostname;
  const reference = host.split(".")[0];
  if (!reference) throw new Error("Die Supabase-Projektreferenz konnte nicht ermittelt werden.");
  return reference;
}

function encodeMetadata(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function sanitizeExtension(fileName: string): string {
  const extension = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  const cleaned = extension.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return cleaned || "mp4";
}


export function exerciseVideoMimeType(file: File): string {
  if (file.type.startsWith("video/")) return file.type;
  const extension = sanitizeExtension(file.name);
  const mimeByExtension: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    webm: "video/webm",
    "3gp": "video/3gpp",
    "3g2": "video/3gpp2",
  };
  return mimeByExtension[extension] ?? "";
}

function fingerprintKey(
  file: File,
  organizationId: string,
  exerciseId: string,
): string {
  const raw = `${organizationId}|${exerciseId}|${file.name}|${file.size}|${file.lastModified}`;
  return `ulc-exercise-video-tus:${encodeMetadata(raw)
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 180)}`;
}

type StoredUpload = {
  storagePath: string;
  uploadUrl: string;
};

function readStoredUpload(key: string): StoredUpload | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredUpload>;
    if (typeof value.storagePath !== "string" || typeof value.uploadUrl !== "string") {
      return null;
    }
    return { storagePath: value.storagePath, uploadUrl: value.uploadUrl };
  } catch {
    return null;
  }
}

async function accessToken(): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) {
    throw new Error("Die Anmeldung ist abgelaufen. Bitte neu anmelden.");
  }
  return data.session.access_token;
}

function commonHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    apikey: env.supabasePublishableKey,
    "Tus-Resumable": TUS_VERSION,
  };
}

async function createUpload(
  endpoint: string,
  token: string,
  storagePath: string,
  file: File,
): Promise<string> {
  const metadata = [
    `bucketName ${encodeMetadata(EXERCISE_VIDEO_BUCKET)}`,
    `objectName ${encodeMetadata(storagePath)}`,
    `contentType ${encodeMetadata(exerciseVideoMimeType(file))}`,
    `cacheControl ${encodeMetadata("3600")}`,
  ].join(",");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...commonHeaders(token),
      "Upload-Length": String(file.size),
      "Upload-Metadata": metadata,
      "x-upsert": "false",
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Video-Upload konnte nicht gestartet werden (${response.status}).`);
  }

  const location = response.headers.get("location");
  if (!location) throw new Error("Supabase hat keine Upload-Adresse zurückgegeben.");
  return new URL(location, endpoint).toString();
}

async function readOffset(uploadUrl: string, token: string): Promise<number | null> {
  const response = await fetch(uploadUrl, {
    method: "HEAD",
    headers: commonHeaders(token),
  });

  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`Der unterbrochene Upload konnte nicht fortgesetzt werden (${response.status}).`);

  const offset = Number(response.headers.get("upload-offset"));
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

function uploadChunk(
  uploadUrl: string,
  token: string,
  chunk: Blob,
  offset: number,
  totalBytes: number,
  onProgress?: (progress: ExerciseVideoUploadProgress) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PATCH", uploadUrl);
    Object.entries(commonHeaders(token)).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.setRequestHeader("Upload-Offset", String(offset));
    request.setRequestHeader("Content-Type", "application/offset+octet-stream");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const uploadedBytes = Math.min(totalBytes, offset + event.loaded);
      onProgress?.({
        uploadedBytes,
        totalBytes,
        percent: totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0,
      });
    };

    request.onerror = () => reject(new Error("Netzwerkfehler beim Video-Upload."));
    request.onabort = () => reject(new Error("Der Video-Upload wurde abgebrochen."));
    request.onload = () => {
      if (request.status !== 204) {
        reject(new Error(request.responseText || `Video-Upload fehlgeschlagen (${request.status}).`));
        return;
      }
      const nextOffset = Number(request.getResponseHeader("Upload-Offset"));
      resolve(Number.isFinite(nextOffset) ? nextOffset : offset + chunk.size);
    };

    request.send(chunk);
  });
}

async function uploadChunkWithRetry(
  uploadUrl: string,
  token: string,
  file: File,
  initialOffset: number,
  onProgress?: (progress: ExerciseVideoUploadProgress) => void,
): Promise<number> {
  let offset = initialOffset;
  let lastError: unknown = null;

  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    try {
      const currentOffset = await readOffset(uploadUrl, token);
      if (currentOffset === null) throw new Error("Die Upload-Sitzung ist abgelaufen.");
      offset = Math.max(offset, currentOffset);
      if (offset >= file.size) return offset;

      const chunk = file.slice(offset, Math.min(file.size, offset + CHUNK_SIZE_BYTES));
      return await uploadChunk(uploadUrl, token, chunk, offset, file.size, onProgress);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Der Video-Upload ist fehlgeschlagen.");
}

export function validateExerciseVideoFile(file: File): void {
  if (!exerciseVideoMimeType(file)) {
    throw new Error("Bitte eine Videodatei aus der Galerie auswählen.");
  }
  if (file.size <= 0) throw new Error("Die ausgewählte Videodatei ist leer.");
  if (file.size > EXERCISE_VIDEO_MAX_BYTES) {
    throw new Error("Das Video ist größer als 50 MB. Bitte am Handy kürzen oder komprimieren.");
  }
}

export function exerciseVideoStoragePath(
  organizationId: string,
  exerciseId: string,
  file: File,
): string {
  return `${organizationId}/${exerciseId}/${crypto.randomUUID()}.${sanitizeExtension(file.name)}`;
}

export async function uploadExerciseVideoFile({
  organizationId,
  exerciseId,
  file,
  onProgress,
}: UploadOptions): Promise<string> {
  validateExerciseVideoFile(file);

  const localKey = fingerprintKey(file, organizationId, exerciseId);
  const token = await accessToken();
  const endpoint = `https://${projectReference()}.storage.supabase.co/storage/v1/upload/resumable`;

  const storedUpload = readStoredUpload(localKey);
  let storagePath = storedUpload?.storagePath
    ?? exerciseVideoStoragePath(organizationId, exerciseId, file);
  let uploadUrl: string | null = storedUpload?.uploadUrl ?? null;
  let offset = 0;

  if (uploadUrl) {
    try {
      const storedOffset = await readOffset(uploadUrl, token);
      if (storedOffset === null) {
        window.localStorage.removeItem(localKey);
        uploadUrl = null;
      } else {
        offset = storedOffset;
      }
    } catch {
      window.localStorage.removeItem(localKey);
      uploadUrl = null;
    }
  }

  if (!uploadUrl) {
    storagePath = exerciseVideoStoragePath(organizationId, exerciseId, file);
    uploadUrl = await createUpload(endpoint, token, storagePath, file);
    window.localStorage.setItem(localKey, JSON.stringify({ storagePath, uploadUrl }));
  }

  onProgress?.({
    uploadedBytes: offset,
    totalBytes: file.size,
    percent: file.size > 0 ? Math.round((offset / file.size) * 100) : 0,
  });

  while (offset < file.size) {
    offset = await uploadChunkWithRetry(uploadUrl, token, file, offset, onProgress);
  }

  window.localStorage.removeItem(localKey);
  onProgress?.({ uploadedBytes: file.size, totalBytes: file.size, percent: 100 });
  return storagePath;
}
