import { useEffect, useState } from "react";
import { downloadJson, uploadJson } from "@/lib/drive/DriveClient";

const fileId = import.meta.env.VITE_DRIVE_UEBUNGSGRUPPEN_FILE_ID as string;

export function useUebungsGruppen() {
  const [gruppen, setGruppen] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await downloadJson(fileId);
        setGruppen(data || {});
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveGruppen = async (newData: Record<string, string[]>) => {
    try {
      setSaving(true);
      setGruppen(newData);
      await uploadJson(fileId, newData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return { gruppen, setGruppen: saveGruppen, loading, saving, error };
}
