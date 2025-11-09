// src/modules/leistungsgruppe/anmeldung/hooks/useAnmeldung.ts
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ath, anm] = await Promise.all([loadAthleten(), loadAnmeldung()]);
      setAthletes(ath.filter(a => a.active !== false));
      setStatuses(anm.statuses || {});
      setNotes(anm.notes || {});
    } catch (e: any) {
      setError(e?.message || "Laden fehlgeschlagen");
      console.error("useAnmeldung load error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const persist = useCallback(async (nextStatuses: Record<string, DayStatus>, nextNotes: Record<string, string>) => {
    try {
      await saveAnmeldung({ statuses: nextStatuses, notes: nextNotes });
    } catch (e: any) {
      console.error("Speichern fehlgeschlagen", e);
      setError(e?.message || "Speichern fehlgeschlagen");
    }
  }, []);

  const setStatus = useCallback((athleteId: string, isoDate: string, s: DayStatus) => {
    setStatuses(prev => {
      const next = { ...prev };
      const key = `${athleteId}:${isoDate}`;
      if (s === null) delete next[key];
      else next[key] = s;
      // persist with current notes
      // we don't await here to keep UI snappy
      persist(next, notes);
      return next;
    });
  }, [notes, persist]);

  const setNote = useCallback((athleteId: string, isoDate: string, text: string) => {
    setNotes(prev => {
      const next = { ...prev };
      const key = `${athleteId}:${isoDate}`;
      if (!text) delete next[key];
      else next[key] = text;
      // persist with current statuses
      persist(statuses, next);
      return next;
    });
  }, [statuses, persist]);

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
