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
  dateISO: string | null;
  onChangeDate: (d: string) => void;
  statusMap: StatusMap;
  anmeldungLoading: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
};

const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function statusBadgeClass(status: DayStatus | null | undefined): string {
  if (!status) return "tp-day-status none";

  const v = status.toString().toUpperCase();
  if (v === "YES") return "tp-day-status yes";
  if (v === "NO") return "tp-day-status no";
  if (v === "MAYBE") return "tp-day-status maybe";

  return "tp-day-status none";
}

function TrainingsplanungHeader(props: Props) {
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
      {/* KW-Navigation oberhalb des Athleten-Dropdowns */}
      <div className="tp-week-nav">
        <button type="button" className="tp-btn" onClick={onPrevWeek}>
          ◀
        </button>
        <div className="tp-week-label">{weekLabel}</div>
        <button type="button" className="tp-btn" onClick={onNextWeek}>
          ▶
        </button>
      </div>

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

          const cls = ["tp-day-button", isSelected ? "selected" : ""]
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

export default TrainingsplanungHeader;
