// src/modules/kindertraining/components/PersonList.tsx
import React from "react";
import type { Person } from "../lib/types";

function fmtDateDDMM(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}
function fmtWeekday2(d: Date) {
  return new Intl.DateTimeFormat("de-AT", { weekday: "short" }).format(d).slice(0, 2);
}

export default function PersonList(props: {
  persons: Person[];
  visibleDays: string[]; // ISO YYYY-MM-DD
  getAttendanceById: (id: string, dateStr: string) => boolean | null | undefined;
  toggleAttendanceById: (id: string, dateStr: string) => void;
  onClickName: (p: Person) => void;
  onOpenDayNote?: (dateStr: string) => void;
  sortOrder?: "vorname" | "nachname";
  nameColWidth?: number;
  inactiveDays?: Record<string, boolean>; // true = Tag inaktiv
  setInactiveForDate?: (dateStr: string, inactive: boolean) => void;
}) {
  const {
    persons,
    visibleDays,
    getAttendanceById,
    toggleAttendanceById,
    onClickName,
    onOpenDayNote,
    sortOrder = "vorname",
    nameColWidth = 220,
    inactiveDays = {},
    setInactiveForDate,
  } = props;

  return (
    <div className="kt-table" role="table" aria-label="Anwesenheitsliste">
      {/* Header */}
      <div className="kt-row kt-row--head" role="row">
        <div
          className="kt-col kt-col--name"
          role="columnheader"
          style={{ minWidth: nameColWidth, maxWidth: nameColWidth }}
        >
          Name
        </div>

        {visibleDays.map((d) => {
          const isInactive = !!inactiveDays[d]; // true => Tag inaktiv
          const dateObj = new Date(d);
          const checkedActive = !isInactive; // Checkbox: standardmäßig angehakt = aktiv
          return (
            <div key={d} className="kt-col kt-col--day" role="columnheader">
              <div className="kt-dayhead">
                {/* Checkbox über dem Datum: standardmäßig an (aktiv); Haken raus -> inaktiv + Notiz öffnen */}
                <label className="kt-check kt-check--day" title="Trainingstag aktiv/inaktiv">
                  <input
                    type="checkbox"
                    checked={checkedActive}
                    onChange={(e) => {
                      const makeInactive = !e.target.checked;
                      setInactiveForDate?.(d, makeInactive);
                      if (makeInactive) onOpenDayNote?.(d);
                    }}
                  />
                  <span className="kt-check__box" aria-hidden="true" />
                </label>

                <div className="kt-dayhead__date" aria-label={`Datum ${fmtDateDDMM(dateObj)}`}>
                  <div className="kt-dayhead__ddmm">{fmtDateDDMM(dateObj)}</div>
                  <div className="kt-dayhead__weekday">{fmtWeekday2(dateObj)}</div>
                </div>

                <button
                  type="button"
                  className="kt-icon-note"
                  title="Tagesnotiz"
                  onClick={() => onOpenDayNote?.(d)}
                >
                  📝
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      {persons.map((p) => {
        const displayName =
          sortOrder === "nachname" ? p.name.split(/\s+/).reverse().join(" ") : p.name;

        return (
          <div
            key={p.id || p.name}
            className={"kt-row" + (p.inactive ? " is-inactive" : "")}
            role="row"
          >
            <div
              className="kt-col kt-col--name"
              role="cell"
              style={{ minWidth: nameColWidth, maxWidth: nameColWidth }}
              onClick={() => onClickName(p)}
              title={displayName}
            >
              {/* €-Symbol links, falls "nicht bezahlt" gesetzt (paid === false) */}
              {p.paid === false && <span className="kt-icon kt-icon--euro" title="nicht bezahlt">€</span>}
              {displayName}
              {/* Stift rechts, falls Notiz vorhanden */}
              {p.generalNote && p.generalNote.trim() !== "" && (
                <span className="kt-icon kt-icon--note" title="Notiz vorhanden">✎</span>
              )}
            </div>

            {visibleDays.map((d) => {
              const checked = !!getAttendanceById(p.id as string, d);
              const disabled = !!inactiveDays[d];
              const checkedFinal = disabled ? false : checked;
              return (
                <div
                  key={d + (p.id || p.name)}
                  className={"kt-col kt-col--day" + (disabled ? " is-disabled" : "")}
                  role="cell"
                >
                  <label className="kt-check" title={`${displayName} – ${d}`} aria-label={`${displayName} – ${d}`}>
                    <input
                      type="checkbox"
                      checked={checkedFinal}
                      disabled={disabled}
                      onChange={() => toggleAttendanceById(p.id as string, d)}
                    />
                    <span className="kt-check__box" aria-hidden="true" />
                  </label>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
