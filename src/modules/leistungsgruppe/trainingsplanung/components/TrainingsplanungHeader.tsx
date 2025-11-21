import React from "react";
import { toISODate } from "../../common/date";
import type { Athlete } from "@/modules/athleten/types/athleten";
import type { DayStatus } from "../../anmeldung/services/AnmeldungStore";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type DayInfo = { date: string; status: DayStatus | null };

type Props = {
  dateISO: string;
  onChangeDate: (value: string) => void;
  currentWeek: number;
  weekDates: string[];
  dayInfos: DayInfo[];
  onlyRegistered: boolean;
  onToggleOnlyRegistered: (value: boolean) => void;

  athletes: Athlete[];
  athleteId: string;
  athleteName: string;
  onSelectAthlete: (id: string) => void;

  canSave: boolean;
  onSave: () => void;
  anmeldungLoading: boolean;
};

export default function TrainingsplanungHeader({
  dateISO,
  onChangeDate,
  currentWeek,
  weekDates,
  dayInfos,
  onlyRegistered,
  onToggleOnlyRegistered,
  athletes,
  athleteId,
  athleteName,
  onSelectAthlete,
  canSave,
  onSave,
  anmeldungLoading,
}: Props) {
  return (
    <div className="tp-header">
      <div>
        <div className="tp-section-title">Kalenderwoche</div>
        <div className="tp-badge">
          KW {currentWeek} &middot; {weekDates[0]} – {weekDates[6]}
        </div>
        <div className="tp-week-row">
          {dayInfos.map((d, idx) => {
            const label = WEEKDAY_LABELS[idx] ?? "";
            const isActive = d.date === dateISO;
            const cls = [
              "tp-day-chip",
              isActive ? "active" : "",
              d.status === "YES"
                ? "yes"
                : d.status === "MAYBE"
                ? "maybe"
                : d.status === "NO"
                ? "no"
                : "",
            ]
              .filter(Boolean)
              .join(" ");
            const disabled = onlyRegistered && d.status !== "YES";
            return (
              <button
                key={d.date}
                type="button"
                className={cls}
                disabled={disabled}
                onClick={() => onChangeDate(d.date)}
              >
                <div>{label}</div>
                <div className="tp-day-date">{d.date.slice(5)}</div>
              </button>
            );
          })}
        </div>
        {anmeldungLoading && (
          <div className="tp-badge">Anmeldungen werden geladen…</div>
        )}
      </div>

      <div>
        <div className="tp-section-title">Datum</div>
        <input
          className="tp-input"
          type="date"
          value={dateISO}
          onChange={(e) =>
            onChangeDate(e.target.value || toISODate(new Date()))
          }
        />
      </div>

      <div>
        <div className="tp-section-title">Athlet</div>
        <select
          className="tp-input"
          value={athleteId}
          onChange={(e) => onSelectAthlete(e.target.value)}
        >
          <option value="">– Athlet wählen –</option>
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

      <div>
        <div className="tp-section-title">Name</div>
        <input className="tp-input" placeholder="–" value={athleteName} readOnly />
      </div>

      <div style={{ alignSelf: "flex-end" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={onlyRegistered}
            onChange={(e) => onToggleOnlyRegistered(e.target.checked)}
          />
          Nur Tage mit JA
        </label>
      </div>

      <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
        <button
          className={"tp-btn primary"}
          disabled={!canSave}
          onClick={onSave}
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
