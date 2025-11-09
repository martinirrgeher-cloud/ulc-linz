import React from "react";
import type { Person } from "../lib/types";

export default function PersonList(props: {
  persons: Person[];
  visibleDays: string[]; // ISO YYYY-MM-DD
  getAttendanceById: (id: string, dateStr: string) => boolean | null | undefined;
  toggleAttendanceById: (id: string, dateStr: string) => void;
  onClickName: (p: Person) => void;
  onOpenDayNote?: (dateStr: string) => void;
  nameColWidth?: number;
  inactiveDays?: Record<string, boolean>;
  setInactiveForDate?: (dateStr: string, inactive: boolean) => void;
}) {
  const {
    persons,
    visibleDays,
    getAttendanceById,
    toggleAttendanceById,
    onClickName,
    onOpenDayNote,
    nameColWidth = 220,
    inactiveDays = {},
    setInactiveForDate
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
          const inactive = !!inactiveDays[d];
          return (
            <div key={d} className="kt-col kt-col--day" role="columnheader">
              <div className="kt-dayhead">
                <div className="kt-dayhead__date">{d.slice(5)}</div>
                <div className="kt-dayhead__tools">
                  <label className="kt-dayhead__inactive" title="Tag inaktiv">
                    <input
                      type="checkbox"
                      checked={inactive}
                      onChange={(e) => setInactiveForDate?.(d, e.target.checked)}
                    />
                    <span className="kt-check__box" aria-hidden="true" />
                  </label>
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
            </div>
          );
        })}
      </div>

      {/* Body */}
      {persons.map((p) => (
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
          >
            {p.name}
          </div>

          {visibleDays.map((d) => {
            const checked = !!getAttendanceById(p.id as string, d);
            const disabled = !!inactiveDays[d];
            return (
              <div
                key={d + (p.id || p.name)}
                className={"kt-col kt-col--day" + (disabled ? " is-disabled" : "")}
                role="cell"
              >
                <label className="kt-check" title={`${p.name} – ${d}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleAttendanceById(p.id as string, d)}
                  />
                  <span className="kt-check__box" aria-hidden="true" />
                </label>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
