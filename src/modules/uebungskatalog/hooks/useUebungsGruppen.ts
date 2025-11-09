import { useEffect, useState, useCallback } from "react";
import DriveClientCore from "@/lib/drive/DriveClientCore";

export type GruppenMap = { [hauptgruppe: string]: string[] };

export function useUebungsGruppen(fileId: string) {
  const [gruppen, setGruppen] = useState<GruppenMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await DriveClientCore.downloadJson<any>(fileId);
        const map: GruppenMap = (data && typeof data === "object" && data.map) ? data.map : (data || {});
        if (alive) setGruppen(map);
      } catch (e:any) {
        if (alive) setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fileId]);

  const refresh = useCallback(async () => {
    const data = await DriveClientCore.downloadJson<any>(fileId);
    const map: GruppenMap = (data && typeof data === "object" && data.map) ? data.map : (data || {});
    setGruppen(map);
  }, [fileId]);

  const save = useCallback(async (next: GruppenMap) => {
    await DriveClientCore.overwriteJsonContent(fileId, next);
    setGruppen(next);
  }, [fileId]);

  return { gruppen, setGruppen, save, refresh, loading, error };
}
