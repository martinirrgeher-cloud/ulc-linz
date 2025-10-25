import React from "react";
import "../styles/Anmeldung.css";

type Props = {
  onClose: () => void;
  onResetWeek: () => void;
};

export const SettingsOverlay: React.FC<Props> = ({ onClose, onResetWeek }) => {
  return (
    <div className="settingsOverlay">
      <div className="settingsBox">
        <div className="settingsHeader">
          <div className="settingsTitle">Einstellungen</div>
          <button className="closeBtn" onClick={onClose}>✖</button>
        </div>
        <button className="resetBtn" onClick={onResetWeek}>
          Woche für Athleten zurücksetzen
        </button>
      </div>
    </div>
  );
};
