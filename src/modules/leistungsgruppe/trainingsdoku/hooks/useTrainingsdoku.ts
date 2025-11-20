// src/modules/leistungsgruppe/trainingsdoku/hooks/useTrainingsdoku.ts
import { useEffect, useState } from "react";
import {
  loadDoku,
  saveDoku,
  DokuData,
  DokuDay,
  DokuItem,
  DokuItemStatus,
} from "../services/TrainingsdokuStore";
import { loadPlans } from "../../trainingsplanung/services/TrainingsplanungStore";
import { toISODate } from "../../common/date";

/**
 * Hook für das Modul Trainingsdoku.
 *
 * - Lädt vorhandene Doku-Datei des Athleten von Drive
 * - Lädt den Plan des Athleten / Tages aus dem Trainingsplanung-Modul
 * - Stellt Helfer für Statuswechsel, Extra-Übungen und Zusammenfassung bereit
 */
export function useTrainingsdoku() {
  const today = toISODate(new Date());
  const [dateISO, setDateISO] = useState<string>(today);
  const [athleteId, setAthleteId] = useState<string>("");
  const [athleteName, setAthleteName] = useState<string>("");

  const [doku, setDoku] = useState<DokuData | null>(null);
  const [planItems, setPlanItems] = useState<any[]>([]);

  // Athlet aus globalem Kontext übernehmen (falls z.B. aus Anmeldung gesetzt)
  useEffect(() => {
    const w: any = (window as any);
    if (w?.ULC?.currentAthlete) {
      const { id, name } = w.ULC.currentAthlete;
      if (id) setAthleteId(String(id));
      if (name) setAthleteName(String(name));
    }
  }, []);

  // Doku + Plan laden, sobald Athlet oder Datum geändert werden
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!athleteId || !dateISO) {
        if (!cancelled) {
          setDoku(null);
          setPlanItems([]);
        }
        return;
      }

      try {
        const [dokuData, plans] = await Promise.all([
          loadDoku(athleteId),
          loadPlans(),
        ]);

        if (cancelled) return;

        setDoku(dokuData);

        const perAthlete = plans.plansByAthlete?.[athleteId] ?? {};
        const day = perAthlete[dateISO];
        if (day) {
          const arr = day.order.map((id: string) => ({
            id,
            ...(day.items[id] ?? {}),
          }));
          setPlanItems(arr);
        } else {
          setPlanItems([]);
        }
      } catch (err) {
        console.error("Trainingsdoku: load failed", err);
        if (!cancelled) {
          setDoku(null);
          setPlanItems([]);
        }
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [athleteId, dateISO]);

  function beginTraining() {
    if (!doku) return;
    const next: DokuData = JSON.parse(JSON.stringify(doku));
    next.logsByDate[dateISO] ??= { items: [] };
    if (!next.logsByDate[dateISO].startedAt) {
      next.logsByDate[dateISO].startedAt = new Date().toISOString();
    }
    setDoku(next);
  }

  function setItemStatus(
    planIndex: number,
    status: DokuItemStatus,
    actualPatch?: any
  ) {
    if (!doku) return;
    const next: DokuData = JSON.parse(JSON.stringify(doku));
    next.logsByDate[dateISO] ??= { items: [] };

    const plan = planItems[planIndex];
    const planned = {
      reps: plan?.target?.reps ?? null,
      menge: plan?.target?.menge ?? null,
      einheit: plan?.target?.einheit ?? null,
    };

    const base: DokuItem = {
      exerciseId: plan?.exerciseId ?? "unknown",
      status,
      planned,
    };

    if (status === "AS_PLANNED") {
      base.actual = { ...planned };
    }

    if (status === "MODIFIED" && actualPatch) {
      const {
        executionQuality,
        perceivedDifficulty,
        executionComment,
        ...restActual
      } = actualPatch;

      base.actual = { ...planned, ...restActual };

      if (executionQuality) {
        base.executionQuality = executionQuality;
      }
      if (perceivedDifficulty) {
        base.perceivedDifficulty = perceivedDifficulty;
      }
      if (executionComment) {
        base.executionComment = executionComment;
      }
    }

    next.logsByDate[dateISO].items[planIndex] = base;
    setDoku(next);
  }

  function addExtra(ex: {
    exerciseId: string;
    actual?: any;
    comment?: string;
  }) {
    if (!doku) return;
    const next: DokuData = JSON.parse(JSON.stringify(doku));
    next.logsByDate[dateISO] ??= { items: [] };
    const it: DokuItem = {
      exerciseId: ex.exerciseId,
      status: "EXTRA",
      planned: { reps: null, menge: null, einheit: null },
      actual: ex.actual ?? {},
      comment: ex.comment,
    };
    next.logsByDate[dateISO].items.push(it);
    setDoku(next);
  }

  function finishAndSummarize() {
    if (!doku) return;
    const next: DokuData = JSON.parse(JSON.stringify(doku));
    next.logsByDate[dateISO] ??= { items: [] };
    const day: DokuDay = next.logsByDate[dateISO];
    day.finishedAt = new Date().toISOString();

    let asPlanned = 0,
      modified = 0,
      skipped = 0,
      extra = 0;
    const totalsByGroup: Record<string, any> = {};

    day.items.forEach((it) => {
      if (!it) return;
      if (it.status === "AS_PLANNED") asPlanned++;
      else if (it.status === "MODIFIED") modified++;
      else if (it.status === "SKIPPED") skipped++;
      else if (it.status === "EXTRA") extra++;

      const grp =
        it.actual?.einheit === "min" ||
        it.actual?.einheit === "km" ||
        it.actual?.einheit === "m"
          ? "Ausdauer"
          : "Kraft";

      totalsByGroup[grp] ??= {};

      if (grp === "Ausdauer") {
        if (it.actual?.menge) {
          totalsByGroup[grp].zeitMin =
            (totalsByGroup[grp].zeitMin ?? 0) +
            (it.actual.einheit === "min"
              ? Number(it.actual.menge)
              : 0);
        }
        if (it.actual?.strecke) {
          totalsByGroup[grp].streckeKm =
            (totalsByGroup[grp].streckeKm ?? 0) +
            Number(it.actual.strecke);
        }
      } else {
        if (it.actual?.reps) {
          totalsByGroup[grp].reps =
            (totalsByGroup[grp].reps ?? 0) +
            Number(it.actual.reps);
        }
      }
    });

    day.summary = { asPlanned, modified, skipped, extra, totalsByGroup };
    setDoku(next);
  }

  async function persist() {
    if (!doku || !athleteId) return;
    await saveDoku(athleteId, doku);
  }

  return {
    dateISO,
    setDateISO,
    athleteId,
    setAthleteId,
    athleteName,
    setAthleteName,
    planItems,
    doku,
    beginTraining,
    setItemStatus,
    addExtra,
    finishAndSummarize,
    persist,
  };
}
