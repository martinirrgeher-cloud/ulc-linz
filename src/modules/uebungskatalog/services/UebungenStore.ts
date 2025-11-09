// src/modules/uebungskatalog/services/UebungenStore.ts
import { downloadJson, overwriteJsonContent, uploadFile, deleteFile } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { Exercise } from "@/modules/uebungskatalog/types/ExerciseTypes";

export async function loadUebungen(): Promise<Exercise[]> {
  if (!IDS.UEBUNGEN_FILE_ID) throw new Error("UEBUNGEN_FILE_ID fehlt");
  const data = await downloadJson<any>(IDS.UEBUNGEN_FILE_ID);
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return list as Exercise[];
}

export async function saveUebungen(list: Exercise[]): Promise<void> {
  if (!IDS.UEBUNGEN_FILE_ID) throw new Error("UEBUNGEN_FILE_ID fehlt");
  await overwriteJsonContent(IDS.UEBUNGEN_FILE_ID, { items: list });
}

export async function uploadMedia(file: File): Promise<{ id: string; url: string; type: "image"|"video"; name: string }> {
  if (!IDS.MEDIA_FOLDER_ID) throw new Error("MEDIA_FOLDER_ID fehlt");
  const mime = file.type || "application/octet-stream";
  const res = await uploadFile({ blob: file, name: file.name, mimeType: mime, parentFolderId: IDS.MEDIA_FOLDER_ID });
  const id = res.fileId;
  const url = `https://drive.google.com/uc?id=${id}`;
  const type = mime.startsWith("image/") ? "image" : (mime.startsWith("video/") ? "video" : "image");
  return { id, url, type, name: file.name };
}

export async function removeFile(fileId: string): Promise<void> {
  await deleteFile(fileId);
}