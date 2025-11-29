// src/modules/leistungsgruppe/trainingsplanung/components/TrainingsplanungHeader.tsx
import React from "react";
import type { DayStatus } from "../../anmeldung/services/AnmeldungStore";

type AthleteLite = {
  id: string;
  name: string;
  active?: boolean;
};

type StatusMap = Record<string, DayStatus | null | undefined>;

type Props = {
  athletes: AthleteLite[];
  selectedAthleteId: string;
  onChangeAthlete: (id: string) => void;

  weekLabel: string;
  weekDates: string[];
  dateISO: string;
  onChangeDate: (dateISO: string) => void;

  statusMap: StatusMap;
  anmeldungLoading: boolean;

  onPrevWeek: () => void;
  onNextWeek: () => void;
};

function statusBadgeClass(s: DayStatus | undefined | null): string {
  if (!s) return "tp-day-status none";

  const v = s.toString().toUpperCase();

  if (v === "YES") return "tp-day-status yes";     // JA -> grün
  if (v === "NO") return "tp-day-status no";       // NEIN -> rot

  // MAYBE / ? -> grau (Outline, keine Füllung)
  if (v === "MAYBE" || v === "?") return "tp-day-status none";

  // Fallback: grau
  return "tp-day-status none";
}

const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function TrainingsplanungHeader(props: Props) {
  const {
    athletes,
    selectedAthleteId,
    onChangeAthlete,
    weekLabel,
    weekDates,
    dateISO,
    onChangeDate,
    statusMap,
    anmeldungLoading,
    onPrevWeek,
    onNextWeek,
  } = props;

  return (
    <div className="tp-header">
      <div className="tp-header-row">
        <div className="tp-field tp-field--athlete">
          <label className="tp-label">Athlet</label>
          <select
            className="tp-input"
            value={selectedAthleteId}
            onChange={(e) => onChangeAthlete(e.target.value)}
          >
            <option value="">– auswählen –</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.active === false ? " (inaktiv)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="tp-field tp-week-nav">
  <button type="button" className="tp-btn" onClick={onPrevWeek}>◀</button>
  <div className="tp-week-label">{weekLabel}</div>
  <button type="button" className="tp-btn" onClick={onNextWeek}>▶</button>
</div>
      </div>

      <div className="tp-days-row">
        {weekDates.map((d) => {
          const isSelected = d === dateISO;
          const dateObj = new Date(d + "T00:00:00");
          const weekdayIndex = (dateObj.getDay() + 6) % 7; // Montag=0
          const weekdayShort = WEEKDAY_NAMES[weekdayIndex] ?? "";
          const label = `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

          const statusKey = selectedAthleteId ? `${selectedAthleteId}:${d}` : "";
          const status = statusKey ? statusMap[statusKey] ?? null : null;

          const cls = [
            "tp-day-button",
            isSelected ? "selected" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={d}
              type="button"
              className={cls}
              onClick={() => onChangeDate(d)}
            >
              <div className="tp-day-weekday">{weekdayShort}</div>
              <div className="tp-day-date">{label}</div>
              <div className={statusBadgeClass(status)} />
            </button>
          );
        })}
      </div>

      {anmeldungLoading && (
        <div className="tp-badge">Anmeldedaten werden geladen …</div>
      )}
    </div>
  );
}