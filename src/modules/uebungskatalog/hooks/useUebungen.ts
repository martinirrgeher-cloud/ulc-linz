import { useEffect, useState, useCallback } from "react";
import DriveClientCore from "@/lib/drive/DriveClientCore";

type Uebung = {
  id: string;
  name: string;
  mediaId?: string;
  mediaUrl?: string;
  [k: string]: any;
};

const FILE_ID = import.meta.env.VITE_DRIVE_UEBUNGEN_FILE_ID as string;

export function useUebungen() {
  const [items, setItems] = useState<Uebung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await (DriveClientCore as any).downloadJson(FILE_ID);
        const list: Uebung[] = Array.isArray(data) ? data : data?.items || [];
        if (alive) setItems(list);
      } catch (e:any) {
        if (alive) setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const uploadAndAttachMedia = useCallback(async (uebungId: string, file: File) => {
    const DC: any = DriveClientCore as any;
    const uploader = DC.uploadFile || DC.uploadBinary || DC.uploadMedia;
    if (!uploader) throw new Error("DriveClientCore: keine Upload-Funktion gefunden (uploadFile|uploadBinary|uploadMedia).");
    const res = await uploader(file);
    const newId = res?.id;
    const next = items.map(u => u.id === uebungId ? { ...u, mediaId: newId } : u);
    await DC.overwriteJsonContent(FILE_ID, next);
    setItems(next);
    return newId;
  }, [items]);

  const saveAll = useCallback(async (next: Uebung[]) => {
    const DC: any = DriveClientCore as any;
    await DC.overwriteJsonContent(FILE_ID, next);
    setItems(next);
  }, []);

  return { items, setItems, uploadAndAttachMedia, saveAll, loading, error };
}
