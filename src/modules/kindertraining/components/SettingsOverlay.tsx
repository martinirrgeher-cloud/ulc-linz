// src/modules/kindertraining/components/SettingsOverlay.tsx
import React, { useEffect, useState } from "react";
import type { KTSettings } from "../hooks/useKindertraining";
import { useKindertrainingSettings } from "../hooks/useKindertrainingSettings";
import "@/assets/styles/Header.css";

type Props = {
  settings?: KTSettings;
  onClose: () => void;
  onSettingsChange: (s: KTSettings) => void;
};

const WEEKDAYS = [
  { key: "Montag", short: "MO" },
  { key: "Dienstag", short: "DI" },
  { key: "Mittwoch", short: "MI" },
  { key: "Donnerstag", short: "DO" },
  { key: "Freitag", short: "FR" },
  { key: "Samstag", short: "SA" },
  { key: "Sonntag", short: "SO" },
];

export default function SettingsOverlay({ settings, onClose, onSettingsChange }: Props) {
  const { saveSettings } = useKindertrainingSettings();
  const [local, setLocal] = useState<KTSettings>({
    activeDays: settings?.activeDays?.length ? settings.activeDays : ["Dienstag"],
    sortOrder: settings?.sortOrder ?? "vorname",
    showInactive: settings?.showInactive ?? false,
  });

  // Synchronisierung bei externen Änderungen
  useEffect(() => {
    setLocal({
      activeDays: settings?.activeDays?.length ? settings.activeDays : ["Dienstag"],
      sortOrder: settings?.sortOrder ?? "vorname",
      showInactive: settings?.showInactive ?? false,
    });
  }, [settings?.activeDays?.join(","), settings?.sortOrder, settings?.showInactive]);

  function update(partial: Partial<KTSettings>) {
    const next = { ...local, ...partial } as KTSettings;
    setLocal(next);
    onSettingsChange(next); // sofortige Wirkung
  }

  async function handleClose() {
    try {
      await saveSettings(local);
    } catch (e) {
      console.warn("Einstellungen speichern fehlgeschlagen:", e);
    }
    onClose();
  }

  function toggleDay(day: string) {
    const has = local.activeDays.includes(day);
    const nextDays = has ? local.activeDays.filter(d => d !== day) : [...local.activeDays, day];
    update({ activeDays: nextDays });
  }

  return (
  <div className="kt-settings-popup" onClick={handleClose}>
    <div className="popup-content" onClick={(e) => e.stopPropagation()}>
      <div className="popup-header">
        <h3>Einstellungen</h3>
        <button className="header-btn" onClick={handleClose}>✖</button>
      </div>

      {/* Sortierung */}
      <div className="setting-row">
        <label><strong>Sortierung:</strong></label>
        <div className="button-group">
          <button
            className={local.sortOrder === "vorname" ? "header-btn active" : "header-btn"}
            onClick={() => update({ sortOrder: "vorname" })}
          >
            Vorname
          </button>
          <button
            className={local.sortOrder === "nachname" ? "header-btn active" : "header-btn"}
            onClick={() => update({ sortOrder: "nachname" })}
          >
            Nachname
          </button>
        </div>
      </div>

      {/* Trainingstage */}
      <div className="setting-row">
        <label><strong>Trainingstage:</strong></label>
        <div className="weekday-grid">
          {WEEKDAYS.map(({ key, short }) => (
            <div key={key} className="weekday-item">
              <div className="weekday-label">{short}</div>
              <input
                type="checkbox"
                checked={local.activeDays.includes(key)}
                onChange={() => toggleDay(key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Inaktive Personen */}
      <div className="setting-row">
        <label>
          <input
            type="checkbox"
            checked={!!local.showInactive}
            onChange={(e) => update({ showInactive: e.target.checked })}
          />
          Inaktive Personen anzeigen
        </label>
      </div>
    </div>
  </div>
);



}
