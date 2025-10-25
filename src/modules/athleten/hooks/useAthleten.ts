import { useEffect, useState } from "react";
import { downloadJson } from "@/lib/drive/DriveClient";
import { Athlete } from "../types/athleten";

export function useAthleten() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [filtered, setFiltered] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileId = import.meta.env.VITE_DRIVE_ATHLETEN_FILE_ID;

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await downloadJson(fileId);
        if (Array.isArray(raw)) {
          setAthletes(raw);
          setFiltered(raw);
        } else if (raw?.athleten && Array.isArray(raw.athleten)) {
          setAthletes(raw.athleten);
          setFiltered(raw.athleten);
        } else {
          setAthletes([]);
          setFiltered([]);
        }
      } catch (err: any) {
        console.error("Fehler beim Laden der Athleten:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fileId]);

  useEffect(() => {
    setFiltered(athletes);
  }, [athletes]);

  const reload = async () => {
    setLoading(true);
    try {
      const raw = await downloadJson(fileId);
      if (Array.isArray(raw)) {
        setAthletes(raw);
        setFiltered(raw);
      } else if (raw?.athleten && Array.isArray(raw.athleten)) {
        setAthletes(raw.athleten);
        setFiltered(raw.athleten);
      } else {
        setAthletes([]);
        setFiltered([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { athletes, filtered, loading, error, reload };
}
