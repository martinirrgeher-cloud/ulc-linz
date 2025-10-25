import React from "react";
import "../styles/Anmeldung.css";
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
    <div className="row">
      <div className="rowHeader">
        <div className="weekday">{day.weekday}</div>
        <div className="date">{day.dateLabel}</div>
      </div>
      <div className="rowContent">
        <button
          className={`statusBtn ${
            day.status === "YES" ? "statusYes" :
            day.status === "NO" ? "statusNo" :
            "statusMaybe"
          }`}
          onClick={() => onCycleStatus(idx)}
        >
          {symbol}
        </button>
        <button
          className={`noteIcon ${day.note ? "noteActive" : ""}`}
          onClick={() => onToggleNote(idx)}
          title="Notiz"
        >
          📝
        </button>
      </div>
      {openNoteIdx === idx && (
        <textarea
          className="noteField"
          value={day.note}
          onChange={(e) => onChangeNote(idx, e.target.value)}
        />
      )}
    </div>
  );
};
