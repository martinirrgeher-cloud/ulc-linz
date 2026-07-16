import { useEffect, useMemo, useState } from "react";
import type { Athlete } from "../types/athleten";
import "./AthleteForm.css"; // Header/Toggle styles

export default function AthleteForm({ value, onChange, onSave, onCancel }: {
  value: Athlete;
  onChange: (a: Athlete) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState<Athlete>(value);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => { setLocal(value); setTouched({}); }, [value]);

  const firstNameOk = (local.firstName || "").trim().length > 0;
  const lastNameOk  = (local.lastName  || "").trim().length > 0;
  const canSave = useMemo(() => firstNameOk && lastNameOk, [firstNameOk, lastNameOk]);

  const onSaveClick = () => {
    if (!canSave) return;
    const first = (local.firstName || "").trim();
    const last  = (local.lastName  || "").trim();
    const updated: Athlete = { ...local, name: `${first} ${last}`.trim() };
    onChange(updated);
    onSave();
  };

  const isActive = local.active !== false;
  // Toggle nur bei "Bearbeiten" anzeigen: wenn eine ID vorhanden ist
  const isEdit = !!(local as any).id;

  return (
    <div className="kt-form">
      <div className="af-header">
        <h2>Athlet bearbeiten</h2>
        {isEdit && (
          <button
            type="button"
            className={`toggle-switch ${isActive ? "on" : "off"}`}
            onClick={() => setLocal({ ...local, active: !isActive })}
            aria-pressed={isActive}
            aria-label={isActive ? "Aktiv" : "Inaktiv"}
            title={isActive ? "Aktiv" : "Inaktiv"}
          >
            <span className="knob" />
          </button>
        )}
      </div>

      <div className="kt-field">
        <label>Vorname <span className="req">*</span></label>
        <input
          className={`kt-input ${touched.firstName && !firstNameOk ? "is-invalid" : ""}`}
          value={local.firstName || ""}
          onBlur={() => setTouched({ ...touched, firstName: true })}
          onChange={e => setLocal({ ...local, firstName: e.target.value })}
        />
        {touched.firstName && !firstNameOk && <div className="kt-error-text">Vorname ist erforderlich.</div>}
      </div>

      <div className="kt-field">
        <label>Nachname <span className="req">*</span></label>
        <input
          className={`kt-input ${touched.lastName && !lastNameOk ? "is-invalid" : ""}`}
          value={local.lastName || ""}
          onBlur={() => setTouched({ ...touched, lastName: true })}
          onChange={e => setLocal({ ...local, lastName: e.target.value })}
        />
        {touched.lastName && !lastNameOk && <div className="kt-error-text">Nachname ist erforderlich.</div>}
      </div>

      <div className="kt-field">
        <label>Geburtsjahr</label>
        <input
          className="kt-input"
          type="number"
          value={(local.geburtsjahr as any) ?? ""}
          onChange={e => setLocal({ ...local, geburtsjahr: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>

      <div className="kt-field">
        <label>Altersklasse</label>
        <input
          className="kt-input"
          value={local.altersklasse ?? ""}
          onChange={e => setLocal({ ...local, altersklasse: e.target.value })}
        />
      </div>

      <div className="kt-field">
        <label>Info</label>
        <textarea
          className="kt-textarea"
          value={local.info ?? ""}
          onChange={e => setLocal({ ...local, info: e.target.value })}
        />
      </div>

      <div className="kt-row actions">
        <button className="kt-btn" onClick={onCancel}>Abbrechen</button>
        <div className="spacer" />
        <button className="kt-btn primary" disabled={!canSave} onClick={onSaveClick}>Speichern</button>
      </div>
    </div>
  );
}
