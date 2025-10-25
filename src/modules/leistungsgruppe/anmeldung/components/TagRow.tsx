import React from "react";
import styles from "../styles/Anmeldung.css";
import { DayEntry } from "../types";

type Props = {
  day: DayEntry;
  idx: number;
  openNoteIdx: number | null;
  onCycleStatus: (idx: number) => void;
  onToggleNote: (idx: number) => void;
  onChangeNote: (idx: number, value: string) => void;
};

export const TagRow: React.FC<Props> = ({ day, idx, openNoteIdx, onCycleStatus, onToggleNote, onChangeNote }) => {
  const symbol = day.status === "YES" ? "✅" : day.status === "NO" ? "❌" : "❓";

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <div className={styles.weekday}>{day.weekday}</div>
        <div className={styles.date}>{day.dateLabel}</div>
      </div>
      <div className={styles.rowContent}>
        <button
          className={`${styles.statusBtn} ${
            day.status === "YES" ? styles.statusYes :
            day.status === "NO" ? styles.statusNo :
            styles.statusMaybe
          }`}
          onClick={() => onCycleStatus(idx)}
        >
          {symbol}
        </button>
        <button
          className={`${styles.noteIcon} ${day.note ? styles.noteActive : ""}`}
          onClick={() => onToggleNote(idx)}
          title="Notiz"
        >
          📝
        </button>
      </div>
      {openNoteIdx === idx && (
        <textarea
          className={styles.noteField}
          value={day.note}
          onChange={(e) => onChangeNote(idx, e.target.value)}
        />
      )}
    </div>
  );
};
