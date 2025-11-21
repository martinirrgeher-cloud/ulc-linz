import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { PlanTarget } from "@/modules/leistungsgruppe/trainingsplanung/services/TrainingsplanungStore";

export type BlockTemplateItem = {
  id: string;
  exerciseId: string;
  name: string;
  haupt?: string | null;
  unter?: string | null;
  target: PlanTarget;
};

export type BlockTemplate = {
  id: string;
  title: string;
  description?: string;
  defaultDurationMin?: number | null;
  items: BlockTemplateItem[];
};

export type TrainingsbloeckeData = {
  version: number;
  updatedAt: string;
  templates: BlockTemplate[];
};

const fileId = () =>
  IDS.TRAININGSBLOECKE_FILE_ID || import.meta.env.VITE_DRIVE_TRAININGSBLOECKE_FILE_ID;

export async function loadTrainingsbloecke(): Promise<TrainingsbloeckeData> {
  const data = await downloadJson<TrainingsbloeckeData | null>(fileId());
  if (!data || !Array.isArray((data as any).templates)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      templates: [],
    };
  }
  return data;
}

async function saveTrainingsbloecke(data: TrainingsbloeckeData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await overwriteJsonContent(fileId(), data);
}

export async function upsertBlockTemplate(
  template: BlockTemplate
): Promise<TrainingsbloeckeData> {
  const data = await loadTrainingsbloecke();
  const idx = data.templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    data.templates[idx] = template;
  } else {
    data.templates.push(template);
  }
  await saveTrainingsbloecke(data);
  return data;
}

export async function deleteBlockTemplate(id: string): Promise<TrainingsbloeckeData> {
  const data = await loadTrainingsbloecke();
  data.templates = data.templates.filter((t) => t.id !== id);
  await saveTrainingsbloecke(data);
  return data;
}
