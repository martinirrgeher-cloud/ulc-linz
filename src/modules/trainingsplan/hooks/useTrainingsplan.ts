import { useCallback, useEffect, useMemo, useState } from "react";
import DriveClient from "@/lib/drive/DriveClient";

/**
 * Types – nutze deine bestehenden Types, falls vorhanden.
 * Hier sind sie lokal nochmals definiert, um den Hook vollständig zu liefern.
 */
export type ISOWeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface WeekKey {
  isoWeek: number;
  year: number;
}

export interface PlanItem {
  id: string;
  name: string;
  wiederholungen?: number;
  distanz?: string;
  dauerSek?: number;
  stern?: number;
  notiz?: string;
}

export interface DayPlan {
  dateISO: string;          // YYYY-MM-DD
  items: PlanItem[];
}

export interface Trainingsplan {
  days: Record<ISOWeekDay, DayPlan>;
}

/** ISO-Kalender: Montag als 1..7 */
function getISODay(d: Date): number {
  const day = d.getDay(); // 0..6 So..Sa
  return day === 0 ? 7 : day; // 1..7 Mo..So
}

/** ISO-KW einer Datumskomponente berechnen */
function getISOWeek(d0: Date): number {
  const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
  // Donnerstag der aktuellen Woche finden (ISO-Definition)
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/** ISO-KW-Jahr eines Datums */
function getISOWeekYear(d0: Date): number {
  const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

/** Montag (ISO) einer gegebenen ISO-Woche/Jahr berechnen */
function getMondayOfISOWeek(isoWeek: number, year: number): Date {
  // Algorithmus: den Donnerstag der ISO-Woche bestimmen, dann zurück zum Montag
  const simple = new Date(Date.UTC(year, 0, 4 + (isoWeek - 1) * 7)); // Do der ISO-Woche
  const day = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - (day - 1)); // zurück bis Montag
  return monday;
}

function pad2(n: number) { return n.toString().padStart(2, "0"); }

/** leeren Wochenplan für gegebene ISO-Woche generieren (mit korrekten Datumsangaben) */
function makeEmptyWeek(isoWeek: number, year: number): Trainingsplan {
  const labels: ISOWeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const monday = getMondayOfISOWeek(isoWeek, year);
  const days: Record<ISOWeekDay, DayPlan> = {
    mon: { dateISO: "", items: [] },
    tue: { dateISO: "", items: [] },
    wed: { dateISO: "", items: [] },
    thu: { dateISO: "", items: [] },
    fri: { dateISO: "", items: [] },
    sat: { dateISO: "", items: [] },
    sun: { dateISO: "", items: [] },
  };
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = pad2(d.getUTCMonth() + 1);
    const dd = pad2(d.getUTCDate());
    const key = labels[i];
    days[key] = { dateISO: `${yyyy}-${mm}-${dd}`, items: [] };
  }
  return { days };
}

export default function useTrainingsplan(initial?: WeekKey) {
  const [week, setWeek] = useState<WeekKey>(() => {
    if (initial) return initial;
    const now = new Date();
    return { isoWeek: getISOWeek(now), year: getISOWeekYear(now) };
  });
  const [plan, setPlan] = useState<Trainingsplan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drive = new DriveClient();
  const folderId = import.meta.env.VITE_DRIVE_TRAININGSPLAN_FOLDER_ID as string | undefined;

  const filename = useMemo(() => {
    return `trainingsplan_${week.year}_kw${pad2(week.isoWeek)}.json`;
  }, [week]);

  const reload = useCallback(async () => {
    if (!folderId) {
      setError("VITE_DRIVE_TRAININGSPLAN_FOLDER_ID ist nicht gesetzt");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const file = await drive.findFileInFolderByName(folderId, filename);
      if (file) {
        const json = await drive.downloadJson(file.id);
        setPlan(json as Trainingsplan);
      } else {
        // neue Datei mit leerem Plan anlegen (keine Dummys – produktiver Startzustand)
        const empty = makeEmptyWeek(week.isoWeek, week.year);
        await drive.createJsonInFolder(folderId, filename, empty);
        setPlan(empty);
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [drive, folderId, filename, week.isoWeek, week.year]);

  useEffect(() => { void reload(); }, [reload]);

  const goPrevWeek = useCallback(() => {
    setWeek((w) => {
      // ISO: Jahrwechsel beachten
      const prev = new Date(getMondayOfISOWeek(w.isoWeek, w.year));
      prev.setUTCDate(prev.getUTCDate() - 7);
      return { isoWeek: getISOWeek(prev), year: getISOWeekYear(prev) };
    });
  }, []);

  const goNextWeek = useCallback(() => {
    setWeek((w) => {
      const next = new Date(getMondayOfISOWeek(w.isoWeek, w.year));
      next.setUTCDate(next.getUTCDate() + 7);
      return { isoWeek: getISOWeek(next), year: getISOWeekYear(next) };
    });
  }, []);

  /**
   * Speichert den Plan. Signatur kompatibel zu deinem PlanEditor:
   * savePlan(athletId, kw, jahr, nextPlan)
   * - athletId wird aktuell nicht zur Dateiauswahl benötigt, bleibt aber für API-Kompatibilität erhalten.
   * - kw/jahr werden gegen die aktuelle Woche validiert (Warnung bei Abweichung).
   */
  const savePlan = useCallback(async (athletId: string, kw: number, jahr: number, nextPlan: Trainingsplan) => {
    if (!folderId) throw new Error("VITE_DRIVE_TRAININGSPLAN_FOLDER_ID ist nicht gesetzt");
    if (!nextPlan || !nextPlan.days) throw new Error("Ungültiger Plan (missing days)");

    // falls kw/jahr vom Editor abweichen, speichern wir in die angezeigte Woche
    if (kw !== week.isoWeek || jahr !== week.year) {
      console.warn("[Trainingsplan] savePlan: KW/Jahr weichen ab. Es wird in die aktuelle Ansicht gespeichert:", week);
    }

    const file = await drive.findFileInFolderByName(folderId, filename);
    if (!file) {
      // Wenn Datei nicht existiert, erstellen wir sie
      await drive.createJsonInFolder(folderId, filename, nextPlan);
      setPlan(nextPlan);
      return;
    }
    await drive.updateJson(file.id, nextPlan);
    setPlan(nextPlan);
  }, [drive, folderId, filename, week]);

  return { week, plan, loading, error, goPrevWeek, goNextWeek, savePlan, reload };
}
