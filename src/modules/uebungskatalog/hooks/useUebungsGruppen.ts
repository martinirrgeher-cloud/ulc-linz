import { useEffect, useState } from "react";
import { loadUebungsgruppen, saveUebungsgruppen } from "@/modules/uebungskatalog/services/UebungsgruppenStore";

const FILE_ID = import.meta.env.VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID as string;

type GruppenMap = Record<string, string[]>;

export function useUebungsGruppen() {
  const [gruppen, setGruppen] = useState<GruppenMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const raw = await loadUebungsgruppen();
      const map: GruppenMap = (raw && raw.hauptgruppen) ? raw.hauptgruppen : (raw ?? {});
      setGruppen(map || {});
    } catch (e: any) {
      setError(e?.message || "Fehler beim Laden der Gruppen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveGruppen(newData: GruppenMap) {
    try {
      setSaving(true);
      setGruppen(newData);
      await overwriteJsonContent(FILE_ID, { hauptgruppen: newData });
    } catch (e: any) {
      setError(e?.message || "Fehler beim Speichern der Gruppen");
    } finally {
      setSaving(false);
    }
  }

  return { gruppen, setGruppen: saveGruppen, loading, saving, error, reload: load };
}
