
import React from 'react'

type Props = {
  person: string
  status: string
  setStatus: (v: string) => void
  notiz: string
  setNotiz: (v: string) => void
  onSave: () => void
  onClose: () => void
}

export default function PersonInfoPopup({
  person,
  status,
  setStatus,
  notiz,
  setNotiz,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="popupOverlay">
      <div className="popupContent">
        <h3>Personeninfo – {person}</h3>

        <label>Status:</label>
        <input
          type="text"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="popupInput"
        />

        <label>Notiz:</label>
        <textarea
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          className="popupTextarea"
        />

        <div className="popupActions">
          <button onClick={onSave} className="popupButtonSave">
            💾 Speichern
          </button>
          <button onClick={onClose} className="popupButtonCancel">
            ❌ Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
