import React from "react";
import styles from "../styles/Anmeldung.css";

type Props = {
  onClose: () => void;
  onResetWeek: () => void;
};

export const SettingsOverlay: React.FC<Props> = ({ onClose, onResetWeek }) => {
  return (
    <div className={styles.settingsOverlay}>
      <div className={styles.settingsBox}>
        <div className={styles.settingsHeader}>
          <div className={styles.settingsTitle}>Einstellungen</div>
          <button className={styles.closeBtn} onClick={onClose}>✖</button>
        </div>
        <button className={styles.resetBtn} onClick={onResetWeek}>
          Woche für Athleten zurücksetzen
        </button>
      </div>
    </div>
  );
};
