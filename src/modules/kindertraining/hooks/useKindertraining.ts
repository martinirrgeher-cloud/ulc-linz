import { useEffect, useState } from "react";
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClient";
import type { KTPerson } from "../lib/kindertrainingPersonenDrive";

// 🆕 Typen exportieren — wichtig für andere Komponenten
export type DayKey = string;

export type KTSettings = {
  sortOrder: "vorname" | "nachname";
  activeDays: string[];
  showInactive: boolean;
};

export interface TrainingData {
  personsByWeek: Record<string, KTPerson[]>;
  __settings__?: KTSettings;
  weekMeta?: Record<
    string,
    {
      inactiveDays?: Record<string, boolean>;
      dayNotes?: Record<string, string>;
    }
  >;
}

// Standard-Einstellungen, falls noch keine vorhanden
const defaultSettings: KTSettings = {
  sortOrder: "vorname",
  activeDays: ["Dienstag"],
  showInactive: false,
};

export function useKindertraining() {
  const [training, setTraining] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fileId = import.meta.env.VITE_DRIVE_KINDERTRAINING_FILE_ID;

  // Daten laden
  useEffect(() => {
    const load = async () => {
      try {
        const data = await downloadJson(fileId);
        // Sicherstellen, dass Settings existieren
        if (!data.__settings__) {
          data.__settings__ = defaultSettings;
        }
        setTraining(data);
      } catch (err) {
        console.error("❌ Fehler beim Laden der Trainingsdaten:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fileId]);

  const save = async (updated: TrainingData) => {
    try {
      await overwriteJsonContent(fileId, updated);
      setTraining(updated);
    } catch (err) {
      console.error("❌ Fehler beim Speichern der Trainingsdaten:", err);
    }
  };

  // Personen aktualisieren
  const updatePersonsForWeek = (week: string, persons: KTPerson[]) => {
    if (!training) return;
    const updated = { ...training };
    updated.personsByWeek = { ...updated.personsByWeek, [week]: persons };
    save(updated);
  };

  // Einstellungen aktualisieren
  const updateSettings = (newSettings: Partial<KTSettings>) => {
    if (!training) return;
    const updated = {
      ...training,
      __settings__: { ...training.__settings__, ...newSettings },
    };
    save(updated);
  };

  // Meta-Daten für Woche (Notizen, Inaktivierungen)
  const updateWeekMeta = (
    week: string,
    updater: (meta: NonNullable<TrainingData["weekMeta"]>[string]) => void
  ) => {
    if (!training) return;
    const updated = { ...training };
    updated.weekMeta = { ...updated.weekMeta };
    const currentMeta = updated.weekMeta[week] || {
      inactiveDays: {},
      dayNotes: {},
    };
    updater(currentMeta);
    updated.weekMeta[week] = currentMeta;
    save(updated);
  };

  return {
    training,
    loading,
    updatePersonsForWeek,
    updateSettings,
    updateWeekMeta,
  };
}
