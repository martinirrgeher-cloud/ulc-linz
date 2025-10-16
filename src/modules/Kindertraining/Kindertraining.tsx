import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiFileText, FiCornerUpLeft } from "react-icons/fi";
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

  useEffect(() => {
    if (activeMenuIndex === null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuIndex(null);
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [activeMenuIndex]);

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
  }, [allSessions, selectedWeek]);

  const sessions = useMemo(() => {
    if (viewMode === "week") {
      return allSessions.filter((d) => getISOWeek(d) === selectedWeek);
    }
    return allSessions;
  }, [allSessions, viewMode, selectedWeek]);

  const sessionsIso = useMemo(() => sessions.map((d) => fmtISO(d)).join(","), [sessions]);

  useEffect(() => {
    const init: Record<string, boolean> = {};
    sessions.forEach((d) => (init[fmtISO(d)] = columnState[fmtISO(d)] ?? true));
    setColumnState((prev) => ({ ...init, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsIso]);

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

  const displayName = (p: Person) =>
    sortMode === "lastName"
      ? `${p.lastName} ${p.firstName}`.trim()
      : `${p.firstName} ${p.lastName}`.trim();

  const weekdayShort = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short" });

  const openMenuAtElement = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const menuWidth = 260;
    const padding = 8;
    let left = rect.right + padding;
    const top = rect.top + window.scrollY;
    if (left + menuWidth > window.innerWidth) {
      left = rect.left - menuWidth - padding;
    }
    document.documentElement.style.setProperty("--person-menu-top", `${top}px`);
    document.documentElement.style.setProperty("--person-menu-left", `${left}px`);
  };

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

  return (
    <div className={styles.container}>
      {/* Kopfbereich */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <button className="ghost" onClick={() => navigate("/")} title="Zurück">
            <FiCornerUpLeft size={22} />
          </button>
        </div>
        <div className={styles.calendarNav}>
          <button onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}>◀</button>
          <div className={styles.calendarLabel}>
            {monthStart.toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </div>
          <button onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}>▶</button>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.iconButton} onClick={() => setShowOptions((p) => !p)} title="Einstellungen">⚙️</button>
        </div>
      </div>

      {/* Overlay Menü */}
      {showOptions && (
        <div className={styles.overlayMenu} onClick={(e) => { if (e.target === e.currentTarget) setShowOptions(false); }}>
          <div className={styles.optionsMenu}>
            <div className={styles.optionsHeader}>
              <h3>Einstellungen</h3>
              <button className={styles.closeButton} onClick={() => setShowOptions(false)} title="Schließen">❌</button>
            </div>
            <Link to="/kindertraining/wochentage" className="ghost">🗓️ Wochentage bearbeiten</Link>
          </div>
        </div>
      )}

      {/* Namen hinzufügen */}
      <div className={styles.controls}>
        <input placeholder="Neuen Namen eingeben…" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button onClick={addPerson}>➕ Hinzufügen</button>
      </div>

      {/* Suche */}
      <div className={styles.searchRow}>
        <input placeholder="Suche Name…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className={styles.searchField} />
        <Link to="/kindertraining/statistik" className={styles.statistikButton}>📊 Statistik</Link>
      </div>

      {/* Tabelle */}
      <div className={`${styles.tableWrapper} ${viewMode === "week" ? styles.weekView : ""}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Name</th>
              {sessions.map((d) => {
                const iso = fmtISO(d);
                const isActive = columnState[iso] ?? true;
                const noteExists = !!data.notes?.[iso];
                return (
                  <th key={iso} className={`${!isActive ? styles.colInactive : ""}`}>
                    <div className={styles.dateHeaderInner}>
                      <input type="checkbox" checked={isActive} onChange={(e) => toggleColumn(iso, e.target.checked)} />
                      <div>{weekdayShort(d)}</div>
                      <div>{d.toLocaleDateString(undefined,{day:"2-digit",month:"2-digit"})}</div>
                      <button className={`${styles.noteIcon} ${noteExists ? styles.noteIconActive : ""}`} onClick={() => setNoteForDay(iso)}>
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
                  <td className={`${styles.personCell} ${hasComment ? styles.nameHasComment : ""}`} onClick={(e) => { openMenuAtElement(e.currentTarget as HTMLElement); setActiveMenuIndex(index); }}>
                    {isUnpaid && <span className={styles.euroIcon}>💰</span>}
                    {nameLabel}
                    {activeMenuIndex === index && (
                      <div className={styles.personMenu} ref={menuRef}>
                        <div className={styles.menuHeaderRow}>
                          <button className={styles.menuActionLeft} onClick={() => editName(p)}>✏️ Name bearbeiten</button>
                          <button className={styles.menuCloseRight} onClick={() => setActiveMenuIndex(null)} title="Schließen">❌</button>
                        </div>
                        <button onClick={() => editComment(p)}>
                          {p.comment && p.comment.trim() !== "" ? "✏️ Kommentar bearbeiten" : "💬 Kommentar hinzufügen"}
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
                        <button onClick={() => deletePerson(p)} style={{ color: "red" }}>🗑️ Löschen</button>
                      </div>
                    )}
                  </td>
                  {sessions.map((d) => {
                    const iso = fmtISO(d);
                    const isActive = columnState[iso] ?? true;
                    const checked = !!data.records?.[iso]?.[fullName];
                    return (
                      <td key={`${fullName}-${iso}`} className={`${styles.attendanceCell} ${!isActive ? styles.colInactive : ""}`}>
                        <input type="checkbox" checked={checked} disabled={!isActive} onChange={() => toggleAttendance(fullName, iso)} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showHiddenNames && hiddenPeople.length > 0 && (
        <div className={styles.hiddenNamesContainer}>
          <h4>Ausgeblendete Namen:</h4>
          <ul>
            {hiddenPeople.map((p) => {
              const fullName = `${p.firstName} ${p.lastName}`.trim();
              return (
                <li key={fullName}>
                  <span>{fullName}</span>
                  <button className="ghost" onClick={() => toggleHidden(p)}>➕ Einblenden</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
