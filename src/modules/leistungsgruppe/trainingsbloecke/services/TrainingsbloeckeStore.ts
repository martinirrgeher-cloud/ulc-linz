import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { PlanTarget } from "@/modules/leistungsgruppe/trainingsplanung/services/TrainingsplanungStore";

export type BlockTemplateItem = {
  id: string;
  exerciseId: string;
  name: string;
  haupt?: string | null;
  unter?: string | null;
  difficulty?: number | null;
  target: PlanTarget;
};

export type BlockTemplate = {
  id: string;
  title: string;
  group: string;
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
  IDS.TRAININGSBLOECKE_FILE_ID ||
  import.meta.env.VITE_DRIVE_TRAININGSBLOECKE_FILE_ID;

/**
 * Robustes Laden:
 * - leere / ungültige Datei -> leere Struktur
 * - fehlende Felder (group, difficulty) werden mit Defaults versehen
 */
export async function loadTrainingsbloecke(): Promise<TrainingsbloeckeData> {
  try {
    const data = await downloadJson<TrainingsbloeckeData | null>(fileId());

    if (!data || !Array.isArray((data as any).templates)) {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        templates: [],
      };
    }

    const normalizedTemplates: BlockTemplate[] = (data.templates ?? []).map(
      (tpl: any, idx: number): BlockTemplate => ({
        id: String(tpl.id ?? `tpl-${idx}`),
        title: String(tpl.title ?? "Ohne Titel"),
        group: (tpl.group ?? "Allgemein").trim() || "Allgemein",
        description: tpl.description ?? "",
        defaultDurationMin:
          typeof tpl.defaultDurationMin === "number"
            ? tpl.defaultDurationMin
            : null,
        items: Array.isArray(tpl.items)
          ? tpl.items.map((it: any, itemIdx: number): BlockTemplateItem => ({
              id: String(it.id ?? `item-${idx}-${itemIdx}`),
              exerciseId: String(it.exerciseId ?? it.id ?? ""),
              name: String(it.name ?? it.exerciseId ?? "Unbenannte Übung"),
              haupt: it.haupt ?? null,
              unter: it.unter ?? null,
              difficulty:
                typeof it.difficulty === "number" && Number.isFinite(it.difficulty)
                  ? it.difficulty
                  : null,
              target: {
                reps: it.target?.reps ?? null,
                menge: it.target?.menge ?? null,
                einheit: it.target?.einheit ?? null,
                sets: it.target?.sets ?? null,
                distanceM: it.target?.distanceM ?? null,
                weightKg: it.target?.weightKg ?? null,
                durationSec: it.target?.durationSec ?? null,
              } as PlanTarget,
            }))
          : [],
      })
    );

    return {
      version: data.version ?? 1,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      templates: normalizedTemplates,
    };
  } catch (err) {
    console.error("Trainingsblöcke: downloadJson fehlgeschlagen", err);
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      templates: [],
    };
  }
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

export async function deleteBlockTemplate(
  id: string
): Promise<TrainingsbloeckeData> {
  const data = await loadTrainingsbloecke();
  data.templates = data.templates.filter((t) => t.id !== id);
  await saveTrainingsbloecke(data);
  return data;
}

export async function saveAllTemplates(
  templates: BlockTemplate[]
): Promise<TrainingsbloeckeData> {
  const data = await loadTrainingsbloecke();
  data.templates = templates;
  await saveTrainingsbloecke(data);
  return data;
}
