import { useEffect, useState } from "react";
import { downloadJson, uploadJson, uploadFile } from "@/lib/drive/DriveClient";

const fileId = import.meta.env.VITE_DRIVE_UEBUNGEN_FILE_ID as string;

export function useUebungen() {
  const [uebungen, setUebungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 📥 Laden der Übungsdaten
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (!fileId) throw new Error("Keine File-ID für Übungskatalog gesetzt.");
        const data = await downloadJson(fileId);
        setUebungen(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message);
        console.error("Fehler beim Laden der Übungen:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ➕ Neue Übung hinzufügen
  const addUebung = async (uebung: any) => {
    try {
      setSaving(true);
      if (!fileId) throw new Error("Fehlende File-ID für Übungskatalog.");
      const neueListe = [...uebungen, uebung];
      setUebungen(neueListe);
      await uploadJson(fileId, neueListe);
    } catch (err: any) {
      console.error("Fehler beim Speichern der Übung:", err);
      setError(err.message);
      alert("Fehler beim Speichern: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ✍️ Bestehende Übung aktualisieren
  const updateUebung = async (id: string, updatedData: any) => {
    try {
      setSaving(true);
      const neueListe = uebungen.map(u =>
        u.id === id ? { ...u, ...updatedData } : u
      );
      setUebungen(neueListe);
      await uploadJson(fileId, neueListe);
    } catch (err: any) {
      console.error("Fehler beim Aktualisieren der Übung:", err);
      setError(err.message);
      alert("Fehler beim Aktualisieren: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return { uebungen, addUebung, updateUebung, uploadMedia: uploadFileWrapper, loading, saving, error };
}

// 🪄 UploadWrapper – kümmert sich um Upload + Rückgabe von URL, Typ, Name und ID
async function uploadFileWrapper(file: File) {
  const res = await uploadFile(file);
  return {
    url: res.url,
    type: res.type,
    name: res.name,
    id: res.id,
  };
}
