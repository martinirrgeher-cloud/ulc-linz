import React from "react";
import type { Athlete } from "@/modules/athleten/types/athleten";

type CopyScope = "DAY" | "WEEK";

type Props = {
  dateISO: string;
  weekDates: string[];
  copyScope: CopyScope;
  setCopyScope: (s: CopyScope) => void;
  copyToAthleteId: string;
  setCopyToAthleteId: (id: string) => void;
  copyToWeekOffset: number;
  setCopyToWeekOffset: (n: number) => void;
  athletes: Athlete[];
  onCopy: () => void;
};

export default function TrainingsplanungCopyPanel({
  dateISO,
  weekDates,
  copyScope,
  setCopyScope,
  copyToAthleteId,
  setCopyToAthleteId,
  copyToWeekOffset,
  setCopyToWeekOffset,
  athletes,
  onCopy,
}: Props) {
  return (
    <div className="tp-card">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        Plan kopieren
      </div>
      <div className="tp-row">
        <select
          className="tp-select"
          value={copyScope}
          onChange={(e) => setCopyScope(e.target.value as CopyScope)}
        >
          <option value="DAY">Nur aktuellen Tag</option>
          <option value="WEEK">Aktuelle Woche</option>
        </select>
      </div>
      <div className="tp-row" style={{ marginTop: 8 }}>
        <select
          className="tp-select"
          value={copyToAthleteId}
          onChange={(e) => setCopyToAthleteId(e.target.value)}
        >
          <option value="">– Ziel-Athlet –</option>
          {athletes
            .slice()
            .sort((a, b) => {
              const ln = a.lastName.localeCompare(b.lastName, "de", {
                sensitivity: "base",
              });
              if (ln !== 0) return ln;
              return a.firstName.localeCompare(b.firstName, "de", {
                sensitivity: "base",
              });
            })
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.lastName} {a.firstName}
              </option>
            ))}
        </select>
      </div>

      {copyScope === "WEEK" && (
        <div className="tp-row" style={{ marginTop: 8 }}>
          <label>
            Wochenversatz:
            <select
              className="tp-select"
              value={copyToWeekOffset}
              onChange={(e) => setCopyToWeekOffset(Number(e.target.value))}
            >
              <option value={-2}>2 Wochen zurück</option>
              <option value={-1}>1 Woche zurück</option>
              <option value={0}>gleiche Woche</option>
              <option value={1}>+1 Woche</option>
              <option value={2}>+2 Wochen</option>
            </select>
          </label>
        </div>
      )}

      <div className="tp-actions" style={{ marginTop: 8 }}>
        <button
          className="tp-btn"
          type="button"
          disabled={!copyToAthleteId}
          onClick={onCopy}
        >
          Kopieren
        </button>
        <div className="tp-badge">
          Zieldaten:{" "}
          {copyScope === "DAY"
            ? dateISO
            : `${weekDates[0]} – ${weekDates[6]}`}
        </div>
      </div>
    </div>
  );
}
