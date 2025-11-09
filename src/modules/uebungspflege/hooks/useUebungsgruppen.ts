import { useEffect, useState } from "react";
import { loadUebungsgruppen } from "@/modules/uebungskatalog/services/UebungsgruppenStore";

const FILE_ID = import.meta.env.VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID as string;

export type GruppenMap = Record<string, string[]>;

export default function useUebungsgruppen() {
  const [gruppen, setGruppen] = useState<GruppenMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const raw: unknown = await loadUebungsgruppen();

        const map: GruppenMap =
          raw && typeof raw === "object" && raw !== null && "hauptgruppen" in (raw as any) && (raw as any).hauptgruppen
            ? (raw as any).hauptgruppen as GruppenMap
            : Array.isArray(raw)
              ? { Allgemein: raw as string[] }
              : (raw as GruppenMap) ?? {};

        if (alive) setGruppen(map);
      } catch (e: any) {
        if (alive) setError(e?.message || "Fehler beim Laden der Gruppen");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Wenn du hier auch Speichern brauchst, füge analog zu Katalog.saveGruppen eine persist-Funktion ein
  return { gruppen, setGruppen, loading, error };
}
