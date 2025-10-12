import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiEdit2, FiFileText } from "react-icons/fi";
import { useTrainingData, Person } from "./hooks/useTrainingData";
import { fmtISO, getSessionsForMonth, getMonthKey, getISOWeek } from "./utils/dateUtils";
import { ROUTES } from "../../routes"; // 🆕 zentralisierte Routen

export default function Kindertraining() {
  const { data, update } = useTrainingData();
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [columnState, setColumnState] = useState<Record<string, boolean>>({});
  const [sortMode, setSortMode] = useState<"firstName" | "lastName">("firstName");

  // 🆕 Ansicht: Monat / Woche
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedWeek, setSelectedWeek] = useState<number>(getISOWeek(new Date()));

  // Sortiermodus & Ansicht aus localStorage laden
  useEffect(() => {
    const stored = localStorage.getItem("training_sortMode");
    if (stored === "firstName" || stored === "lastName") setSortMode(stored);

    const storedView = localStorage.getItem("training_viewMode");
    if (storedView === "month" || storedView === "week") setViewMode(storedView);
  }, []);

  // speichern bei Änderung
  useEffect(() => {
    localStorage.setItem("training_sortMode", sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem("training_viewMode", viewMode);
  }, [viewMode]);

  // Monat & Wochentage
  const [monthStart, setMonthStart] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const currentMonthKey = getMonthKey(monthStart);
  const selectedWeekdays = data.weekdaysByMonth?.[currentMonthKey] ?? [2];

  const allSessions = useMemo(
    () => getSessionsForMonth(monthStart, selectedWeekdays),
    [monthStart, selectedWeekdays]
  );

  const sessions = useMemo(() => {
    if (viewMode === "week") {
      return allSessions.filter((d) => getISOWeek(d) === selectedWeek);
    }
    return allSessions;
  }, [allSessions, viewMode, selectedWeek]);

  // verfügbare Wochen im Monat für Dropdown
  const availableWeeks = useMemo(() => {
    const weeks = Array.from(new Set(allSessions.map((d) => getISOWeek(d)))).sort((a, b) => a - b);
    return weeks;
  }, [allSessions]);

  // Personen sortieren
  const sortedPeople = useMemo(() => {
    const active = data.people.filter((p) => p.active);
    const inactive = data.people.filter((p) => !p.active);

    const sortFunc = (a: Person, b: Person) => {
      const primA = sortMode === "firstName" ? a.firstName.toLowerCase() : a.lastName.toLowerCase();
      const primB = sortMode === "firstName" ? b.firstName.toLowerCase() : b.lastName.toLowerCase();
      const secA = sortMode === "firstName" ? a.lastName.toLowerCase() : a.firstName.toLowerCase();
      const secB = sortMode === "firstName" ? b.lastName.toLowerCase() : b.firstName.toLowerCase();
      return primA.localeCompare(primB) || secA.localeCompare(secB);
    };

    return [...active.sort(sortFunc), ...inactive.sort(sortFunc)];
  }, [data.people, sortMode]);

  const visiblePeople = sortedPeople.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAttendance = (dateISO: string, person: Person) => {
    update((prev) => {
      const records = { ...prev.records };
      const day = { ...(records[dateISO] || {}) };
      const fullName = `${person.firstName} ${person.lastName}`.trim();
      day[fullName] = !day[fullName];
      records[dateISO] = day;
      return { ...prev, records };
    });
  };

  const toggleColumnActive = (dateISO: string) => {
    setColumnState((prev) => ({
      ...prev,
      [dateISO]: prev[dateISO] === false ? true : false
    }));
  };

  const addPerson = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const parts = trimmed.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    update((prev) => ({
      ...prev,
      people: [...prev.people, { firstName, lastName, active: true }],
    }));
    setNewName("");
  };

  const renamePerson = (index: number, value: string) => {
    const parts = value.trim().split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    update((prev) => ({
      ...prev,
      people: prev.people.map((p, i) =>
        i === index ? { ...p, firstName, lastName } : p
      ),
    }));
    setEditIndex(null);
  };

  const togglePersonActive = (person: Person) => {
    update((prev) => ({
      ...prev,
      people: prev.people.map((p) =>
        p === person ? { ...p, active: !p.active } : p
      ),
    }));
  };

  return (
    <div className="container">
      {/* Kopfzeile */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="ghost"
            onClick={() =>
              setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
            }
          >
            ◀
          </button>
          <h1 style={{ fontSize: "1.6rem", fontWeight: "bold" }}>
            Kindertraining –{" "}
            {monthStart.toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </h1>
          <button
            className="ghost"
            onClick={() =>
              setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
            }
          >
            ▶
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to={ROUTES.MENU} className="ghost">🏠 Hauptmenü</Link>
          <Link to={ROUTES.KINDERTRAINING_WOCHENTAGE} className="ghost">🗓️ Wochentage</Link>
          <Link to={ROUTES.KINDERTRAINING_STATISTIK} className="ghost">📊 Statistik</Link>
        </div>
      </div>

      {/* Steuerung */}
      <div className="card control-panel">
        {/* 🔍 Such- und Eingabefeld */}
        
          <div className="input-inline">
            <input
              type="text"
              placeholder="Vor- und Nachname eingeben"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPerson()}
            />
            <button onClick={addPerson}>Hinzufügen</button>
          </div>
        </div>

        <div className="control-row">
          <div className="input-inline">
            <input
              type="text"
              placeholder="Name suchen…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button onClick={() => setSearch(searchInput)}>Suchen</button>
          </div>

        {/* ↔️ Sortierung + Ansicht */}
        <div className="control-row center-row">
          <div className="button-group">
            <button
              className={`ghost ${sortMode === "firstName" ? "note-active" : ""}`}
              onClick={() => setSortMode("firstName")}
            >
              Sortiere nach Vorname
            </button>
            <button
              className={`ghost ${sortMode === "lastName" ? "note-active" : ""}`}
              onClick={() => setSortMode("lastName")}
            >
              Sortiere nach Nachname
            </button>
          </div>

          <div className="button-group">
            <button
              className={`ghost ${viewMode === "month" ? "note-active" : ""}`}
              onClick={() => setViewMode("month")}
            >
              Monatsansicht
            </button>
            <button
              className={`ghost ${viewMode === "week" ? "note-active" : ""}`}
              onClick={() => setViewMode("week")}
            >
              Wochenansicht
            </button>

            {viewMode === "week" && (
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="kw-select"
              >
                {availableWeeks.map((kw) => (
                  <option key={kw} value={kw}>
                    KW {kw}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="table-wrap card">
        <div className="training-table-container">
          <table className="training-table">
            <thead>
              <tr>
                <th className="sticky-col name-col-auto">Name</th>
                {sessions.map((d) => {
                  const iso = fmtISO(d);
                  const noteVal = data.notes?.[iso] || "";
                  const colActive = columnState[iso] !== false;

                  return (
                    <th key={iso} className={!colActive ? "inactive-col" : ""}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={colActive}
                          onChange={() => toggleColumnActive(iso)}
                          title="Tag aktivieren/deaktivieren"
                        />
                        <div>{d.getDate()}</div>
                        <div className="small">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                        <button
                          className={`icon-btn ${noteVal ? "note-active" : ""}`}
                          title={noteVal || "Notiz hinzufügen"}
                          onClick={() => {
                            const note = prompt(`Notiz für ${iso}:`, noteVal);
                            if (note !== null) {
                              update((prev) => ({
                                ...prev,
                                notes: { ...prev.notes, [iso]: note },
                              }));
                            }
                          }}
                        >
                          <FiFileText />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((p, index) => (
                <tr
                  key={`${p.firstName}-${p.lastName}-${index}`}
                  className={p.active ? "" : "inactive-row"}
                >
                  <td
                    className="sticky-col name-col-auto"
                    title={`${p.firstName} ${p.lastName}`}
                  >
                    {editIndex === index ? (
                      <div className="input-inline">
                        <input
                          autoFocus
                          defaultValue={`${p.firstName} ${p.lastName}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              renamePerson(index, (e.target as HTMLInputElement).value);
                            if (e.key === "Escape") setEditIndex(null);
                          }}
                        />
                        <button onClick={() => setEditIndex(null)}>✖</button>
                      </div>
                    ) : (
                      <div className="name-cell">
                        <div className="name-row">
                          <strong>{p.firstName}</strong>
                          <button
                            className="icon-btn edit-btn"
                            onClick={() => setEditIndex(index)}
                          >
                            <FiEdit2 />
                          </button>
                        </div>
                        <div className="name-row">
                          <span>{p.lastName}</span>
                          <button
                            className="icon-btn status-btn"
                            onClick={() => togglePersonActive(p)}
                            title={p.active ? "aktiv" : "inaktiv"}
                          >
                            {p.active ? "🟢" : "🟡"}
                          </button>
                        </div>
                      </div>
                    )}
                  </td>

                  {sessions.map((d) => {
                    const iso = fmtISO(d);
                    const colActive = columnState[iso] !== false;
                    const fullName = `${p.firstName} ${p.lastName}`.trim();
                    const checked = !!data.records?.[iso]?.[fullName];
                    return (
                      <td key={iso} className={!colActive ? "inactive-col" : ""}>
                        {colActive && (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAttendance(iso, p)}
                            title={`${fullName} – ${iso}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
