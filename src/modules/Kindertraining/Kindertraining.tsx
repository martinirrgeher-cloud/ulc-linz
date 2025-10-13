import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FiEdit2, FiFileText, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useTrainingData, Person } from "./hooks/useTrainingData";
import { fmtISO, getSessionsForMonth, getMonthKey, getISOWeek } from "./utils/dateUtils";
import { ROUTES } from "../../routes";
import styles from "./Kindertraining.module.css";

export default function Kindertraining() {
  const { data, update } = useTrainingData();
  const [newName, setNewName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [columnState, setColumnState] = useState<Record<string, boolean>>({});
  const [sortMode, setSortMode] = useState<"firstName" | "lastName">("firstName");
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedWeek, setSelectedWeek] = useState<number>(getISOWeek(new Date()));
  const [showOptions, setShowOptions] = useState(false);
  const [showHiddenPeople, setShowHiddenPeople] = useState(false);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Menü schließen bei Klick außerhalb
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuIndex(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sortiermodus / Ansicht laden
  useEffect(() => {
    const storedSort = localStorage.getItem("training_sortMode");
    if (storedSort === "firstName" || storedSort === "lastName") setSortMode(storedSort);
    const storedView = localStorage.getItem("training_viewMode");
    if (storedView === "month" || storedView === "week") setViewMode(storedView);
  }, []);

  useEffect(() => {
    localStorage.setItem("training_sortMode", sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem("training_viewMode", viewMode);
  }, [viewMode]);

  // Monat & Trainingstage
  const [monthStart, setMonthStart] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const currentMonthKey = getMonthKey(monthStart);
  const selectedWeekdays = data?.weekdaysByMonth?.[currentMonthKey] ?? [2];

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

  const availableWeeks = useMemo(() => {
    const weeks = Array.from(new Set(allSessions.map((d) => getISOWeek(d)))).sort((a, b) => a - b);
    return weeks;
  }, [allSessions]);

  // Personen sortieren
  const sortedPeople = useMemo(() => {
    const allPeople = data?.people ?? [];
    const active = allPeople.filter((p) => !p.hidden);
    const hidden = allPeople.filter((p) => p.hidden);

    const sortFunc = (a: Person, b: Person) => {
      const primA = sortMode === "firstName" ? a.firstName.toLowerCase() : a.lastName.toLowerCase();
      const primB = sortMode === "firstName" ? b.firstName.toLowerCase() : b.lastName.toLowerCase();
      const secA = sortMode === "firstName" ? a.lastName.toLowerCase() : a.firstName.toLowerCase();
      const secB = sortMode === "firstName" ? b.lastName.toLowerCase() : b.firstName.toLowerCase();
      return primA.localeCompare(primB) || secA.localeCompare(secB);
    };

    return {
      visible: active.sort(sortFunc),
      hidden: hidden.sort(sortFunc)
    };
  }, [data?.people, sortMode]);

  const visiblePeople = sortedPeople.visible.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchInput.toLowerCase())
  );

  // Menüaktionen
  const renamePerson = (person: Person) => {
    const val = prompt("Name ändern:", `${person.firstName} ${person.lastName}`);
    if (val) {
      const parts = val.trim().split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ");
      update((prev) => ({
        ...prev,
        people: prev.people.map((p) =>
          p === person ? { ...p, firstName, lastName } : p
        ),
      }));
    }
    setActiveMenuIndex(null);
  };

  const toggleHidden = (person: Person) => {
    update((prev) => ({
      ...prev,
      people: prev.people.map((p) =>
        p === person ? { ...p, hidden: !p.hidden } : p
      ),
    }));
    setActiveMenuIndex(null);
  };

  const togglePaid = (person: Person) => {
    update((prev) => ({
      ...prev,
      people: prev.people.map((p) =>
        p === person ? { ...p, paid: !p.paid } : p
      ),
    }));
    setActiveMenuIndex(null);
  };

  const setComment = (person: Person) => {
    const val = prompt("Kommentar für " + person.firstName, person.comment ?? "");
    if (val !== null) {
      update((prev) => ({
        ...prev,
        people: prev.people.map((p) =>
          p === person ? { ...p, comment: val.trim() } : p
        ),
      }));
    }
    setActiveMenuIndex(null);
  };

  // Anwesenheit
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
      people: [
        ...(prev.people ?? []),
        { firstName, lastName, hidden: false, paid: true, comment: "" },
      ],
    }));
    setNewName("");
  };

  return (
    <div className="container">
      {/* Kopfzeile */}
      <div className={styles.header}>
        <div className={styles.monthNav}>
          <button className="ghost" onClick={() =>
            setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
          }>◀</button>
          <h1 className={styles.monthTitle}>
            Kindertraining –{" "}
            {monthStart.toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </h1>
          <button className="ghost" onClick={() =>
            setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
          }>▶</button>
        </div>
        <div className={styles.menuLinks}>
          <Link to={ROUTES.MENU} className="ghost">🏠 Hauptmenü</Link>
          <Link to={ROUTES.KINDERTRAINING_WOCHENTAGE} className="ghost">🗓️ Wochentage</Link>
          <Link to={ROUTES.KINDERTRAINING_STATISTIK} className="ghost">📊 Statistik</Link>
          <button className="ghost" onClick={() => setShowOptions((prev) => !prev)}>
            Zusatzoptionen {showOptions ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </div>
      </div>

      {showOptions && (
        <div className={styles.optionsMenu}>
          <div className="button-group">
            <button className={`ghost ${sortMode === "firstName" ? "note-active" : ""}`}
              onClick={() => setSortMode("firstName")}>Sortiere nach Vorname</button>
            <button className={`ghost ${sortMode === "lastName" ? "note-active" : ""}`}
              onClick={() => setSortMode("lastName")}>Sortiere nach Nachname</button>
          </div>

          <div className="button-group">
            <button className={`ghost ${viewMode === "month" ? "note-active" : ""}`}
              onClick={() => setViewMode("month")}>Monatsansicht</button>
            <button className={`ghost ${viewMode === "week" ? "note-active" : ""}`}
              onClick={() => setViewMode("week")}>Wochenansicht</button>

            {viewMode === "week" && (
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="kw-select"
              >
                {availableWeeks.map((kw) => (
                  <option key={`kw-${kw}`} value={kw}>KW {kw}</option>
                ))}
              </select>
            )}
          </div>

          {sortedPeople.hidden.length > 0 && (
            <div className="button-group">
              <button className="ghost" onClick={() => setShowHiddenPeople((prev) => !prev)}>
                {showHiddenPeople
                  ? "Ausgeblendete ausblenden"
                  : `Ausgeblendete anzeigen (${sortedPeople.hidden.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Steuerung */}
      <div className="card control-panel">
        <div className={styles.inputRow}>
          <div className={styles.addPersonContainer}>
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

        <div className={styles.inputRow}>
          <div className="input-inline">
            <input
              type="text"
              placeholder="Name suchen…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <div className="table-wrap card" ref={menuRef}>
        <div className="training-table-container">
          <table className="training-table">
            <thead>
              <tr>
                <th className="sticky-col name-col-auto">Name</th>
                {sessions.map((d) => {
                  const iso = fmtISO(d);
                  const noteVal = data?.notes?.[iso] || "";
                  const colActive = columnState[iso] !== false;

                  return (
                    <th key={`col-${iso}`} className={!colActive ? "inactive-col" : ""}>
                      <div className={styles.tableHeaderCell}>
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
                <tr key={`${p.firstName}-${p.lastName}-${index}`}>
                  <td
                    className={`sticky-col name-col-auto ${styles.personCell} ${
                      p.paid === false ? styles.nameUnpaid : ""
                    } ${
                      p.comment && p.comment.length > 0 ? styles.nameHasComment : ""
                    }`}
                  >
                   <div className={styles.nameInline}>
  <span><strong>{p.firstName}</strong> {p.lastName}</span>
  <div className={styles.iconWrapper}>
    {p.paid === false && <span className={styles.unpaidIcon}>🚫💶</span>}
    <button
      className="icon-btn edit-btn"
      onClick={() => setActiveMenuIndex(index === activeMenuIndex ? null : index)}
    >
      <FiEdit2 />
    </button>
  </div>
</div>

                    {activeMenuIndex === index && (
                      <div className={styles.personMenu}>
                        <button onClick={() => renamePerson(p)}>✍️ Name ändern</button>
                        <button onClick={() => toggleHidden(p)}>🚫 Ausblenden</button>
                        <button onClick={() => togglePaid(p)}>
                          {p.paid === false ? "💰 Als bezahlt markieren" : "❌ Als nicht bezahlt markieren"}
                        </button>
                        <button onClick={() => setComment(p)}>
                          📝 {p.comment ? "Kommentar bearbeiten" : "Kommentar hinzufügen"}
                        </button>
                        {p.comment && p.comment.length > 0 && (
                          <div className={styles.commentDisplay}>{p.comment}</div>
                        )}
                      </div>
                    )}
                  </td>

                  {sessions.map((d) => {
                    const iso = fmtISO(d);
                    const colActive = columnState[iso] !== false;
                    const fullName = `${p.firstName} ${p.lastName}`.trim();
                    const checked = !!data?.records?.[iso]?.[fullName];

                    return (
                      <td
                        key={`cell-${iso}-${p.firstName}-${p.lastName}`}
                        className={`${!colActive ? "inactive-col" : ""} ${styles.attendanceCell}`}
                      >
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

              {/* Ausgeblendete Personen */}
              {showHiddenPeople && sortedPeople.hidden.length > 0 && (
                <>
                  {sortedPeople.hidden.map((p, index) => (
                    <tr
                      key={`hidden-${p.firstName}-${p.lastName}-${index}`}
                      className={styles.hiddenRow}
                    >
                      <td className={`sticky-col name-col-auto ${styles.personCell}`}>
                        <div className={styles.nameInline}>
                          <span><strong>{p.firstName}</strong> {p.lastName}</span>
                          <button
                            className="icon-btn edit-btn"
                            onClick={() => setActiveMenuIndex(index + 10000)}
                          >
                            <FiEdit2 />
                          </button>
                        </div>
                        {activeMenuIndex === index + 10000 && (
                          <div className={styles.personMenu}>
                            <button onClick={() => toggleHidden(p)}>👁️ Wieder einblenden</button>
                            <button onClick={() => togglePaid(p)}>
                              {p.paid === false ? "💰 Als bezahlt markieren" : "❌ Als nicht bezahlt markieren"}
                            </button>
                            <button onClick={() => setComment(p)}>
                              📝 {p.comment ? "Kommentar bearbeiten" : "Kommentar hinzufügen"}
                            </button>
                            {p.comment && p.comment.length > 0 && (
                              <div className={styles.commentDisplay}>{p.comment}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td colSpan={sessions.length} className={styles.hiddenCell}>
                        (ausgeblendet)
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
