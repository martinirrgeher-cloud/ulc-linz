import React, { useState, useEffect } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  onSave: (text: string) => void;
  title?: string;
};

export default function NotePopup({ isOpen, onClose, initialText='', onSave, title='Notiz' }: Props){
  const [value, setValue] = useState(initialText || '');
  useEffect(()=>{ setValue(initialText || ''); }, [initialText, isOpen]);

  if(!isOpen) return null;

  return (
    <div className="note-popup" role="dialog" aria-modal="true" aria-label={title}>
      <div className="content">
        <div className="kt-modal__header">
          <div className="kt-modal__title">{title}</div>
          <button className="btn btn--icon" onClick={onClose} aria-label="Schließen">×</button>
        </div>
        <div className="kt-modal__body">
          <textarea
            className="kt-modal__textarea"
            value={value}
            onChange={e=>setValue(e.target.value)}
            placeholder="Notiz eingeben…"
          />
        </div>
        <div className="kt-modal__footer">
          <div/>
          <div className="kt-modal__footer-actions">
            <button className="btn" onClick={onClose}>Abbrechen</button>
            <button className="btn btn--primary-soft" onClick={()=>{ onSave(value); onClose(); }}>Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}
