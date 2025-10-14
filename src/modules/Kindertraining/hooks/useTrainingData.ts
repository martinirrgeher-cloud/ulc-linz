import { useState, useEffect, useCallback } from "react";
import { loadJsonByName, saveJsonByName } from "../../../lib/googleDrive";

// 🧭 Datenstruktur für Personen
export interface Person {
  firstName: string;
  lastName: string;
  active: boolean;
  paid?: boolean;
  comment?: string;
}

// 🧭 Datenstruktur für das Training
export interface TrainingData {
  people: Person[];
  records: Record<string, Record<string, boolean>>; // Anwesenheiten
  notes: Record<string, string>;                     // Notizen zu einzelnen Tagen
  weekdaysByMonth?: Record<string, number[]>;        // Wochentage pro Monat (optional)
  hiddenDays?: string[];                             // ausgeblendete Trainings (für Statistik)
}

// 📁 Name der zentralen JSON-Datei auf Google Drive
const FILE_NAME = "kindertraining_data.json";

// 🧭 Hook zum zentralen Lesen/Schreiben auf Google Drive
export function useTrainingData() {
  const [data, setData] = useState<TrainingData>({
    people: [],
    records: {},
    notes: {},
    weekdaysByMonth: {},
    hiddenDays: [],
  });

  const [loading, setLoading] = useState(true);

  // 🪄 Daten beim Start laden
  useEffect(() => {
    async function fetchData() {
      try {
        const remoteData = await loadJsonByName(FILE_NAME);
        if (remoteData) {
          // Falls Felder in alten Versionen fehlen, mit Defaults zusammenführen
          setData({
            people: remoteData.people ?? [],
            records: remoteData.records ?? {},
            notes: remoteData.notes ?? {},
            weekdaysByMonth: remoteData.weekdaysByMonth ?? {},
            hiddenDays: remoteData.hiddenDays ?? [],
          });
        } else {
          console.warn(`ℹ️ Keine bestehende Datei ${FILE_NAME} gefunden – leere Daten verwendet.`);
        }
      } catch (err) {
        console.error("❌ Fehler beim Laden der Trainingsdaten von Google Drive:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // 🧭 Update-Funktion: Änderungen anwenden & sofort auf Google Drive speichern
  const update = useCallback(
    (updater: (prev: TrainingData) => TrainingData) => {
      setData((prev) => {
        const updated = updater(prev);
        saveJsonByName(FILE_NAME, updated).catch((err) =>
          console.error("❌ Fehler beim Speichern auf Google Drive:", err)
        );
        return updated;
      });
    },
    []
  );

  return { data, update, loading };
}
