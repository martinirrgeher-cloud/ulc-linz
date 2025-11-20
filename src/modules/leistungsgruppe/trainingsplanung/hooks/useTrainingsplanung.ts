// src/modules/leistungsgruppe/trainingsplanung/hooks/useTrainingsplanung.ts
import { useEffect, useMemo, useState } from "react";
import {
  loadPlans,
  upsertAthleteDay,
  PlanItem,
  PlanDay,
} from "../services/TrainingsplanungStore";
import { loadAnmeldung, DayStatus } from "../../anmeldung/services/AnmeldungStore";
import {
  addDays,
  startOfISOWeek,
  toISODate,
  weekRangeFrom,
} from "../../common/date";

export type ExerciseLite = {
  id: string;
  name: string;
  haupt?: string | null;
  unter?: string | null;
  reps?: number | null;
  menge?: number | null;
  einheit?: string | null;
};

type SearchState = {
  text: string;
  haupt: string;
  unter: string;
};

type PlansByAthlete = Record<string, Record<string, PlanDay>>;

function createEmptyDay(): PlanDay {
  return {
    order: [],
    items: {},
  };
}

/**
 * Hook für das Modul Trainingsplanung.
 *
 * - Lädt Pläne aus Google Drive
 * - Lädt (leichtgewichtige) Übungen aus dem Übungskatalog über window.ULC.listExercisesLite()
 * - Bindet die Anmeldung-Status ein (für "nur Tage mit JA" – UI kommt im nächsten Schritt)
 * - Stellt Helfer für Planbearbeitung und Kopieren bereit
 */
export function useTrainingsplanung() {
  const today = toISODate(new Date());

  const [dateISO, setDateISO] = useState<string>(today);
  const [athleteId, setAthleteId] = useState<string>("");
  const [athleteName, setAthleteName] = useState<string>("");

  const [plansByAthlete, setPlansByAthlete] = useState<PlansByAthlete>({});
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);

  const [allExercises, setAllExercises] = useState<ExerciseLite[]>([]);
  const [search, setSearch] = useState<SearchState>({ text: "", haupt: "", unter: "" });

  const [onlyRegistered, setOnlyRegistered] = useState<boolean>(false);
  const [statuses, setStatuses] = useState<Record<string, DayStatus>>({});

  // -------------------------------------------------
  // Initial: Athlet aus globalem Kontext übernehmen (z.B. aus Anmeldung)
  // -------------------------------------------------
  useEffect(() => {
    const w: any = (window as any);
    if (w?.ULC?.currentAthlete) {
      const { id, name } = w.ULC.currentAthlete;
      if (id) setAthleteId(String(id));
      if (name) setAthleteName(String(name));
    }
  }, []);

  // -------------------------------------------------
  // Pläne laden
  // -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadPlans();
        if (!cancelled) {
          setPlansByAthlete(data.plansByAthlete ?? {});
        }
      } catch (err) {
        console.error("Trainingsplanung: loadPlans failed", err);
        if (!cancelled) {
          setPlansByAthlete({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------
  // Anmeldung laden (für spätere Filter "nur Tage mit JA")
  // -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const anm = await loadAnmeldung();
        if (!cancelled && anm?.statuses) {
          setStatuses(anm.statuses);
        }
      } catch (err) {
        console.error("Trainingsplanung: loadAnmeldung failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------
  // Übungen laden (leichtgewichtige Liste – über globales window.ULC)
  // -------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadExercises() {
      try {
        const w: any = (window as any);
        if (w?.ULC?.listExercisesLite && typeof w.ULC.listExercisesLite === "function") {
          const list: ExerciseLite[] = await w.ULC.listExercisesLite();
          if (!cancelled) {
            setAllExercises(Array.isArray(list) ? list : []);
          }
        } else {
          // Fallback: direkt importieren, falls global noch nicht gesetzt
          const mod = await import(
            /* @vite-ignore */ "@/modules/uebungskatalog/services/ExercisesLite"
          );
          const list: ExerciseLite[] = await mod.listExercisesLite();
          if (!cancelled) {
            setAllExercises(Array.isArray(list) ? list : []);
          }
        }
      } catch (err) {
        console.error("Trainingsplanung: listExercisesLite failed", err);
        if (!cancelled) {
          setAllExercises([]);
        }
      }
    }

    loadExercises();

    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------
  // Aktuellen Tagesplan ableiten, wenn Athlet / Datum oder Pläne sich ändern
  // -------------------------------------------------
  useEffect(() => {
    if (!athleteId || !dateISO) {
      setPlanDay(null);
      return;
    }
    const perAthlete = plansByAthlete[athleteId] ?? {};
    const existing = perAthlete[dateISO];
    if (existing) {
      setPlanDay(existing);
    } else {
      setPlanDay(createEmptyDay());
    }
  }, [athleteId, dateISO, plansByAthlete]);

  // -------------------------------------------------
  // Helfer: Woche ausgehend vom aktuellen Datum berechnen
  // -------------------------------------------------
  function weekFromDate(): string[] {
    const base = dateISO || today;
    const d = new Date(base + "T00:00:00");
    const isoWeekStart = startOfISOWeek(d);
    const week = weekRangeFrom(isoWeekStart);

    if (!onlyRegistered || !athleteId) {
      return week;
    }

    // Nur Tage mit Anmeldung = "YES" für diesen Athleten
    return week.filter((iso) => statuses[`${athleteId}:${iso}`] === "YES");
  }

  // -------------------------------------------------
  // Plan-Manipulation
  // -------------------------------------------------
  function addExercise(ex: ExerciseLite) {
    if (!planDay) return;
    const id = `it-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const baseTarget = {
      reps: ex.reps ?? null,
      menge: ex.menge ?? null,
      einheit: ex.einheit ?? null,
    };

    const item: PlanItem = {
      exerciseId: ex.id,
      nameCache: ex.name,
      groupCache: { haupt: ex.haupt ?? undefined, unter: ex.unter ?? undefined },
      default: baseTarget,
      target: { ...baseTarget },
      pauseSec: null,
      comment: "",
    };

    const next: PlanDay = {
      ...planDay,
      order: [...planDay.order, id],
      items: {
        ...planDay.items,
        [id]: item,
      },
    };
    setPlanDay(next);
  }

  function updateItem(id: string, patch: Partial<PlanItem>) {
    if (!planDay) return;
    if (!planDay.items[id]) return;
    const nextItems: Record<string, PlanItem> = {
      ...planDay.items,
      [id]: { ...planDay.items[id], ...patch },
    };
    setPlanDay({ ...planDay, items: nextItems });
  }

  function removeItem(id: string) {
    if (!planDay) return;
    if (!planDay.items[id]) return;
    const nextItems = { ...planDay.items };
    delete nextItems[id];
    const nextOrder = planDay.order.filter((x) => x !== id);
    setPlanDay({ ...planDay, items: nextItems, order: nextOrder });
  }

  function moveItem(id: string, dir: -1 | 1) {
    if (!planDay) return;
    const idx = planDay.order.indexOf(id);
    if (idx < 0) return;
    const newIdx = Math.max(0, Math.min(planDay.order.length - 1, idx + dir));
    if (newIdx === idx) return;
    const arr = [...planDay.order];
    arr.splice(idx, 1);
    arr.splice(newIdx, 0, id);
    setPlanDay({ ...planDay, order: arr });
  }

  async function save() {
    if (!athleteId || !dateISO || !planDay) return;
    await upsertAthleteDay(athleteId, dateISO, planDay);
    // lokale Plans-Struktur aktualisieren, damit alles konsistent bleibt
    setPlansByAthlete((prev) => {
      const copy: PlansByAthlete = { ...prev };
      const perAthlete = { ...(copy[athleteId] ?? {}) };
      perAthlete[dateISO] = planDay;
      copy[athleteId] = perAthlete;
      return copy;
    });
  }

  /**
   * Plan auf andere Athleten / andere Tage kopieren.
   * Signature ist so gewählt, dass die bestehende Seite
   * `copyPlanTo(ids, dates)()` aufrufen kann.
   */
  function copyPlanTo(targetAthleteIds: string[], targetDates: string[]) {
    return async () => {
      if (!planDay) return;
      const ids = (targetAthleteIds || []).filter(Boolean);
      const dates = (targetDates || []).filter(Boolean);
      if (!ids.length || !dates.length) return;

      for (const aid of ids) {
        for (const iso of dates) {
          await upsertAthleteDay(aid, iso, planDay);
        }
      }
    };
  }

  // -------------------------------------------------
  // Übungssuche
  // -------------------------------------------------
  const filteredExercises = useMemo(() => {
    const txt = search.text.trim().toLowerCase();
    if (!txt) return allExercises;

    return allExercises.filter((ex) => {
      const hay = [
        ex.name ?? "",
        ex.haupt ?? "",
        ex.unter ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(txt);
    });
  }, [allExercises, search]);

  return {
    dateISO,
    setDateISO,
    athleteId,
    setAthleteId,
    athleteName,
    setAthleteName,
    planDay,
    setPlanDay,
    addExercise,
    updateItem,
    removeItem,
    moveItem,
    save,
    filteredExercises,
    search,
    setSearch,
    onlyRegistered,
    setOnlyRegistered,
    copyPlanTo,
    weekFromDate,
  };
}
