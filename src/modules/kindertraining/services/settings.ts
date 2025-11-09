// src/modules/kindertraining/services/settings.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import type { KindertrainingRoot, Settings } from "../lib/types";
import { normalizeRoot, writeBack, normalizeSettings } from "./mapper";

function getDataFileId(): string {
  const id = import.meta.env.VITE_DRIVE_KINDERTRAINING_DATA_FILE_ID;
  if (!id) throw new Error("VITE_DRIVE_KINDERTRAINING_DATA_FILE_ID fehlt");
  return String(id);
}

async function loadRoot(): Promise<KindertrainingRoot> {
  const json = await downloadJson<any>(getDataFileId()).catch(() => ({}));
  return normalizeRoot(json || {});
}

async function saveRoot(root: KindertrainingRoot): Promise<void> {
  const out = writeBack(root);
  await overwriteJsonContent(getDataFileId(), out);
}

export async function loadSettings(): Promise<Settings> {
  const root = await loadRoot();
  return normalizeSettings(root.__settings__);
}

export async function saveSettings(s: Settings): Promise<void> {
  const root = await loadRoot();
  root.__settings__ = s;
  await saveRoot(root);
}
