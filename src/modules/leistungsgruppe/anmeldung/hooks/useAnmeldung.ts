// src/modules/leistungsgruppe/anmeldung/hooks/useAnmeldung.ts
import { useCallback, useEffect, useState } from "react";
import type { DayStatus } from "../services/AnmeldungStore";
import { loadAnmeldung, saveAnmeldung } from "../services/AnmeldungStore";
import { loadAthleten } from "@/modules/athleten/services/AthletenStore";
import { startOfISOWeek, getDaysOfWeek } from "../utils/weekUtils";

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

      setAthletes(safeAthletes);
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

  /**
   * Speichert den aktuellen Stand und ergänzt für die aktuelle Woche
   * explizit alle fehlenden Tage mit Status "NO".
   *
   * Dadurch werden in der Übersicht wirklich alle Tage (auch die
   * "nie angeklickten") als NEIN im JSON gespeichert und können z.B.
   * rot markiert werden.
   */
  const saveAll = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const baseWeek = weekStart ?? startOfISOWeek(new Date());
      const days = getDaysOfWeek(baseWeek);

      // Kopie des aktuellen Status-Objekts, auf dem wir arbeiten
      const nextStatuses: Record<string, DayStatus> = { ...statuses };

      const aths = Array.isArray(athletes) ? athletes : [];
      for (const a of aths) {
        if (!a.id) continue;
        for (const d of days) {
          const key = `${a.id}:${d.isoDate}`;
          if (nextStatuses[key] == null) {
            // bisher nie gesetzt -> explizit als "NO" speichern
            nextStatuses[key] = "NO";
          }
        }
      }

      await saveAnmeldung({
        statuses: nextStatuses,
        notes,
      });

      // Lokalen State aktualisieren, damit UI mit dem gespeicherten Stand übereinstimmt
      setStatuses(nextStatuses);
    } catch (err) {
      console.error("useAnmeldung: Speichern fehlgeschlagen", err);
      setSaveError("Fehler beim Speichern der Anmeldedaten.");
    } finally {
      setSaving(false);
    }
  }, [weekStart, statuses, notes, athletes]);

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
