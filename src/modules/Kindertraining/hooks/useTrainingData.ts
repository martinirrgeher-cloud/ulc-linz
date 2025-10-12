import { useEffect, useState } from "react";
import { loadTrainingState, saveTrainingState } from "../../../lib/training/kindertrainingData";

export interface Person {
  firstName: string;
  lastName: string;
  active: boolean;
}

export interface TrainingData {
  people: Person[];
  records: Record<string, Record<string, boolean>>;
  notes: Record<string, string>;
  weekdaysByMonth?: Record<string, number[]>; // 🆕 persistierte Wochentage pro Monat
}

export function useTrainingData() {
  const [data, setData] = useState<TrainingData>({
    people: [],
    records: {},
    notes: {},
    weekdaysByMonth: {},
  });

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadTrainingState();
        if (loaded) {
          let people = loaded.people || [];
          // Migration: name -> first/last
          people = people.map((p: any) => {
            if (p.firstName !== undefined && p.lastName !== undefined) return p;
            const parts = (p.name || "").trim().split(" ");
            return {
              firstName: parts[0] || "",
              lastName: parts.slice(1).join(" "),
              active: p.active ?? true,
            };
          });

          setData({
            people,
            records: loaded.records || {},
            notes: loaded.notes || {},
            weekdaysByMonth: loaded.weekdaysByMonth || {},
          });
        }
      } catch (e) {
        console.error("❌ Fehler beim Laden der Trainingsdaten:", e);
      }
    })();
  }, []);

  const update = (updater: (prev: TrainingData) => TrainingData) => {
    setData((prev) => {
      const next = updater(prev);
      saveTrainingState(next);
      return next;
    });
  };

  return { data, update };
}
