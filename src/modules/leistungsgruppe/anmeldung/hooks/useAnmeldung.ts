// src/modules/leistungsgruppe/anmeldung/hooks/useAnmeldung.ts
import { useCallback, useEffect, useState } from "react";
import type { DayStatus } from "../services/AnmeldungStore";
import { loadAnmeldung, saveAnmeldung } from "../services/AnmeldungStore";
import { loadAthleten } from "@/modules/athleten/services/AthletenStore";
import { startOfISOWeek } from "../utils/weekUtils";

type Athlete = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  active?: boolean;
  altersklasse?: string;
  geburtsjahr?: number;
  info?: string;
};

export function useAnmeldung() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [statuses, setStatuses] = useState<Record<string, DayStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [weekStart, setWeekStart] = useState<Date>(() => startOfISOWeek(new Date()));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [athList, anmeldung] = await Promise.all([
        loadAthleten(),
        loadAnmeldung(),
      ]);

      setAthletes(Array.isArray(athList) ? athList : []);
      setStatuses(
        anmeldung && anmeldung.statuses && typeof anmeldung.statuses === "object"
          ? anmeldung.statuses
          : {}
      );
      setNotes(
        anmeldung && anmeldung.notes && typeof anmeldung.notes === "object"
          ? anmeldung.notes
          : {}
      );
      setDirty(false);
    } catch (err) {
      console.error("useAnmeldung: Laden fehlgeschlagen", err);
      setError("Fehler beim Laden der Anmeldedaten.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const persist = useCallback(
    async (nextStatuses: Record<string, DayStatus>, nextNotes: Record<string, string>) => {
      try {
        await saveAnmeldung({
          statuses: nextStatuses,
          notes: nextNotes,
        });
      } catch (err) {
        console.error("useAnmeldung: Speichern fehlgeschlagen", err);
        setError("Fehler beim Speichern der Anmeldedaten.");
      }
    },
    []
  );

  // Auto-Save mit kleinem Delay
  useEffect(() => {
    if (!dirty) return;
    const handle = window.setTimeout(() => {
      setDirty(false);
      void persist(statuses, notes);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [dirty, statuses, notes, persist]);

  const setStatus = useCallback(
    (athleteId: string, isoDate: string, status: DayStatus) => {
      if (!athleteId || !isoDate) return;
      const key = `${athleteId}:${isoDate}`;

      setStatuses((prev) => {
        const next = { ...prev };
        if (status === null) {
          delete next[key];
        } else {
          next[key] = status;
        }
        return next;
      });
      setDirty(true);
    },
    []
  );

  const setNote = useCallback(
    (athleteId: string, isoDate: string, note: string) => {
      if (!athleteId || !isoDate) return;
      const key = `${athleteId}:${isoDate}`;

      setNotes((prev) => {
        const next = { ...prev };
        const trimmed = note.trim();
        if (!trimmed) {
          delete next[key];
        } else {
          next[key] = trimmed;
        }
        return next;
      });
      setDirty(true);
    },
    []
  );

  return {
    athletes,
    statuses,
    notes,
    weekStart,
    setWeekStart,
    setStatus,
    setNote,
    loading,
    error,
    reload: loadAll,
  };
}
