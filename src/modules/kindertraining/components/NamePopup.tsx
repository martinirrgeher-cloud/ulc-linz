// src/modules/kindertraining/components/NamePopup.tsx
import React, { useEffect, useState } from "react";

type Person = { id?: string; name: string; inactive?: boolean; paid?: boolean; generalNote?: string };

export default function NamePopup(props: {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (name: string) => void | Promise<void>;
  onSaveEdit?: (patch: { name: string; inactive?: boolean; paid?: boolean; generalNote?: string }) => void | Promise<void>;
  person?: Person;
}) {
  const { mode, isOpen, onClose, onCreate, onSaveEdit, person } = props;
  const [name, setName] = useState(person?.name || "");
  const [inactive, setInactive] = useState<boolean>(!!person?.inactive);
  const [unpaid, setUnpaid] = useState<boolean>(person?.paid === false); // UI: "nicht bezahlt"
  const [generalNote, setGeneralNote] = useState<string>(person?.generalNote || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(person?.name || "");
    setInactive(!!person?.inactive);
    setUnpaid(person?.paid === false);
    setGeneralNote(person?.generalNote || "");
    setBusy(false);
  }, [person, isOpen]);

  if (!isOpen) return null;

  const save = () => {
    if (busy) return;
    setBusy(true);

    // Popup sofort schließen (optimistic)
    onClose();

    // Save im Hintergrund
    try {
      if (mode === "create" && onCreate) {
        setTimeout(() => { onCreate(name.trim()); }, 0);
        return;
      }
      if (mode === "edit" && onSaveEdit) {
        const patch = { name: name.trim(), inactive, paid: !unpaid, generalNote };
        setTimeout(() => { onSaveEdit(patch); }, 0);
      }
    } catch {
      /* optional: Toast im Parent */
    }
  };

  return (
    <div className="athlete-modal" role="dialog" aria-modal="true" aria-label={mode === "create" ? "Neuer Athlet" : "Athlet bearbeiten"}>
      <div className="content">
        <div className="kt-modal__header">
          <div className="kt-modal__title">{mode === "create" ? "Neuer Athlet" : "Athlet bearbeiten"}</div>
          <button className="btn btn--icon" onClick={onClose} aria-label="Schließen">×</button>
        </div>

        <div className="kt-modal__body">
          <label className="kt-modal__row">
            <span className="kt-modal__label">Name</span>
            <input className="kt-modal__input" value={name} onChange={e => setName(e.target.value)} />
          </label>

          {mode === "edit" && (
            <>
              <label className="kt-modal__row">
                <span className="kt-modal__label">nicht bezahlt</span>
                <label className="kt-check kt-check--neutral">
                  <input
                    type="checkbox"
                    checked={unpaid}
                    onChange={e => setUnpaid(e.target.checked)}
                  />
                  <span className="kt-check__box" aria-hidden="true" />
                </label>
              </label>

              <label className="kt-modal__row">
                <span className="kt-modal__label">Notiz</span>
                <textarea
                  className="kt-modal__textarea"
                  value={generalNote}
                  onChange={e => setGeneralNote(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <div className="kt-modal__footer">
          {/* Toggle NUR bei Bearbeiten sichtbar */}
          {mode === "edit" && (
            <div className="kt-modal__footer-left">
              <button
                type="button"
                className={`toggle-switch ${!inactive ? "on" : "off"}`}
                onClick={() => setInactive(v => !v)}
                aria-pressed={!inactive}
                aria-label={!inactive ? "Aktiv" : "Inaktiv"}
                title={!inactive ? "Aktiv" : "Inaktiv"}
              >
                <span className="knob" />
              </button>
            </div>
          )}

          <div className="kt-modal__footer-actions">
            <button className="btn" onClick={onClose} disabled={busy}>Abbrechen</button>
            <button className="btn btn--primary-soft" onClick={save} disabled={busy}>Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}
