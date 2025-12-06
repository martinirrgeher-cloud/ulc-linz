// src/modules/leistungsgruppe/trainingsdoku/services/TrainingsdokuStore.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type {
  PlanDay,
  PlanTarget,
  PlanBlockType,
  PlanTargetPerSet,
} from "../../trainingsplanung/services/TrainingsplanungStore";

/**
 * Zielwerte in der Dokumentation entsprechen 1:1 den Zielwerten im Plan.
 * Wir referenzieren den Typ, um keine Dopplungen zu erzeugen.
 */
export type TrainingDocTarget = PlanTarget;

export type TrainingDocPerSetTarget = PlanTargetPerSet;

/**
 * Ein geplanter/absolvierter Zielwert pro Satz (z.B. Gewicht oder Zeit).
 * Wir referenzieren den Typ aus der Planung, um konsistent zu bleiben.
 */

export type TrainingDocItemStatus =
  | "planned"            // noch nicht bearbeitet
  | "completedAsPlanned" // mit einem Tap bestätigt
  | "completedModified"  // erledigt, aber Umfang geändert
  | "partial"            // nur teilweise absolviert
  | "skipped";           // ausgelassen

export type TrainingDocIssueTag =
  | "PAIN"
  | "TOO_HARD"
  | "TOO_EASY"
  | "TIME"
  | "OTHER";

/**
 * Ein dokumentierter Übungs-Eintrag für einen Athleten an einem Tag.
 */
export type TrainingDocItem = {
  /** Stabile ID des Doku-Eintrags; bei aus dem Plan übernommenen Übungen ident mit planItemId. */
  id: string;

  /** Referenz auf das Plan-Item, falls die Übung aus dem Plan stammt. */
  planItemId?: string;

  /** Kennzeichnung, ob der Eintrag aus dem Plan kommt oder vom Athleten ergänzt wurde. */
  source: "plan" | "added";

  /** Referenz auf die Übung aus dem Katalog. */
  exerciseId: string;

  /** Caches für die Anzeige – wie in der Planung. */
  nameCache?: string;
  groupCache?: { haupt?: string; unter?: string };

  /** Geplanter Umfang (Snapshot aus dem Plan zum Doku-Zeitpunkt). */
  plannedTarget?: TrainingDocTarget | null;

  /** Tatsächlich absolvierter Umfang (aggregiert, z.B. Gesamtumfang). */
  actualTarget?: TrainingDocTarget | null;

  /** Geplante Zielwerte pro Satz (falls im Plan gesplittet, z.B. Gewichte/Zielzeiten). */
  plannedPerSetTargets?: TrainingDocPerSetTarget[];

  /** Tatsächlich absolvierte Zielwerte pro Satz (optional). */
  actualPerSetTargets?: TrainingDocPerSetTarget[];

  /** Status des Eintrags. */
  status: TrainingDocItemStatus;

  /** Freitext-Notiz des Athleten zu dieser Übung. */
  note?: string;

  /** Kategorisiertes Problem/Feedback. */
  issueTag?: TrainingDocIssueTag;
};

/**
 * Ein dokumentierter Block (z.B. Aufwärmen, Hauptteil).
 */
export type TrainingDocBlock = {
  /** Stabile ID des Blocks; bei Plan-Blöcken ident mit der Block-ID aus dem Plan. */
  id: string;
  title: string;
  type?: PlanBlockType | null;

  /** Reihenfolge der Items in diesem Block. */
  itemOrder: string[];

  /** Items als Map nach ID. */
  items: Record<string, TrainingDocItem>;
};

export type TrainingDayOverall = {
  /** Subjektive Belastung, z.B. 1–10. */
  rpe?: number;
  /** Allgemeine Stimmung. */
  mood?: "great" | "ok" | "tired";
  /** Freitext-Kommentar zum gesamten Training. */
  note?: string;
};

/**
 * Dokumentation eines Tages für einen Athleten.
 * Identifiziert durch athleteId + dateISO.
 */
export type TrainingDayDoc = {
  athleteId: string;
  /** Datum im Format YYYY-MM-DD. */
  dateISO: string;

  blocks: TrainingDocBlock[];

  /** Zusammenfassendes Feedback zum Trainingstag. */
  overall?: TrainingDayOverall;

  /** Optional: Referenz auf die Plan-Version (falls wir das später benötigen). */
  basedOnPlanVersion?: string;

  createdAt: string;
  updatedAt: string;
};

/**
 * Alle Dokumentationen eines Athleten, indexiert nach Datum.
 */
export type DocsByDay = Record<string, TrainingDayDoc>;

/**
 * Root-Objekt der Trainingsdokumentation – analog zur Trainingsplanung.
 * Wir bleiben bei einer zentralen JSON-Datei auf Google Drive.
 */
export type TrainingsdokuData = {
  version: number;
  updatedAt: string;
  docsByAthlete: Record<string, DocsByDay>;
};

const CURRENT_VERSION = 1;

const fileId = () =>
  IDS.TRAININGSDOKU_FILE_ID ||
  import.meta.env.VITE_DRIVE_TRAININGSDOKU_FILE_ID;

/**
 * Leeres Root-Objekt erstellen.
 */
function emptyData(): TrainingsdokuData {
  return {
    version: CURRENT_VERSION,
    updatedAt: new Date().toISOString(),
    docsByAthlete: {},
  };
}

/**
 * Normalisiert geladene Daten und hebt sie bei Bedarf auf die aktuelle Version.
 * (Derzeit nur Version 1 – Platzhalter für spätere Migrationen.)
 */
function normalize(data: TrainingsdokuData | null): TrainingsdokuData {
  if (!data) {
    return emptyData();
  }

  // Falls wir später Versionen einführen, können wir hier migrieren.
  if (!data.version) {
    data.version = 1;
  }

  if (!data.docsByAthlete) {
    data.docsByAthlete = {};
  }

  return {
    ...data,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

/**
 * Lädt alle Trainingsdoku-Daten aus Google Drive.
 */
export async function loadDocs(): Promise<TrainingsdokuData> {
  const raw = await downloadJson<TrainingsdokuData>(fileId());
  return normalize(raw ?? null);
}

/**
 * Lädt die Dokumentation für einen Athleten und ein Datum.
 */
export async function loadDayDoc(
  athleteId: string,
  dateISO: string
): Promise<TrainingDayDoc | null> {
  const data = await loadDocs();
  return data.docsByAthlete[athleteId]?.[dateISO] ?? null;
}

/**
 * Schreibt ein Tagesdoku-Objekt zurück nach Google Drive.
 * Wird für Autosave und vollständige Bestätigung verwendet.
 */
export async function upsertDayDoc(doc: TrainingDayDoc): Promise<void> {
  const data = await loadDocs();

  if (!data.docsByAthlete[doc.athleteId]) {
    data.docsByAthlete[doc.athleteId] = {};
  }

  const existing = data.docsByAthlete[doc.athleteId][doc.dateISO];

  const merged: TrainingDayDoc = {
    ...existing,
    ...doc,
    blocks: doc.blocks,
    createdAt: existing?.createdAt ?? doc.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.docsByAthlete[doc.athleteId][doc.dateISO] = merged;
  data.updatedAt = new Date().toISOString();

  await overwriteJsonContent(fileId(), data as any);
}

/**
 * Hilfsfunktion:
 * Erstellt eine initiale Dokumentations-Struktur aus einem PlanDay.
 * Diese Funktion erzeugt nur das In-Memory-Objekt und speichert noch nicht.
 */
export function createInitialDocFromPlan(
  athleteId: string,
  dateISO: string,
  plan: PlanDay
): TrainingDayDoc {
  const blocks: TrainingDocBlock[] = [];

  const blockOrder = plan.blockOrder ?? [];
  const blocksMap = plan.blocks ?? {};

  for (const blockId of blockOrder) {
    const planBlock = blocksMap[blockId];
    if (!planBlock) continue;

    const items: Record<string, TrainingDocItem> = {};
    const itemOrder: string[] = [];

    for (const itemId of planBlock.itemOrder) {
      const planItem = plan.items[itemId];
      if (!planItem) continue;

      const plannedTarget = planItem.target ?? planItem.default;
      const perSet = (planItem as any).perSetTargets as
        | PlanTargetPerSet[]
        | undefined;

      const docItem: TrainingDocItem = {
        id: itemId,
        planItemId: itemId,
        source: "plan",
        exerciseId: planItem.exerciseId,
        nameCache: planItem.nameCache,
        groupCache: planItem.groupCache,
        plannedTarget,
        actualTarget: null,
        plannedPerSetTargets:
          perSet && perSet.length > 0
            ? perSet.map((p) => ({
                weightKg: p.weightKg ?? null,
                durationSec: p.durationSec ?? null,
              }))
            : undefined,
        actualPerSetTargets: undefined,
        status: "planned",
      };

      items[itemId] = docItem;
      itemOrder.push(itemId);
    }

    blocks.push({
      id: planBlock.id,
      title: planBlock.title,
      type: planBlock.type ?? null,
      itemOrder,
      items,
    });
  }

  const now = new Date().toISOString();

  return {
    athleteId,
    dateISO,
    blocks,
    createdAt: now,
    updatedAt: now,
  };
}
