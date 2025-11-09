import { useEffect, useState } from "react";
import { loadUebungsgruppen } from "@/modules/uebungskatalog/services/UebungsgruppenStore";
import { overwriteJsonContent } from "@/lib/drive/DriveClientCore";

const FILE_ID = import.meta.env.VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID as string;

export type GruppenMap = Record<string, string[]>;

export function useUebungsGruppen() {
  const [gruppen, setGruppen] = useState<GruppenMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const raw: unknown = await loadUebungsgruppen();

      // robuste Normalisierung auf GruppenMap
      const map: GruppenMap =
        raw && typeof raw === "object" && raw !== null && "hauptgruppen" in (raw as any) && (raw as any).hauptgruppen
          ? (raw as any).hauptgruppen as GruppenMap
          : Array.isArray(raw)
            ? { Allgemein: raw as string[] }
            : (raw as GruppenMap) ?? {};

      setGruppen(map);
    } catch (e: any) {
      setError(e?.message || "Fehler beim Laden der Gruppen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveGruppen(newData: GruppenMap) {
    try {
      setSaving(true);
      setGruppen(newData);
      // zentral im JSON-Format der Stammdaten speichern
      await overwriteJsonContent(FILE_ID, { hauptgruppen: newData });
    } catch (e: any) {
      setError(e?.message || "Fehler beim Speichern der Gruppen");
    } finally {
      setSaving(false);
    }
  }

  return { gruppen, setGruppen: saveGruppen, loading, saving, error, reload: load };
}
