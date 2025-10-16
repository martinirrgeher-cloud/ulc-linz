import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiEdit2, FiChevronDown, FiChevronUp, FiFileText, FiArrowLeft } from "react-icons/fi";
import { useTrainingData, Person } from "./hooks/useTrainingData";
import { fmtISO, getMonthKey, getSessionsForMonth, getISOWeek } from "./utils/dateUtils";
import styles from "./Kindertraining.module.css";

type SortMode = "firstName" | "lastName";
type ViewMode = "month" | "week";

export default function Kindertraining() {
  const navigate = useNavigate();
  const { data, update } = useTrainingData();

  const [monthStart, setMonthStart] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const currentMonthKey = getMonthKey(monthStart);
  const selectedWeekdays = data?.weekdaysByMonth?.[currentMonthKey] ?? [2];

  const [sortMode, setSortMode] = useState<SortMode>("firstName");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedWeek, setSelectedWeek] = useState<number>(getISOWeek(new Date()));

  const [showOptions, setShowOptions] = useState(false);
  const [showHiddenNames, setShowHiddenNames] = useState(false);
  const [newName, setNewName] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [columnState, setColumnState] = useState<Record<string, boolean>>({});
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

  // Sortierung & Ansicht laden/speichern
  useEffect(() => {
    const s = localStorage.getItem("training_sortMode");
    if (s === "firstName" || s === "lastName") setSortMode(s);
    const v = localStorage.getItem("training_viewMode");
    if (v === "month" || v === "week") setViewMode(v);
  }, []);
  useEffect(() => localStorage.setItem("training_sortMode", sortMode), [sortMode]);
  useEffect(() => localStorage.setItem("training_viewMode", viewMode), [viewMode]);

  const allSessions = useMemo(
    () => getSessionsForMonth(monthStart, selectedWeekdays),
    [monthStart, selectedWeekdays]
  );

  const availableWeeks = useMemo(() => {
    const set = new Set<number>();
    allSessions.forEach((d) => set.add(getISOWeek(d)));
    const arr = Array.from(set).sort((a, b) => a - b);
    if (!arr.includes(selectedWeek) && arr.length > 0) setSelectedWeek(arr[0]);
    return arr;
  }, [allSessions.length]);

  const sessions = useMemo(() => {
    if (viewMode === "week") {
      return allSessions.filter((d) => getISOWeek(d) === selectedWeek);
    }
    return allSessions;
  }, [allSessions, viewMode, selectedWeek]);

  // columnState initialisieren
  useEffect(() => {
    const init: Record<string, boolean> = {};
    sessions.forEach((d) => (init[fmtISO(d)] = columnState[fmtISO(d)] ?? true));
    setColumnState((prev) => ({ ...init, ...prev }));
  }, [sessions.length]);

  const sortedActivePeople = useMemo(() => {
    const arr = (data.people ?? []).filter((p) => p && p.active);
    const sortFn = (a: Person, b: Person) => {
      const aPrimary = sortMode === "firstName" ? a.firstName : a.lastName;
      const bPrimary = sortMode === "firstName" ? b.firstName : b.lastName;
      const aSec = sortMode === "firstName" ? a.lastName : a.firstName;
      const bSec = sortMode === "firstName" ? b.lastName : b.firstName;
      return aPrimary.localeCompare(bPrimary) || aSec.localeCompare(bSec);
    };
    return arr.sort(sortFn);
  }, [data.people, sortMode]);

  const hiddenPeople = useMemo(() => {
    return (data.people ?? [])
      .filter((p) => !p.active)
      .sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [data.people]);

  const visiblePeople = sortedActivePeople.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchInput.toLowerCase())
  );

  // ===========================
  // Person bearbeiten
  // ===========================
  const editName = (person: Person) => {
    const current = `${person.firstName} ${person.lastName}`.trim();
    const val = prompt("Name bearbeiten:", current);
    if (val && val.trim()) {
      const parts = val.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");
      update((prev) => ({
        ...prev,
        people: prev.people.map((p) =>
          p === person ? { ...p, firstName, lastName } : p
        ),
      }));
    }
  };

  const editComment = (person: Person) => {
    const val = prompt("Kommentar bearbeiten:", person.comment || "");
    update((prev) => ({
      ...prev,
      people: prev.people.map((p) =>
        p === person ? { ...p, comment: val || "" } : p
      ),
    }));
  };

  const togglePaidStatus = (person: Person) => {
    update((prev) => ({
      ...prev,
      people: prev.people.map((p) =>
        p === person ? { ...p, paid: !p.paid } : p
      ),
    }));
  };

  const deletePerson = (person: Person) => {
    if (!confirm(`Möchtest du ${person.firstName} ${person.lastName} wirklich löschen?`)) return;
    update((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p !== person),
    }));
  };

  const addPerson = () => {
    const val = newName.trim();
    if (!val) return;
    const parts = val.split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    update((prev) => ({
      ...prev,
      people: [...prev.people, { firstName, lastName, active: true, paid: true }],
    }));
    setNewName("");
  };

  const toggleHidden = (person: Person) => {
    update((prev) => ({
      ...prev,
      people: prev.people.map((p) =>
        p === person ? { ...p, active: !p.active } : p
      ),
    }));
    setActiveMenuIndex(null);
  };

  const toggleAttendance = (name: string, iso: string) => {
    update((prev) => {
      const rec = prev.records?.[iso] || {};
      return {
        ...prev,
        records: {
          ...prev.records,
          [iso]: { ...rec, [name]: !rec[name] },
        },
      };
    });
  };

  const setNoteForDay = (iso: string) => {
    const val = prompt("Notiz:", data.notes?.[iso] || "");
    update((prev) => ({
      ...prev,
      notes: { ...prev.notes, [iso]: val || "" },
    }));
  };

  const toggleColumn = (iso: string, checked: boolean) => {
    setColumnState((prev) => ({ ...prev, [iso]: checked }));
  };

  const displayName = (p: Person) =>
    sortMode === "lastName"
      ? `${p.lastName} ${p.firstName}`.trim()
      : `${p.firstName} ${p.lastName}`.trim();

  const weekdayShort = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short" });

  const openMenuAtButton = (btn: HTMLElement) => {
    const rect = btn.getBoundingClientRect();
    document.documentElement.style.setProperty("--menu-top", `${rect.bottom}px`);
    document.documentElement.style.setProperty("--menu-left", `${rect.right + 8}px`);
  };

  return (
    <div className={styles.container}>
      {/* Kopf */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          {/* 🔙 Zurück-Button */}
          <button
            className="ghost"
            onClick={() => navigate("/")}
            title="Zurück zur Modulübersicht"
          >
            <FiArrowLeft size={20} />
          </button>

          {/* Monat Navigation */}
          <button
            onClick={() =>
              setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
            }
          >
            ◀
          </button>
          <strong>
            {monthStart.toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </strong>
          <button
            onClick={() =>
              setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
            }
          >
            ▶
          </button>
        </div>

        <div className={styles.headerRight}>
          <Link to="/kindertraining/wochentage" className="ghost">🗓️ Wochentage</Link>
          <Link to="/kindertraining/statistik" className="ghost">📊 Statistik</Link>
          <button className="ghost" onClick={() => setShowOptions((p) => !p)}>
            Zusatzoptionen {showOptions ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </div>
      </div>

      {/* Zusatzoptionen */}
      {showOptions && (
        <div className={styles.optionsMenu}>
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

          <div style={{ height: 14 }} />

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

          {hiddenPeople.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button className="ghost" onClick={() => setShowHiddenNames((s) => !s)}>
                {showHiddenNames
                  ? "Ausgeblendete Namen ausblenden"
                  : "Ausgeblendete Namen einblenden"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Neue Namen hinzufügen */}
      <div className={styles.controls}>
        <input
          placeholder="Neuen Namen eingeben…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button onClick={addPerson}>➕ Hinzufügen</button>
      </div>

      <input
        placeholder="Suche Name…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className={styles.searchField}
      />

      {/* Tabelle */}
      <div className={`${styles.tableWrapper} ${viewMode === "week" ? styles.weekView : ""}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="sticky-col name-col-auto">Name</th>
              {sessions.map((d) => {
                const iso = fmtISO(d);
                const isActive = columnState[iso] ?? true;
                const noteExists = !!data.notes?.[iso];
                return (
                  <th
                    key={iso}
                    className={`${styles.dateHeader} ${styles.colNarrow} ${
                      !isActive ? styles.colInactive : ""
                    }`}
                  >
                    <div className={styles.dateHeaderInner}>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => toggleColumn(iso, e.target.checked)}
                        title="Tag aktiv/inaktiv"
                      />
                      <div className={styles.headerDayRow}>
                        <div className={styles.headerWeekday}>
                          {weekdayShort(d)}
                        </div>
                        <div className={styles.headerDate}>
                          {d.toLocaleDateString(undefined, {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </div>
                      </div>
                      <button
                        className={`${styles.noteIcon} ${noteExists ? styles.noteIconActive : ""}`}
                        onClick={() => setNoteForDay(iso)}
                        title={noteExists ? "Notiz bearbeiten" : "Notiz hinzufügen"}
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
            {visiblePeople.map((p, index) => {
              const fullName = `${p.firstName} ${p.lastName}`.trim();
              const nameLabel = displayName(p);
              const hasComment = !!p.comment && p.comment.trim() !== "";
              const isUnpaid = p.paid === false;

              return (
                <tr key={`${fullName}-${index}`}>
                  <td
                    className={`sticky-col name-col-auto ${styles.personCell} ${
                      hasComment ? styles.nameHasComment : ""
                    }`}
                    title={hasComment ? p.comment : undefined}
                  >
                    <div className={styles.nameInline}>
                      <span>
                        {isUnpaid && (
                          <span className={styles.euroIcon} title="nicht bezahlt">
                            €{" "}
                          </span>
                        )}
                        <strong>{nameLabel}</strong>
                      </span>

                      <button
                        className={`icon-btn edit-btn ${
                          activeMenuIndex === index ? "note-active" : ""
                        }`}
                        onClick={(e) => {
                          openMenuAtButton(e.currentTarget as HTMLElement);
                          setActiveMenuIndex((cur) => (cur === index ? null : index));
                        }}
                      >
                        <FiEdit2 />
                      </button>
                    </div>

                    {activeMenuIndex === index && (
                      <div className={styles.personMenu} ref={menuRef}>
                        <button onClick={() => editName(p)}>✏️ Name bearbeiten</button>
                        <button onClick={() => editComment(p)}>
                          {p.comment && p.comment.trim() !== ""
                            ? "✏️ Kommentar bearbeiten"
                            : "💬 Kommentar hinzufügen"}
                        </button>
                        {p.comment && p.comment.trim() !== "" && (
                          <div className={styles.commentPreview}>
                            💬 <em>{p.comment}</em>
                          </div>
                        )}
                        <button onClick={() => togglePaidStatus(p)}>
                          {p.paid ? "💰 Auf nicht bezahlt setzen" : "✅ Als bezahlt markieren"}
                        </button>
                        <button onClick={() => toggleHidden(p)}>
                          {p.active ? "👁️ Ausblenden" : "👁️ Einblenden"}
                        </button>
                        <button onClick={() => deletePerson(p)} style={{ color: "red" }}>
                          🗑️ Löschen
                        </button>
                      </div>
                    )}
                  </td>

                  {sessions.map((d) => {
                    const iso = fmtISO(d);
                    const isActive = columnState[iso] ?? true;
                    const checked = !!data.records?.[iso]?.[fullName];
                    return (
                      <td
                        key={`${fullName}-${iso}`}
                        className={`${styles.attendanceCell} ${
                          !isActive ? styles.colInactive : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isActive}
                          onChange={() => toggleAttendance(fullName, iso)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Liste ausgeblendeter Namen */}
      {showHiddenNames && hiddenPeople.length > 0 && (
        <div className={styles.hiddenNamesContainer}>
          <h4>Ausgeblendete Namen:</h4>
          <ul>
            {hiddenPeople.map((p) => {
              const fullName = `${p.firstName} ${p.lastName}`.trim();
              return (
                <li key={fullName}>
                  <span>{fullName}</span>
                  <button className="ghost" onClick={() => toggleHidden(p)}>
                    ➕ Einblenden
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
