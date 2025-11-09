import { useCallback, useEffect, useMemo, useState } from "react";
import DriveClient from "@/modules/trainingsplan/services/TrainingsplanStore";
import type { ExerciseRef, WeekKey } from "../types/TrainingsplanTypes";

export type ISOWeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DayPlan {
  dateISO: string;
  items: ExerciseRef[];
}

export interface Trainingsplan {
  key: WeekKey;
  version: number;
  updatedAt: string;
  days: Record<ISOWeekDay, DayPlan>;
}

/** Hilfsfunktionen **/
function pad2(n: number) { return n.toString().padStart(2, "0"); }

function getISOWeek(d0: Date): number {
  const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOWeekYear(d0: Date): number {
  const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

function getMondayOfISOWeek(isoWeek: number, year: number): Date {
  const simple = new Date(Date.UTC(year, 0, 4 + (isoWeek - 1) * 7));
  const day = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - (day - 1));
  return monday;
}

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
  return {
    key: { isoWeek, year },
    version: 1,
    updatedAt: new Date().toISOString(),
    days,
  };
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

  const savePlan = useCallback(async (athletId: string, kw: number, jahr: number, nextPlan: Trainingsplan) => {
    if (!folderId) throw new Error("VITE_DRIVE_TRAININGSPLAN_FOLDER_ID ist nicht gesetzt");
    if (!nextPlan || !nextPlan.days) throw new Error("Ungültiger Plan (missing days)");

    const updatedPlan: Trainingsplan = {
      ...nextPlan,
      key: { isoWeek: week.isoWeek, year: week.year },
      version: (nextPlan.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    const file = await drive.findFileInFolderByName(folderId, filename);
    if (!file) {
      await drive.createJsonInFolder(folderId, filename, updatedPlan);
      setPlan(updatedPlan);
      return;
    }
    await drive.updateJson(file.id, updatedPlan);
    setPlan(updatedPlan);
  }, [drive, folderId, filename, week]);

  return { week, plan, loading, error, goPrevWeek, goNextWeek, savePlan, reload };
}
