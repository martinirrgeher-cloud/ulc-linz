// services/exercisesStore.ts
// Belässt DriveClientCore unverändert und nutzt für Uploads den modul-lokalen Multipart-Uploader.
import { downloadJson, overwriteJsonContent, deleteFile } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { Exercise, ExercisesJson, MediaItem } from "@/modules/uebungspflege/types/exercise";
import { uploadDriveMultipart } from "@/modules/uebungspflege/services/driveMultipart";

function getExercisesFileId(): string {
  const anyIDS = IDS as any;
  const id =
    anyIDS.UEBUNGEN_FILE_ID ||
    anyIDS.EXERCISES_FILE_ID ||
    import.meta.env.VITE_DRIVE_UEBUNGEN_FILE_ID ||
    import.meta.env.VITE_DRIVE_EXERCISES_FILE_ID;
  if (!id) throw new Error("UEBUNGEN/EXERCISES_FILE_ID fehlt (IDS/ENV).");
  return String(id);
}
function getMediaFolderId(): string | undefined {
  const anyIDS = IDS as any;
  return (
    anyIDS.UEBUNGEN_MEDIA_FOLDER_ID ||
    anyIDS.EXERCISES_MEDIA_FOLDER_ID ||
    import.meta.env.VITE_DRIVE_UEBUNGEN_MEDIA_FOLDER_ID ||
    import.meta.env.VITE_DRIVE_MEDIA_FOLDER_ID ||
    undefined
  );
}

export async function loadExercises(): Promise<Exercise[]> {
  const fileId = getExercisesFileId();
  try {
    const json = await downloadJson<ExercisesJson | any>(fileId);
    if (Array.isArray((json as any)?.items)) return (json as ExercisesJson).items;
    if (Array.isArray(json)) return json as Exercise[]; // legacy plain array
    return [];
  } catch {
    return [];
  }
}

async function saveExercises(list: Exercise[]): Promise<void> {
  const fileId = getExercisesFileId();
  const payload: ExercisesJson = { version: 1, items: list, updatedAt: new Date().toISOString() };
  await overwriteJsonContent(fileId, payload as any);
}

export async function addExercise(input: Omit<Exercise, "id" | "createdAt" | "updatedAt">): Promise<Exercise> {
  const list = await loadExercises();
  const ex: Exercise = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    media: input.media ?? [],
    active: input.active ?? true,
  };
  list.push(ex);
  await saveExercises(list);
  return ex;
}

export async function updateExercise(updated: Exercise): Promise<void> {
  const list = await loadExercises();
  const idx = list.findIndex(x => x.id === updated.id);
  if (idx < 0) throw new Error("Exercise not found");
  list[idx] = { ...updated, updatedAt: new Date().toISOString() };
  await saveExercises(list);
}

export async function uploadExerciseMedia(exerciseId: string, file: File): Promise<MediaItem> {
  const folderId = getMediaFolderId();
  const mime = file.type || "application/octet-stream";
  const name = file.name;

  const { id: fileId } = await uploadDriveMultipart({
    name,
    mimeType: mime,
    file,
    parents: folderId ? [folderId] : undefined,
  });

  const item: MediaItem = {
    id: crypto.randomUUID(),
    fileId,
    name,
    mimeType: mime,
    type: mime.startsWith("video/") ? "video" : "image",
    createdAt: new Date().toISOString(),
  };

  const list = await loadExercises();
  const ex = list.find(x => x.id === exerciseId);
  if (!ex) throw new Error("Exercise not found for media link");
  ex.media = ex.media ?? [];
  ex.media.push(item);
  await saveExercises(list);

  return item;
}

export async function unlinkMediaFromExercise(exerciseId: string, mediaId: string, alsoDeleteDrive = false): Promise<void> {
  const list = await loadExercises();
  const ex = list.find(x => x.id === exerciseId);
  if (!ex || !ex.media) return;

  const m = ex.media.find(x => x.id === mediaId);
  ex.media = ex.media.filter(x => x.id !== mediaId);
  await saveExercises(list);

  if (alsoDeleteDrive && m) {
    await deleteFile(m.fileId).catch(() => {});
  }
}
