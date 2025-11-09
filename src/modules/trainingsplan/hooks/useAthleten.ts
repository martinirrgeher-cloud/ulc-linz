import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Trainingsplan,
  WeekKey,
  ISOWeekDay,
  WeekDays,
  ExerciseRef,
  LoadState,
  SaveState,
} from "../types/TrainingsplanTypes";
import DriveClient from "@/lib/drive/DriveClientCore";

// ---------- ISO-Woche Utils (ohne externe Abhängigkeiten) ----------
function toDateOnlyISO(d: Date): string {
  const z = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return z.toISOString().slice(0, 10);
}

// ISO-Montag einer Kalenderwoche ermitteln
function getMondayOfISOWeek(year: number, week: number): Date {
  // Quelle: ISO-8601: Woche beginnt Montag, KW1 enthält den 4. Januar
  const simple = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = simple.getUTCDay() || 7; // 1..7 (So->7)
  simple.setUTCDate(simple.getUTCDate() + (week - 1) * 7 - (dayOfWeek - 1));
  return simple; // Montag 00:00 UTC
}

// Aktuelle ISO-Woche + ISO-Jahr
function currentISOWeek(): WeekKey {
  const d = new Date();
  // Donnerstag als Referenztag, um KW korrekt zu bestimmen
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return { year: tmp.getUTCFullYear(), isoWeek: week };
}

function buildEmptyWeek(key: WeekKey): Trainingsplan {
  const mon = getMondayOfISOWeek(key.year, key.isoWeek);
  const days: ISOWeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const byOffset: Record<ISOWeekDay, number> = {
    mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
  };
  const weekDays = days.reduce((acc, dkey) => {
    const dt = new Date(mon);
    dt.setUTCDate(mon.getUTCDate() + byOffset[dkey]);
    acc[dkey] = { dateISO: toDateOnlyISO(dt), items: [] };
    return acc;
  }, {} as WeekDays);

  return {
    key,
    version: 1,
    updatedAt: new Date().toISOString(),
    days: weekDays,
  };
}

// ---------- Drive-Namenskonvention ----------
function fileNameFor(key: WeekKey): string {
  return `trainingsplan_${key.year}_${String(key.isoWeek).padStart(2, "0")}.json`;
}

function requireEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) {
    throw new Error(`Fehlende Umgebungsvariable ${name}. Bitte in .env setzen.`);
  }
  return String(v);
}

// Erwartet: VITE_DRIVE_TRAININGSPLAN_FOLDER_ID (Ordner mit JSON-Dateien je Woche)
const FOLDER_ID_ENV = "VITE_DRIVE_TRAININGSPLAN_FOLDER_ID";

// ---------- Hook ----------
export interface UseTrainingsplan {
  week: WeekKey;
  plan?: Trainingsplan;
  load: LoadState;
  save: SaveState;
  goPrevWeek: () => void;
  goNextWeek: () => void;
  reload: () => Promise<void>;
  addExercise: (day: ISOWeekDay, ex: ExerciseRef) => void;
  removeExercise: (day: ISOWeekDay, id: string) => void;
  updateExercise: (day: ISOWeekDay, id: string, patch: Partial<ExerciseRef>) => void;
  moveExercise: (from: ISOWeekDay, to: ISOWeekDay, id: string, toIndex?: number) => void;
  setDayNote: (day: ISOWeekDay, note: string) => void;
  saveNow: () => Promise<void>;
  copyFromPreviousWeek: () => Promise<void>;
}

export default function useTrainingsplan(): UseTrainingsplan {
  const [week, setWeek] = useState<WeekKey>(() => currentISOWeek());
  const [plan, setPlan] = useState<Trainingsplan>();
  const [load, setLoad] = useState<LoadState>({ loading: true });
  const [save, setSave] = useState<SaveState>({ saving: false });
  const fileIdRef = useRef<string | null>(null);

  const folderId = useMemo(() => {
    try { return requireEnv(FOLDER_ID_ENV); }
    catch (e) {
      setLoad({ loading: false, error: (e as Error).message });
      return undefined;
    }
  }, []);

  const drive = useMemo(() => new DriveClient(), []);

  const locateFileId = useCallback(async (wk: WeekKey): Promise<string | null> => {
    if (!folderId) return null;
    const name = fileNameFor(wk);
    const found = await drive.findFileInFolderByName(folderId, name);
    return found?.id ?? null;
  }, [drive, folderId]);

  const downloadWeek = useCallback(async (wk: WeekKey): Promise<Trainingsplan> => {
    const id = await locateFileId(wk);
    if (id) {
      const json = await drive.downloadJson(id);
      // strikte Validierung minimal: key muss passen, sonst neu aufbauen
      if (json?.key?.year === wk.year && json?.key?.isoWeek === wk.isoWeek) {
        fileIdRef.current = id;
        return json as Trainingsplan;
      }
    }
    fileIdRef.current = null;
    return buildEmptyWeek(wk);
  }, [locateFileId, drive]);

  const persist = useCallback(async (tp: Trainingsplan): Promise<void> => {
    if (!folderId) throw new Error("Kein Folder-ID konfiguriert.");
    const name = fileNameFor(tp.key);
    if (fileIdRef.current) {
      await drive.updateJson(fileIdRef.current, tp, name);
    } else {
      const created = await drive.createJsonInFolder(folderId, name, tp);
      fileIdRef.current = created.id;
    }
  }, [drive, folderId]);

  const reload = useCallback(async () => {
    setLoad({ loading: true });
    try {
      const data = await downloadWeek(week);
      setPlan(data);
      setLoad({ loading: false });
    } catch (e) {
      setLoad({ loading: false, error: (e as Error).message });
    }
  }, [downloadWeek, week]);

  useEffect(() => { void reload(); }, [reload]);

  const replacePlan = useCallback((mutate: (draft: Trainingsplan) => void) => {
    setPlan((prev) => {
      const base = prev ?? buildEmptyWeek(week);
      const next: Trainingsplan = JSON.parse(JSON.stringify(base)); // tiefe Kopie ohne Libs
      mutate(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, [week]);

  const goPrevWeek = useCallback(() => {
    setWeek((w) => {
      const monday = getMondayOfISOWeek(w.year, w.isoWeek);
      monday.setUTCDate(monday.getUTCDate() - 7);
      // neue ISO Woche aus neuem Montag ableiten
      const ref = new Date(monday);
      ref.setUTCDate(ref.getUTCDate() + 3); // Donnerstag
      const yearStart = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
      const isoWeek = Math.ceil(((+ref - +yearStart) / 86400000 + 1) / 7);
      return { year: ref.getUTCFullYear(), isoWeek };
    });
  }, []);

  const goNextWeek = useCallback(() => {
    setWeek((w) => {
      const monday = getMondayOfISOWeek(w.year, w.isoWeek);
      monday.setUTCDate(monday.getUTCDate() + 7);
      const ref = new Date(monday);
      ref.setUTCDate(ref.getUTCDate() + 3);
      const yearStart = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
      const isoWeek = Math.ceil(((+ref - +yearStart) / 86400000 + 1) / 7);
      return { year: ref.getUTCFullYear(), isoWeek };
    });
  }, []);

  const addExercise = useCallback((day: ISOWeekDay, ex: ExerciseRef) => {
    replacePlan((draft) => {
      draft.days[day].items.push(ex);
    });
  }, [replacePlan]);

  const removeExercise = useCallback((day: ISOWeekDay, id: string) => {
    replacePlan((draft) => {
      draft.days[day].items = draft.days[day].items.filter((i) => i.id !== id);
    });
  }, [replacePlan]);

  const updateExercise = useCallback((day: ISOWeekDay, id: string, patch: Partial<ExerciseRef>) => {
    replacePlan((draft) => {
      const idx = draft.days[day].items.findIndex((i) => i.id === id);
      if (idx >= 0) draft.days[day].items[idx] = { ...draft.days[day].items[idx], ...patch };
    });
  }, [replacePlan]);

  const moveExercise = useCallback((from: ISOWeekDay, to: ISOWeekDay, id: string, toIndex?: number) => {
    replacePlan((draft) => {
      const src = draft.days[from].items;
      const idx = src.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const [item] = src.splice(idx, 1);
      const dst = draft.days[to].items;
      if (toIndex === undefined || toIndex < 0 || toIndex > dst.length) dst.push(item);
      else dst.splice(toIndex, 0, item);
    });
  }, [replacePlan]);

  const setDayNote = useCallback((day: ISOWeekDay, note: string) => {
    replacePlan((draft) => { draft.days[day].note = note; });
  }, [replacePlan]);

  const saveNow = useCallback(async () => {
    if (!plan) return;
    setSave({ saving: true });
    try {
      await persist(plan);
      setSave({ saving: false, lastSavedAt: new Date().toISOString() });
    } catch (e) {
      setSave({ saving: false, error: (e as Error).message });
    }
  }, [persist, plan]);

  const copyFromPreviousWeek = useCallback(async () => {
    // lädt Vorwoche, übernimmt Inhalte 1:1 in aktuelle Woche (Datum bleibt die aktuelle Woche)
    try {
      const current = week;
      const mon = getMondayOfISOWeek(current.year, current.isoWeek);
      mon.setUTCDate(mon.getUTCDate() - 7);
      const ref = new Date(mon);
      ref.setUTCDate(ref.getUTCDate() + 3);
      const yearStart = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
      const isoWeek = Math.ceil(((+ref - +yearStart) / 86400000 + 1) / 7);
      const prevKey: WeekKey = { year: ref.getUTCFullYear(), isoWeek };

      const previous = await downloadWeek(prevKey);

      replacePlan((draft) => {
        // Items übernehmen, Datum beibehalten (aktuelle Woche)
        (Object.keys(draft.days) as ISOWeekDay[]).forEach((d) => {
          draft.days[d].items = previous.days[d].items.map((x) => ({ ...x }));
          // note übernehmen
          draft.days[d].note = previous.days[d].note;
        });
      });
    } catch (e) {
      setLoad({ loading: false, error: (e as Error).message });
    }
  }, [downloadWeek, replacePlan, week]);

  // Auto-Reload wenn Woche geändert wird
  useEffect(() => { void reload(); }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    week,
    plan,
    load,
    save,
    goPrevWeek,
    goNextWeek,
    reload,
    addExercise,
    removeExercise,
    updateExercise,
    moveExercise,
    setDayNote,
    saveNow,
    copyFromPreviousWeek,
  };
}
