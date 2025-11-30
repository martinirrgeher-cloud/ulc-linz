// src/modules/leistungsgruppe/trainingsdoku/hooks/useTrainingsdokuForAthlete.ts
import { useEffect, useMemo, useState } from "react";
import { toISODate } from "../../common/date";
import {
  getAthleteDay,
  type PlanDay,
} from "../../trainingsplanung/services/TrainingsplanungStore";
import {
  createInitialDocFromPlan,
  loadDayDoc,
  upsertDayDoc,
  type TrainingDayDoc,
  type TrainingDocBlock,
  type TrainingDocItem,
} from "../services/TrainingsdokuStore";

type UseTrainingsdokuOptions = {
  initialAthleteId?: string;
  initialDate?: Date;
};

export type TrainingDocBlockView = {
  block: TrainingDocBlock;
  items: TrainingDocItem[];
};

export function useTrainingsdokuForAthlete(
  options: UseTrainingsdokuOptions = {}
) {
  const [athleteId, setAthleteId] = useState<string>(
    options.initialAthleteId ?? ""
  );
  const [dateISO, setDateISO] = useState<string>(() =>
    options.initialDate ? toISODate(options.initialDate) : toISODate(new Date())
  );

  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [doc, setDoc] = useState<TrainingDayDoc | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Athlet aus window.ULC übernehmen, falls nicht explizit gesetzt
  useEffect(() => {
    if (athleteId) return;

    try {
      const w = window as any;
      const current = w?.ULC?.currentAthlete;
      if (current) {
        const id = current.id ?? current.athleteId;
        if (id != null) {
          setAthleteId(String(id));
        }
      }
    } catch (err) {
      console.warn(
        "Trainingsdoku: Lesen von window.ULC.currentAthlete fehlgeschlagen",
        err
      );
    }
  }, [athleteId]);

  // Plan + bestehende Doku laden oder initiale Doku aus dem Plan ableiten
  useEffect(() => {
    if (!athleteId || !dateISO) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [plan, existingDoc] = await Promise.all([
          getAthleteDay(athleteId, dateISO),
          loadDayDoc(athleteId, dateISO),
        ]);

        if (cancelled) return;

        setPlanDay(plan);

        if (existingDoc) {
          setDoc(existingDoc);
        } else if (plan) {
          const initial = createInitialDocFromPlan(athleteId, dateISO, plan);
          setDoc(initial);
        } else {
          setDoc(null);
        }

        setDirty(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Trainingsdoku: Laden fehlgeschlagen", err);
          setError(err?.message ?? String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [athleteId, dateISO]);

  function ensureDoc(): TrainingDayDoc | null {
    if (doc) return doc;
    if (!planDay || !athleteId || !dateISO) return null;
    const initial = createInitialDocFromPlan(athleteId, dateISO, planDay);
    setDoc(initial);
    setDirty(true);
    return initial;
  }

  function updateDoc(mutator: (draft: TrainingDayDoc) => void) {
    setDoc((prev) => {
      let base = prev;
      if (!base) {
        if (!planDay || !athleteId || !dateISO) {
          return prev;
        }
        base = createInitialDocFromPlan(athleteId, dateISO, planDay);
      }

      const draft: TrainingDayDoc = JSON.parse(JSON.stringify(base));
      mutator(draft);
      draft.updatedAt = new Date().toISOString();
      setDirty(true);
      return draft;
    });
  }

  async function save() {
    if (!doc || !athleteId) return;
    setSaving(true);
    setError(null);
    try {
      await upsertDayDoc(doc);
      setDirty(false);
    } catch (err: any) {
      console.error("Trainingsdoku: Speichern fehlgeschlagen", err);
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  // einfacher Autosave mit leichter Verzögerung
  useEffect(() => {
    if (!dirty || !doc) return;
    const handle = window.setTimeout(() => {
      void save();
    }, 1000);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, doc]);

  const blockViews: TrainingDocBlockView[] = useMemo(() => {
    if (!doc) return [];
    return doc.blocks.map((block) => ({
      block,
      items: block.itemOrder
        .map((id) => block.items[id])
        .filter((x): x is TrainingDocItem => Boolean(x)),
    }));
  }, [doc]);

  return {
    athleteId,
    setAthleteId,
    dateISO,
    setDateISO,
    planDay,
    doc,
    blockViews,
    loading,
    saving,
    dirty,
    error,
    ensureDoc,
    updateDoc,
    save,
  };
}
