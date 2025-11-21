// src/modules/leistungsgruppe/trainingsplanung/hooks/useTrainingsplanung.ts
import { useEffect, useMemo, useState } from "react";
import {
  loadPlans,
  upsertAthleteDay,
  PlanItem,
  PlanDay,
  TrainingsplanData,
} from "../services/TrainingsplanungStore";
import { addDays, startOfISOWeek, toISODate, weekRangeFrom } from "../../common/date";
import { listExercisesLite, type ExerciseLite } from "@/modules/uebungskatalog/services/ExercisesLite";

export type SearchState = {
  text: string;
  haupt: string;
  unter: string;
};

export type CopyScope = "DAY" | "WEEK";

async function loadExercisesLiteSafe(): Promise<ExerciseLite[]> {
  const w: any = window as any;
  // Bevorzugt die globale Lite-Funktion, falls vorhanden
  try {
    if (w?.ULC?.listExercisesLite) {
      const arr = await w.ULC.listExercisesLite();
      if (Array.isArray(arr)) return arr;
    }
  } catch (err) {
    console.warn("Trainingsplanung: window.ULC.listExercisesLite fehlgeschlagen", err);
  }

  // Fallback: direkter Zugriff auf den Service
  try {
    return await listExercisesLite();
  } catch (err) {
    console.error("Trainingsplanung: listExercisesLite() fehlgeschlagen", err);
    return [];
  }
}

export function useTrainingsplanung() {
  const [dateISO, setDateISO] = useState<string>(() => toISODate(new Date()));
  const [plans, setPlans] = useState<TrainingsplanData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  const [athleteId, setAthleteId] = useState<string>("");
  const [athleteName, setAthleteName] = useState<string>("");

  const [allExercises, setAllExercises] = useState<ExerciseLite[]>([]);
  const [search, setSearch] = useState<SearchState>({
    text: "",
    haupt: "",
    unter: "",
  });
  const [onlyRegistered, setOnlyRegistered] = useState<boolean>(false);

  const [copyScope, setCopyScope] = useState<CopyScope>("DAY");
  const [copyToAthleteId, setCopyToAthleteId] = useState<string>("");
  const [copyToWeekOffset, setCopyToWeekOffset] = useState<number>(0);

  // Initiale Ladung der Pläne + Übungen + evtl. Athlet aus window.ULC
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [plansData, exercises] = await Promise.all([
          loadPlans(),
          loadExercisesLiteSafe(),
        ]);

        if (!cancelled) {
          setPlans(plansData);
          setAllExercises(exercises);
        }
      } catch (err) {
        console.error("Trainingsplanung: Initialisierung fehlgeschlagen", err);
        if (!cancelled) {
          setPlans({
            version: 1,
            updatedAt: new Date().toISOString(),
            plansByAthlete: {},
          });
          setAllExercises([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    // Athlet aus Anmeldung/Global in die Trainingsplanung übernehmen
    try {
      const w: any = window as any;
      if (w?.ULC?.currentAthlete) {
        const { id, name } = w.ULC.currentAthlete;
        if (id) setAthleteId(String(id));
        if (name) setAthleteName(String(name));
      }
    } catch (err) {
      console.warn("Trainingsplanung: Lesen von window.ULC.currentAthlete fehlgeschlagen", err);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const weekStartISO = useMemo(
    () => startOfISOWeek(new Date(dateISO + "T00:00:00")),
    [dateISO]
  );
  const weekDates = useMemo(() => weekRangeFrom(weekStartISO), [weekStartISO]);

  const currentDay: PlanDay = useMemo(() => {
    if (!athleteId || !plans) {
      return {
        order: [],
        items: {},
      };
    }
    const byAthlete = plans.plansByAthlete[athleteId] ?? {};
    const existing = byAthlete[dateISO];
    if (existing) {
      return {
        order: existing.order ?? [],
        items: existing.items ?? {},
        blocks: existing.blocks,
        blockOrder: existing.blockOrder,
      };
    }
    return {
      order: [],
      items: {},
    };
  }, [plans, athleteId, dateISO]);

  function updateCurrentDay(mutator: (draft: PlanDay) => void) {
    if (!athleteId) return;

    setPlans((prev) => {
      const base: TrainingsplanData =
        prev ??
        ({
          version: 1,
          updatedAt: new Date().toISOString(),
          plansByAthlete: {},
        } as TrainingsplanData);

      const plansByAthlete: TrainingsplanData["plansByAthlete"] = {
        ...base.plansByAthlete,
      };
      const daysForAthlete: Record<string, PlanDay> = {
        ...(plansByAthlete[athleteId] ?? {}),
      };

      const existing = daysForAthlete[dateISO] ?? {
        order: [],
        items: {},
      };

      const draft: PlanDay = {
        order: [...(existing.order ?? [])],
        items: { ...(existing.items ?? {}) },
        blocks: existing.blocks ? { ...existing.blocks } : undefined,
        blockOrder: existing.blockOrder ? [...existing.blockOrder] : undefined,
      };

      mutator(draft);

      daysForAthlete[dateISO] = draft;
      plansByAthlete[athleteId] = daysForAthlete;

      return {
        ...base,
        updatedAt: new Date().toISOString(),
        plansByAthlete,
      };
    });

    setDirty(true);
  }

  function updateItem(id: string, next: PlanItem) {
    updateCurrentDay((draft) => {
      draft.items[id] = next;
    });
  }

  async function save() {
    if (!athleteId || !plans) return;
    const byAthlete = plans.plansByAthlete[athleteId] ?? {};
    const day = byAthlete[dateISO] ?? {
      order: [],
      items: {},
    };

    setSaving(true);
    try {
      await upsertAthleteDay(athleteId, dateISO, day);
      setDirty(false);
    } catch (err) {
      console.error("Trainingsplanung: Speichern fehlgeschlagen", err);
    } finally {
      setSaving(false);
    }
  }

  const filteredExercises = useMemo(() => {
    const txt = search.text.trim().toLowerCase();
    const haupt = search.haupt.trim().toLowerCase();
    const unter = search.unter.trim().toLowerCase();

    return allExercises.filter((ex) => {
      const name = (ex.name ?? "").toLowerCase();
      const h = (ex.haupt ?? "").toLowerCase();
      const u = (ex.unter ?? "").toLowerCase();

      if (txt && !(`${name} ${h} ${u}`.includes(txt))) return false;
      if (haupt && !h.includes(haupt)) return false;
      if (unter && !u.includes(unter)) return false;

      return true;
    });
  }, [allExercises, search]);

  async function copyPlanTo() {
    if (!plans) return;
    if (!athleteId) return;
    if (!copyToAthleteId) return;

    const srcData = plans;
    const srcByAthlete = srcData.plansByAthlete[athleteId] ?? {};
    const targetByAthlete = {
      ...(srcData.plansByAthlete[copyToAthleteId] ?? {}),
    };

    const srcWeekStart = startOfISOWeek(new Date(dateISO + "T00:00:00"));
    const srcWeekStartIso = toISODate(new Date(srcWeekStart));
    const targetWeekStartIso =
      copyScope === "WEEK"
        ? addDays(srcWeekStartIso, copyToWeekOffset * 7)
        : srcWeekStartIso;

    if (copyScope === "DAY") {
      const srcDay = srcByAthlete[dateISO];
      if (!srcDay) return;

      targetByAthlete[dateISO] = JSON.parse(JSON.stringify(srcDay));
    } else {
      const srcWeekDates = weekRangeFrom(srcWeekStartIso);
      const targetWeekDates = weekRangeFrom(targetWeekStartIso);

      srcWeekDates.forEach((srcDate, idx) => {
        const srcDay = srcByAthlete[srcDate];
        if (!srcDay) return;
        const tgtDate = targetWeekDates[idx];
        targetByAthlete[tgtDate] = JSON.parse(JSON.stringify(srcDay));
      });
    }

    const next: TrainingsplanData = {
      ...srcData,
      updatedAt: new Date().toISOString(),
      plansByAthlete: {
        ...srcData.plansByAthlete,
        [copyToAthleteId]: targetByAthlete,
      },
    };
    setPlans(next);
    setDirty(true);
  }

  const canSave = !!athleteId && !loading && !saving;

  return {
    dateISO,
    setDateISO,
    athleteId,
    setAthleteId,
    athleteName,
    setAthleteName,
    planDay: currentDay,
    loading,
    saving,
    dirty,
    canSave,
    allExercises,
    search,
    setSearch,
    onlyRegistered,
    setOnlyRegistered,
    weekStartISO,
    weekDates,
    updateDay: updateCurrentDay,
    updateItem,
    save,
    filteredExercises,
    copyScope,
    setCopyScope,
    copyToAthleteId,
    setCopyToAthleteId,
    copyToWeekOffset,
    setCopyToWeekOffset,
    copyPlanTo,
  };
}
