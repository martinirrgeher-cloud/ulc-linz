import { useEffect, useState } from "react";
import { getAccessToken, silentRefreshIfNeeded } from "@/lib/googleAuth";

export function useKindertraining() {
  const [personen, setPersonen] = useState<any[]>([]);
  const [training, setTraining] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const trainingId = import.meta.env.VITE_DRIVE_KINDERTRAINING_FILE_ID;
        const personenId = import.meta.env.VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID;

        if (!trainingId || !personenId) {
          throw new Error(
            "VITE_DRIVE_KINDERTRAINING_FILE_ID oder VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID fehlt!"
          );
        }

        let token = getAccessToken();
        if (!token) {
          token = await silentRefreshIfNeeded();
        }
        if (!token) {
          throw new Error("Kein gültiger Google Token vorhanden");
        }

        // 📥 Personenliste laden
        const personenRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${personenId}?alt=media`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!personenRes.ok) throw new Error("Fehler beim Laden der Personenliste");
        const personenJson = await personenRes.json();
        setPersonen(personenJson);

        // 📥 Trainingsdaten laden
        const trainingRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${trainingId}?alt=media`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!trainingRes.ok) throw new Error("Fehler beim Laden der Trainingsdaten");
        const trainingJson = await trainingRes.json();
        setTraining(trainingJson);
      } catch (err: any) {
        console.error("Fehler beim Laden der Kindertraining-Daten:", err);
        setError(err.message || "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return { personen, training, loading, error };
}
