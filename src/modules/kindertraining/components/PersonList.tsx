import React, { useState } from "react";
import type { KTPerson } from "../lib/kindertrainingPersonenDrive";
import type { KTSettings } from "../hooks/useKindertraining";

type Props = {
  persons: KTPerson[];
  days: string[];
  inactiveDays: Record<string, boolean>;
  dayNotes: Record<string, string>;
  toggleAttendance: (person: string, day: string) => void;
  openPerson: string | null;
  setOpenPerson: (person: string | null) => void;
  deletePerson: (person: string) => void;
  renamePerson: (oldName: string, newName: string) => void;
  setPaid: (person: string, paid: boolean) => void;
  setInactive: (person: string, inactive: boolean) => void;
  setDayInactive: (day: string, inactive: boolean) => void;
  setDayNote: (day: string, note: string) => void;
  getAttendanceChecked: (person: string, day: string) => boolean;
  setGeneralNote: (person: string, note: string) => void;
  settings: KTSettings | undefined;
};

export default function PersonList({
  persons,
  days,
  inactiveDays,
  dayNotes,
  toggleAttendance,
  openPerson,
  setOpenPerson,
  deletePerson,
  renamePerson,
  setPaid,
  setInactive,
  setDayInactive,
  setDayNote,
  getAttendanceChecked,
  setGeneralNote,
  settings,
}: Props) {
  const [renameBuffer, setRenameBuffer] = useState<string>("");

  const weekdayShortOf = (isoDate: string) => {
    const d = new Date(isoDate);
    const map = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
    return map[d.getDay()];
  };

  const ddmmOf = (isoDate: string) => {
    const d = new Date(isoDate);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}`;
  };

  // Sortierung basierend auf Einstellungen
  const sortedPersons = [...persons].sort((a, b) => {
    if (a.inactive && !b.inactive) return 1;
    if (!a.inactive && b.inactive) return -1;

    if (settings?.sortOrder === "nachname") {
      const lastA = a.name.split(" ").slice(-1)[0];
      const lastB = b.name.split(" ").slice(-1)[0];
      return lastA.localeCompare(lastB, "de");
    }

    const firstA = a.name.split(" ")[0];
    const firstB = b.name.split(" ")[0];
    return firstA.localeCompare(firstB, "de");
  });

  return (
    <div className="kt-personlist">
      <div className="kt-person-table-container">
        <table className="kt-person-table kt-table">
          <thead>
            {/* Zeile 1: Datum + Wochentag */}
            <tr>
              <th className="nameCol" rowSpan={2}>Name</th>
              {days.map((day) => (
                <th
                  key={day}
                  className={
                    "dateHeader " + (!inactiveDays[day] ? "" : "disabled-col-header")
                  }
                >
                  <div>{ddmmOf(day)}</div>
                  <div className="dayLabel">{weekdayShortOf(day)}</div>
                </th>
              ))}
            </tr>

            {/* Zeile 2: Buttons */}
            <tr>
              {days.map((day) => {
                const isActive = !inactiveDays[day];
                const hasNote = !!dayNotes[day];
                const noteText = dayNotes[day] ?? "";
                return (
                  <th
                    key={day}
                    className={
                      "dateHeader " + (isActive ? "" : "disabled-col-header")
                    }
                  >
                    <button
                      className="ghost dateToggle"
                      aria-pressed={!isActive}
                      onClick={() => {
                        const willDeactivate = !inactiveDays[day];
                        if (willDeactivate) {
                          const cur = dayNotes[day] ?? "";
                          const reason = window.prompt("Grund für Ausfall/Deaktivierung:", cur) ?? cur;
                          setDayNote(day, reason);
                          setDayInactive(day, true);
                        } else {
                          if (dayNotes[day]) setDayNote(day, "");
                          setDayInactive(day, false);
                        }
                      }}
                    >
                      {isActive ? "✅" : "🚫"}
                    </button>

                    <button
                      className={"ghost note-btn" + (hasNote ? " has-note" : "")}
                      onClick={() => {
                        const cur = noteText;
                        const n = window.prompt("Notiz für diesen Tag:", cur) ?? cur;
                        if (n !== cur) setDayNote(day, n);
                      }}
                      title={hasNote ? noteText : "Notiz hinzufügen"}
                    >
                      📝
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedPersons.map((person) => {
              const isOpen = openPerson === person.name;
              return (
                <React.Fragment key={person.name}>
                  <tr
                    className={
                      "personRow " + (person.inactive ? "inactivePersonRow" : "")
                    }
                  >
                    <td className="nameCol">
                      {person.notPaid && <span className="euroIcon">€</span>}
                      <button
                        className="nameButton"
                        onClick={() => {
                          setOpenPerson(isOpen ? null : person.name);
                          setRenameBuffer(person.name);
                        }}
                      >
                        {person.name}
                        {person.note?.trim() && (
                          <span className="noteIconSmall">🖊️</span>
                        )}
                      </button>
                    </td>
                    {days.map((day) => {
                      const disabled = !!inactiveDays?.[day];
                      const checked = getAttendanceChecked(person.name, day);
                      return (
                        <td
                          key={day}
                          className={"dayCell " + (disabled ? "disabled" : "")}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() =>
                              toggleAttendance(person.name, day)
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {isOpen && (
                    <tr className="menuRow">
                      <td colSpan={days.length + 1}>
                        <div className="personMenuWide">
                          {/* 1. Zeile: Name + Schließen */}
                          <div className="personMenuRow header">
                            <input
                              type="text"
                              defaultValue={person.name}
                              onBlur={(e) => {
                                const newName = e.target.value.trim();
                                if (newName && newName !== person.name) {
                                  renamePerson(person.name, newName);
                                }
                              }}
                              placeholder="Name bearbeiten..."
                            />
                            <button
                              className="closeBtn"
                              onClick={() => setOpenPerson(null)}
                              title="Schließen"
                            >
                              ✖
                            </button>
                          </div>

                          {/* 2. Zeile: Notiz */}
                          <div className="personMenuRow note">
                            <textarea
                              value={person.note ?? ""}
                              onChange={(e) => setGeneralNote(person.name, e.target.value)}
                              placeholder="Notiz eingeben..."
                              rows={2}
                            />
                          </div>

                          {/* 3. Zeile: Aktionen */}
                          <div className="personMenuRow actions">
                            <div className="action-left">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={!!person.notPaid}
                                  onChange={(e) => setPaid(person.name, e.target.checked)}
                                />
                                Nicht bezahlt
                              </label>
                            </div>
                            <div className="action-center">
                              <button
                                className={`inactiveBtn ${person.inactive ? "active" : ""}`}
                                onClick={() => setInactive(person.name, !person.inactive)}
                                title="Inaktiv schalten"
                              >
                                👁️‍🗨️ Inaktiv
                              </button>
                            </div>
                            <div className="action-right">
                              <button
                                className="dangerBtn"
                                onClick={() => {
                                  if (confirm(`'${person.name}' wirklich löschen?`)) {
                                    deletePerson(person.name);
                                    setOpenPerson(null);
                                  }
                                }}
                              >
                                🗑️ Löschen
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
