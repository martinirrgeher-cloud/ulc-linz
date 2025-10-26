import { useCallback, useEffect, useRef, useState } from "react";
import { parseISO, getISOWeek, getISOWeekYear, format } from "date-fns";
import { ISOWeekDay } from "../types/TrainingsplanTypes";
import DriveClient from "@/lib/drive/DriveClient";

const cache = new Map<string, { ja: any[]; nein: any[] }>();

interface AnmeldungResult {
  tageMitJa: { day: ISOWeekDay; note?: string }[];
  tageOhneJa: { day: ISOWeekDay; note?: string }[];
  loading: boolean;
  error?: string;
}

export default function useAnmeldungen(
  athletId: string | null,
  week: number,
  year: number
): AnmeldungResult {
  const [tageMitJa, setTageMitJa] = useState<{ day: ISOWeekDay; note?: string }[]>([]);
  const [tageOhneJa, setTageOhneJa] = useState<{ day: ISOWeekDay; note?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const controllerRef = useRef<AbortController | null>(null);
  const drive = new DriveClient();

  const loadData = useCallback(async () => {
    if (!athletId) return;

    const key = `${athletId}-${week}-${year}`;
    setLoading(true);
    setError(undefined);

    if (cache.has(key)) {
      const cached = cache.get(key)!;
      setTageMitJa(cached.ja);
      setTageOhneJa(cached.nein);
      setLoading(false);
      return;
    }

    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    try {
      const fileId = import.meta.env.VITE_DRIVE_LG_ANMELDUNG_FILE_ID as string;
      const json: any = await drive.downloadJson(fileId);
      const statuses = json.statuses || {};
      const notes = json.notes || {};

      const ja: { day: ISOWeekDay; note?: string }[] = [];
      const nein: { day: ISOWeekDay; note?: string }[] = [];

      Object.entries(statuses).forEach(([fullKey, statusValue]) => {
        const [id, dateStr] = fullKey.split("_");
        if (id !== athletId) return;

        const date = parseISO(dateStr);
        const kw = getISOWeek(date);
        const jahr = getISOWeekYear(date);
        if (kw !== week || jahr !== year) return;

        const dayLabel = format(date, "EEE").toLowerCase().slice(0, 3); // mon, tue, ...
        const note = notes[fullKey];

        if (statusValue === "YES") {
          ja.push({ day: dayLabel as ISOWeekDay, note });
        } else {
          nein.push({ day: dayLabel as ISOWeekDay, note });
        }
      });

      cache.set(key, { ja, nein });
      setTageMitJa(ja);
      setTageOhneJa(nein);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [athletId, week, year, drive]);

  useEffect(() => {
    void loadData();
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [loadData]);

  return { tageMitJa, tageOhneJa, loading, error };
}
