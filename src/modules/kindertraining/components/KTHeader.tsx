// src/modules/kindertraining/components/KTHeader.tsx
import React from "react";

type DayToggle = { key: string; name: string; visible: boolean };

type Props = {
  weekNumber: number;
  year: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;

  search?: string;
  onSearch?: (q: string) => void;
  onAdd?: () => void;

  sortOrder: "vorname" | "nachname";
  onChangeSort: (v: "vorname" | "nachname") => void;
  showInactive: boolean;
  onToggleShowInactive: (value: boolean) => void;

  dayToggles: DayToggle[];
  onToggleDay: (key: string, visible: boolean) => void;
};

export default function KTHeader(props: Props) {
  return (
    <header className="kt-header kt-header--sticky" aria-label="Kindertraining Kopf">
      {/* Zeile 1: Kalender */}
      <div className="kt-row kt-row--cal">
        <button className="kt-nav" onClick={props.onPrevWeek} aria-label="Vorige Woche">‹</button>
        <div className="kt-cal-label">KW {String(props.weekNumber).padStart(2, "0")} – {props.year}</div>
        <button className="kt-nav" onClick={props.onNextWeek} aria-label="Nächste Woche">›</button>
      </div>

      {/* Zeile 2: Suche + Neuer Athlet */}
      <div className="kt-row kt-row--searchadd">
        <input
          className="kt-input kt-input--search"
          placeholder="Suche Name..."
          value={props.search ?? ""}
          onChange={(e) => props.onSearch?.(e.target.value)}
        />
        <button
          className="btn btn--icon"
          title="Neuer Athlet"
          aria-label="Neuer Athlet"
          onClick={props.onAdd}
          type="button"
        >
          +
        </button>
      </div>

      {/* Zeile 3: Sort, Trainingstage (größer), Toggle ganz rechts */}
      <div className="kt-row kt-row--filters">
        <div className="kt-flex-left">
          <label className="kt-field"><select
              className="kt-select" aria-label="Sortieren"
              value={props.sortOrder}
              onChange={(e) => props.onChangeSort(e.target.value as "vorname" | "nachname")}
            >
              <option value="vorname">Vorname</option>
              <option value="nachname">Nachname</option>
            </select>
          </label>

          <div className="kt-days">
            <button
              className="kt-days__btn kt-lg"
              type="button"
              aria-haspopup="listbox"
              aria-expanded="false"
              title="Trainingstage auswählen"
            >
              Trainingstage
            </button>
            <div className="kt-days__menu" role="listbox">
              {props.dayToggles.map((d) => (
                <label key={d.key} className="kt-days__item">
                  <input
                    type="checkbox"
                    checked={!!d.visible}
                    onChange={(e) => props.onToggleDay(d.key, e.target.checked)}
                  />
                  <span>{d.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="kt-actions-right">
          <button
            type="button"
            className={`toggle-switch ${!props.showInactive ? "on" : "off"}`}
            onClick={() => props.onToggleShowInactive(!props.showInactive)}
            aria-pressed={!props.showInactive}
            aria-label={!props.showInactive ? "Nur aktive" : "Auch inaktive"}
            title={!props.showInactive ? "Nur aktive" : "Auch inaktive"}
          >
            <span className="knob" />
          </button>
        </div>
      </div>
    </header>
  );
}
