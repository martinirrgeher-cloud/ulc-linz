import { useEffect, useState } from "react";
import { loadUebungsgruppen, saveUebungsgruppen } from "@/modules/uebungskatalog/services/UebungsgruppenStore";

const FILE_ID = import.meta.env.VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID as string;

export type GruppenMap = Record<string, string[]>;

export function useUebungsgruppen() {
  const [gruppen, setGruppen] = useState<GruppenMap>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const raw = await loadUebungsgruppen();
      const groups: GruppenMap = raw?.hauptgruppen ?? (raw ?? {});
      // normalize + sort for stable UI
      const normalized: GruppenMap = Object.fromEntries(
        Object.entries(groups || {}).map(([h, list]) => [
          h,
          (list || []).slice().sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))
        ])
      );
      setGruppen(
        Object.fromEntries(
          Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b, "de", { sensitivity: "base" }))
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function save(next: GruppenMap) {
    const sorted: GruppenMap = Object.fromEntries(
      Object.entries(next).map(([h, arr]) => [
        h,
        (arr || []).slice().sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))
      ])
    );
    await saveUebungsgruppen(sorted);
    setGruppen(sorted);
  }

  useEffect(() => { load(); }, []);

  return { gruppen, loading, reload: load, save };
}
