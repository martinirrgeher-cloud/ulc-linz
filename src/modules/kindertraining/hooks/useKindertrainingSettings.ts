import { overwriteJsonContent, downloadJson } from "@/lib/drive/DriveClient";

const TRAINING_FILE_ID = import.meta.env.VITE_DRIVE_KINDERTRAINING_FILE_ID as string;

export function useKindertrainingSettings() {
  async function saveSettings(newSettings: any, onSuccess?: (s: any) => void) {
    const current = await downloadJson(TRAINING_FILE_ID).catch(() => ({}));
    const updated = {
      ...current,
      __settings__: newSettings
    };
    await overwriteJsonContent(TRAINING_FILE_ID, updated);
    if (onSuccess) onSuccess(newSettings); // ⬅️ sofort an Hook zurückgeben
  }

  return { saveSettings };
}
