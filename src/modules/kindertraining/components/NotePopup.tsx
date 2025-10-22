import React from "react";
import type { DayKey } from "../hooks/useKindertraining";

type Props = {
  person: string;
  day: DayKey;
  text: string;
  setText: (t: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function NotePopup({ day, text, setText, onSave, onClose }: Props) {
  return (
    <div className="note-popup">
      <div className="note-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Notiz für {day}</strong>
          <button onClick={onClose}>✖</button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          style={{ width: "100%", marginTop: "0.5rem" }}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button onClick={onSave}>Speichern</button>
          <button onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
