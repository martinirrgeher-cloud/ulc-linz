import { getAccessToken as getToken } from "@/lib/googleAuth";
import { requireEnv } from "@/lib/requireEnv";

const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

// Optional: prüft beim Laden ob ENV vorhanden sind (wirft sonst Fehler)
requireEnv("VITE_DRIVE_KINDERTRAINING_FILE_ID");
requireEnv("VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID");

async function authHeader(): Promise<HeadersInit> {
  const token = getToken();
  if (!token) throw new Error("Kein Google-Token (Login 1 erforderlich).");
  return { Authorization: `Bearer ${token}` };
}

export async function downloadJson(fileId: string): Promise<any> {
  const hdr = await authHeader();
  const res = await fetch(
    `${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { ...hdr } }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`downloadJson fehlgeschlagen (${res.status}): ${t}`);
  }
  return res.json();
}

export async function overwriteJsonContent(fileId: string, data: any): Promise<void> {
  const hdr = await authHeader();
  const metadata = { name: fileId };

  const res = await fetch(
    `${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}?uploadType=multipart`,
    {
      method: "PATCH",
      headers: { ...hdr },
      body: createMultipartBody(metadata, data),
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`overwriteJsonContent fehlgeschlagen (${res.status}): ${t}`);
  }
}

function createMultipartBody(metadata: any, data: any): Blob {
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(data) +
    close_delim;

  return new Blob([body], { type: `multipart/related; boundary="${boundary}"` });
}
