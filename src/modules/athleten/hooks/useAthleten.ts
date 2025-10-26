import { useEffect, useState } from "react";
import { downloadJson, uploadJson } from "@/lib/drive/DriveClient";

const FILE_ID = import.meta.env.VITE_DRIVE_ATHLETEN_FILE_ID as string;

export interface Athlete {
  id: string;
  name: string;
  geburtsjahr: number;
  leistungsgruppe: string;
  info: string;
  anmeldung: any[];
  plaene: any[];
  feedback: any[];
  active: boolean;
}

export function useAthleten() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [filtered, setFiltered] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    try {
      setLoading(true);
      const data = await downloadJson(FILE_ID);
      if (Array.isArray(data)) {
        setAthletes(data);
        setFiltered(data);
      } else if (data?.athleten) {
        setAthletes(data.athleten);
        setFiltered(data.athleten);
      } else {
        setAthletes([]);
        setFiltered([]);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Athleten:", err);
      setError("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const addAthlete = async (athlet: Athlete) => {
    const updated = [...athletes, athlet];
    await uploadJson(FILE_ID, updated);
    setAthletes(updated);
    setFiltered(updated);
  };

  // ✅ Signatur angepasst → unterstützt ID und Patch (Partial)
  const updateAthlete = async (id: string, patch: Partial<Athlete>) => {
    const updated = athletes.map((a) =>
      a.id === id ? { ...a, ...patch } : a
    );
    await uploadJson(FILE_ID, updated);
    setAthletes(updated);
    setFiltered(updated);
  };

  const removeAthlete = async (id: string) => {
    const updated = athletes.filter((a) => a.id !== id);
    await uploadJson(FILE_ID, updated);
    setAthletes(updated);
    setFiltered(updated);
  };

  useEffect(() => {
    reload();
  }, []);

  return {
    athletes,
    filtered,
    loading,
    error,
    reload,
    addAthlete,
    updateAthlete, // ✅ angepasste Signatur
    removeAthlete,
  };
}

export default useAthleten;

