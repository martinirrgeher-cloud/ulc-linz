import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadJson, uploadJson } from "@/lib/drive/DriveClient";

type DayStatus = "YES" | "NO" | "MAYBE" | null;

interface DriveShape {
  statuses?: Record<string, DayStatus>;
  notes?: Record<string, string>;
}

const FILE_ID = import.meta.env.VITE_DRIVE_LG_ANMELDUNG_FILE_ID as string;
const DEBOUNCE_MS = 300;

// Kalenderfunktionen
function startOfISOWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return new Date(date);
}
function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDateLabel(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
const WEEKDAYS_MON_FIRST = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
function getDaysOfWeek(startDate: Date) {
  const start = startOfISOWeek(startDate);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push({
      date: toIsoDate(d),
      dateLabel: formatDateLabel(d),
      weekday: WEEKDAYS_MON_FIRST[i],
    });
  }
  return out;
}
function getISOWeekYear(d: Date) {
  const date = startOfISOWeek(d);
  return date.getUTCFullYear();
}
function getISOWeekNumber(d: Date) {
  const date = startOfISOWeek(d);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((Number(date) - Number(yearStart)) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}
function addWeeks(d: Date, weeks: number) {
  const nd = new Date(d);
  nd.setUTCDate(nd.getUTCDate() + 7 * weeks);
  return nd;
}

export function useAnmeldung() {
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());
  const [driveData, setDriveData] = useState<DriveShape>({ statuses: {}, notes: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<number | null>(null);
  const lastSavedRef = useRef<string>("");

  const jahr = useMemo(() => getISOWeekYear(baseDate), [baseDate]);
  const kw = useMemo(() => getISOWeekNumber(baseDate), [baseDate]);
  const tage = useMemo(() => getDaysOfWeek(baseDate), [baseDate]);

  // Laden
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await downloadJson(FILE_ID);
        if (mounted) {
          setDriveData({
            statuses: (json?.statuses ?? {}) as Record<string, DayStatus>,
            notes: (json?.notes ?? {}) as Record<string, string>,
          });
          lastSavedRef.current = JSON.stringify(json ?? {});
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Fehler beim Laden der Anmeldung");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const debouncedSave = useCallback((data: DriveShape) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      setError(null);
      try {
        await uploadJson(FILE_ID, data);
        lastSavedRef.current = JSON.stringify(data);
      } catch (e: any) {
        setError(e?.message ?? "Fehler beim Speichern");
        try {
          setDriveData(JSON.parse(lastSavedRef.current));
        } catch {}
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  // Status-Funktionen
  const getStatus = useCallback((athletId: string, isoDate: string): DayStatus => {
    const key = `${athletId}_${isoDate}`;
    return (driveData.statuses ?? {})[key] ?? null;
  }, [driveData.statuses]);

  const setStatus = useCallback((athletId: string, isoDate: string, status: DayStatus) => {
    const key = `${athletId}_${isoDate}`;
    const updated: DriveShape = {
      statuses: { ...(driveData.statuses ?? {}), [key]: status },
      notes: { ...(driveData.notes ?? {}) },
    };
    // Optimistic Update
    setDriveData(updated);
    debouncedSave(updated);
  }, [driveData.statuses, driveData.notes, debouncedSave]);

  // Notiz-Funktionen
  const notizen = useMemo(() => (driveData.notes ?? {}), [driveData.notes]);

  const setNotiz = useCallback((athletId: string, isoDate: string | null, value: string) => {
    if (!isoDate) return;
    const key = `${athletId}_${isoDate}`;
    const updated: DriveShape = {
      statuses: { ...(driveData.statuses ?? {}) },
      notes: { ...(driveData.notes ?? {}), [key]: value },
    };
    setDriveData(updated);
    debouncedSave(updated);
  }, [driveData.statuses, driveData.notes, debouncedSave]);

  const nextWeek = useCallback(() => setBaseDate(d => addWeeks(d, +1)), []);
  const prevWeek = useCallback(() => setBaseDate(d => addWeeks(d, -1)), []);

  return {
    tage,
    kw,
    jahr,
    getStatus,
    setStatus,
    notizen,
    setNotiz,
    nextWeek,
    prevWeek,
    loading,
    saving,
    error,
  };
}
