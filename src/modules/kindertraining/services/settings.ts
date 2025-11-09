// src/modules/kindertraining/services/settings.ts
import { downloadJson, overwriteJsonContent as __overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import type { KindertrainingRoot, Settings } from "../lib/types";
function pruneNotPaid(root: any) {
  if (!root || typeof root !== "object") return;
  const weeks = root.weeks && typeof root.weeks === "object" ? root.weeks : {};
  if (weeks.attendance && typeof weeks.attendance === "object") delete weeks.attendance.notPaid;
  if (weeks.weekMeta && typeof weeks.weekMeta === "object") delete weeks.weekMeta.notPaid;
  Object.values(weeks).forEach((wk: any) => { if (wk && typeof wk === "object") delete wk.notPaid; });
}
async function overwriteJsonContent(fileId: string, payload: any) {
  try { pruneNotPaid(payload); } catch {}
  return __overwriteJsonContent(fileId, payload);
}

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
