
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
    <div className="kt-modal-backdrop" onClick={onClose}>
      <div className="kt-modal" onClick={e=>e.stopPropagation()}>
        <div className="kt-modal-header">
          <div>{title}</div>
          <button className="kt-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="kt-modal-body">
          <textarea
            style={{minHeight:120, width:'100%', border:'1px solid #e5e7eb', borderRadius:10, padding:10}}
            value={value} onChange={e=>setValue(e.target.value)}
          />
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="kt-btn" onClick={onClose}>Abbrechen</button>
            <button className="kt-btn kt-btn--primary" onClick={()=>{ onSave(value); onClose(); }}>Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}
