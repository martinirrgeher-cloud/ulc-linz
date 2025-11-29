// src/modules/leistungsgruppe/trainingsplanung/services/TrainingsplanungStore.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";

/**
 * Zielwerte für eine Übung im Plan.
 * Die bisherigen Felder reps/menge/einheit bleiben zur Kompatibilität erhalten
 * und werden um strukturierte Angaben erweitert.
 */
export type PlanTarget = {
  // bisher: generischer Umfang
  reps: number | null;
  menge: number | null;
  einheit: string | null;

  // strukturierte Trainingsparameter
  sets?: number | null;
  distanceM?: number | null;
  weightKg?: number | null;
  durationSec?: number | null;
};

export type PlanItem = {
  exerciseId: string;
  nameCache?: string;
  groupCache?: { haupt?: string; unter?: string };

  // Default-Werte aus dem Übungskatalog (zur Orientierung)
  default: PlanTarget;

  // konkret geplanter Umfang für diese Einheit
  target: PlanTarget;

  pauseSec?: number | null;
  comment?: string | null;
};

export type PlanBlockType =
  | "WARM_UP"
  | "SPRINT"
  | "TECHNIK"
  | "KRAFT"
  | "AUSLAUFEN"
  | "STABI"
  | "SONSTIGES";

/**
 * Ein Block fasst mehrere Übungen zusammen (z.B. Aufwärmen, Hauptteil, Stabi).
 */
export type PlanBlock = {
  id: string;
  title: string;
  type?: PlanBlockType;
  targetDurationMin?: number | null; // Orientierungsgröße für den Block
  itemOrder: string[];               // Reihenfolge der Item-IDs in diesem Block
  notes?: string | null;             // optionale Block-Notizen
};

/**
 * Meta-Infos zu einem Tagesplan, z.B. aus welchem Athleten/Tag er kopiert wurde
 * oder ob er aus einem Template stammt.
 */
export type PlanDayMeta = {
  sourceAthleteId?: string;
  sourceDateISO?: string;
  templateId?: string | null;
};

/**
 * Plan für einen Tag eines Athleten.
 *
 * - order: alte flache Reihenfolge (für bestehende UI)
 * - items: alle Übungen, indexiert nach ID
 * - blocks/blockOrder: Blockstruktur
 * - meta: optionale Herkunftsinfos (z.B. Copy/Template)
 */
export type PlanDay = {
  order: string[];
  items: Record<string, PlanItem>;
  blocks?: Record<string, PlanBlock>;
  blockOrder?: string[];
  meta?: PlanDayMeta;
};

/**
 * Alle Pläne eines Athleten, indexiert nach Datum (YYYY-MM-DD).
 */
export type PlansByDay = Record<string, PlanDay>;

/**
 * Gesamtdaten: alle Athleten → alle Tage.
 */
export type PlansByAthlete = Record<
  string,   // athleteId
  PlansByDay
>;

/**
 * Template für einen Tagesplan (z.B. Standard-Sprintdienstag).
 */
export type PlanTemplate = {
  id: string;
  label: string;
  description?: string;
  day: PlanDay;
  createdAt: string;
  updatedAt: string;
};

export type TrainingsplanTemplates = Record<string, PlanTemplate>;

/**
 * Root-Objekt der Trainingsplanung.
 */
export type TrainingsplanData = {
  version: number;
  updatedAt: string;
  plansByAthlete: PlansByAthlete;
  templates?: TrainingsplanTemplates;
};

const CURRENT_VERSION = 2;

const fileId = () =>
  IDS.TRAININGSPLAN_FILE_ID || import.meta.env.VITE_DRIVE_TRAININGSPLAN_FILE_ID;

/**
 * Normalisiert geladene Daten und hebt sie bei Bedarf auf die aktuelle Version.
 */
function normalize(data: TrainingsplanData | null): TrainingsplanData {
  if (!data) {
    return {
      version: CURRENT_VERSION,
      updatedAt: new Date().toISOString(),
      plansByAthlete: {},
      templates: {},
    };
  }

  const normalized: TrainingsplanData = {
    version: data.version ?? 1,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    plansByAthlete: data.plansByAthlete ?? {},
    templates: data.templates ?? {},
  };

  if (normalized.version < CURRENT_VERSION) {
    normalized.version = CURRENT_VERSION;
  }

  return normalized;
}

/**
 * Lädt alle Trainingspläne aus Google Drive.
 */
export async function loadPlans(): Promise<TrainingsplanData> {
  const raw = await downloadJson<TrainingsplanData>(fileId());
  return normalize(raw ?? null);
}

/**
 * Schreibt einen Tagesplan für einen Athleten zurück nach Google Drive.
 */
export async function upsertAthleteDay(
  athleteId: string,
  dateISO: string,
  day: PlanDay
): Promise<void> {
  const data = await loadPlans();
  if (!data.plansByAthlete[athleteId]) {
    data.plansByAthlete[athleteId] = {};
  }
  data.plansByAthlete[athleteId][dateISO] = {
    order: day.order ?? [],
    items: day.items ?? {},
    blocks: day.blocks,
    blockOrder: day.blockOrder,
    meta: day.meta,
  };
  data.updatedAt = new Date().toISOString();
  await overwriteJsonContent(fileId(), data);
}

/**
 * Liefert den Tagesplan eines Athleten oder null, wenn keiner existiert.
 */
export async function getAthleteDay(
  athleteId: string,
  dateISO: string
): Promise<PlanDay | null> {
  const data = await loadPlans();
  return data.plansByAthlete[athleteId]?.[dateISO] ?? null;
}

/**
 * Klont einen Tagesplan tief und versieht ihn optional mit neuen Meta-Daten.
 * (Wird für Copy-Funktionen und Templates verwendet.)
 */
export function cloneDay(
  source: PlanDay,
  metaOverride?: Partial<PlanDayMeta>
): PlanDay {
  const cloned: PlanDay = JSON.parse(JSON.stringify(source));
  cloned.meta = {
    ...(source.meta ?? {}),
    ...(metaOverride ?? {}),
  };
  return cloned;
}

/**
 * Kopiert einen Tagesplan von einem Athleten/Datum auf einen anderen Athleten/Datum.
 * Der Plan wird dabei vollständig kopiert (keine Verbindung zum Original).
 */
export async function copyDayBetweenAthletes(params: {
  fromAthleteId: string;
  fromDateISO: string;
  toAthleteId: string;
  toDateISO: string;
}): Promise<void> {
  const data = await loadPlans();
  const srcDay =
    data.plansByAthlete[params.fromAthleteId]?.[params.fromDateISO];
  if (!srcDay) return;

  const cloned = cloneDay(srcDay, {
    sourceAthleteId: params.fromAthleteId,
    sourceDateISO: params.fromDateISO,
  });

  if (!data.plansByAthlete[params.toAthleteId]) {
    data.plansByAthlete[params.toAthleteId] = {};
  }
  data.plansByAthlete[params.toAthleteId][params.toDateISO] = cloned;
  data.updatedAt = new Date().toISOString();
  await overwriteJsonContent(fileId(), data);
}

/**
 * Legt aus einem bestehenden Tagesplan ein Template an.
 */
export async function createTemplateFromDay(params: {
  templateId: string;
  label: string;
  description?: string;
  athleteId: string;
  dateISO: string;
}): Promise<void> {
  const data = await loadPlans();
  const day = data.plansByAthlete[params.athleteId]?.[params.dateISO];
  if (!day) return;

  const tmpl: PlanTemplate = {
    id: params.templateId,
    label: params.label,
    description: params.description,
    day: cloneDay(day, { templateId: params.templateId }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!data.templates) {
    data.templates = {};
  }
  data.templates[tmpl.id] = tmpl;
  data.updatedAt = new Date().toISOString();
  await overwriteJsonContent(fileId(), data);
}

/**
 * Wendet ein Template auf einen Athleten/Tag an (kopiert).
 */
export async function applyTemplateToAthleteDay(params: {
  templateId: string;
  athleteId: string;
  dateISO: string;
}): Promise<void> {
  const data = await loadPlans();
  const tmpl = data.templates?.[params.templateId];
  if (!tmpl) return;

  const cloned = cloneDay(tmpl.day, {
    templateId: tmpl.id,
  });

  if (!data.plansByAthlete[params.athleteId]) {
    data.plansByAthlete[params.athleteId] = {};
  }
  data.plansByAthlete[params.athleteId][params.dateISO] = cloned;
  data.updatedAt = new Date().toISOString();
  await overwriteJsonContent(fileId(), data);
}
