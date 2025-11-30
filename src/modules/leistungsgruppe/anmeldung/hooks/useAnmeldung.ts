// src/modules/leistungsgruppe/anmeldung/hooks/useAnmeldung.ts
import { useCallback, useEffect, useState } from "react";
import type { DayStatus, AnmeldungData } from "../services/AnmeldungStore";
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

export interface UseAnmeldungResult {
  athletes: Athlete[];
  statuses: Record<string, DayStatus>;
  notes: Record<string, string>;
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  setStatus: (athleteId: string, isoDate: string, status: DayStatus) => void;
  setNote: (athleteId: string, isoDate: string, note: string) => void;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  saveAll: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useAnmeldung(): UseAnmeldungResult {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [statuses, setStatuses] = useState<Record<string, DayStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [weekStart, setWeekStart] = useState<Date>(() => startOfISOWeek(new Date()));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [athList, anmeldung] = await Promise.all([loadAthleten(), loadAnmeldung()]);

      const safeAthletes: Athlete[] = Array.isArray(athList) ? athList : [];

      // Sortierung nach Nachname, dann Vorname
      safeAthletes.sort((a, b) => {
        const lastA = (a.lastName || a.name || "").toLocaleLowerCase();
        const lastB = (b.lastName || b.name || "").toLocaleLowerCase();
        if (lastA < lastB) return -1;
        if (lastA > lastB) return 1;
        const firstA = (a.firstName || "").toLocaleLowerCase();
        const firstB = (b.firstName || "").toLocaleLowerCase();
        if (firstA < firstB) return -1;
        if (firstA > firstB) return 1;
        return 0;
      });

      const data: AnmeldungData = anmeldung || { statuses: {}, notes: {} };

      setAthletes(safeAthletes);
      setStatuses(
        data && data.statuses && typeof data.statuses === "object"
          ? data.statuses
          : {}
      );
      setNotes(
        data && data.notes && typeof data.notes === "object"
          ? data.notes
          : {}
      );
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
    },
    []
  );

  const setNote = useCallback(
    (athleteId: string, isoDate: string, note: string) => {
      if (!athleteId || !isoDate) return;
      const key = `${athleteId}:${isoDate}`;
      const trimmed = note.trim();

      setNotes((prev) => {
        const next = { ...prev };
        if (!trimmed) {
          delete next[key];
        } else {
          next[key] = trimmed;
        }
        return next;
      });
    },
    []
  );

  const saveAll = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveAnmeldung({
        statuses,
        notes,
      });
    } catch (err) {
      console.error("useAnmeldung: Speichern fehlgeschlagen", err);
      setSaveError("Fehler beim Speichern der Anmeldedaten.");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [statuses, notes]);

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
    saving,
    saveError,
    saveAll,
    reload: loadAll,
  };
}
