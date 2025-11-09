import React, { useState, useRef, useEffect } from "react";

type DayToggle = { key: "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"; name: string; visible: boolean };

export default function KTHeader(props: {
  year: number;
  weekNumber: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  dayToggles: DayToggle[];
  onToggleDay: (key: DayToggle["key"] | string, next: boolean) => void;
  sortOrder: "vorname" | "nachname";
  onChangeSort: (order: "vorname" | "nachname") => void;
  showInactive: boolean;
  onToggleShowInactive: (val: boolean) => void;
  /** Optional: Suchfeld steuern */
  search?: string;
  onSearch?: (val: string) => void;
}) {
  const {
    year, weekNumber, onPrevWeek, onNextWeek,
    dayToggles, onToggleDay,
    sortOrder, onChangeSort,
    showInactive, onToggleShowInactive,
    search = "", onSearch,
  } = props;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="kt-header" ref={ref}>
      <div className="kt-nav">
        <button onClick={onPrevWeek} aria-label="Vorherige Woche">‹</button>
        <div className="kt-week">KW {weekNumber} / {year}</div>
        <button onClick={onNextWeek} aria-label="Nächste Woche">›</button>
      </div>
      <div className="kt-controls">
        <label>
          Sortierung:
          <select value={sortOrder} onChange={e => onChangeSort(e.target.value as any)}>
            <option value="vorname">Vorname</option>
            <option value="nachname">Nachname</option>
          </select>
        </label>
        <label style={{marginLeft:8}}>
          Inaktive zeigen:
          <input type="checkbox" checked={showInactive} onChange={e => onToggleShowInactive(e.target.checked)} />
        </label>
        <div className="kt-days">
          {dayToggles.map(d => (
            <label key={d.key}>
              <input type="checkbox" checked={d.visible} onChange={e => onToggleDay(d.key, e.target.checked)} /> {d.name}
            </label>
          ))}
        </div>
        {onSearch && (
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Suchen…"
            aria-label="Suche"
            className="kt-search"
          />
        )}
      </div>
    </div>
  );
}
