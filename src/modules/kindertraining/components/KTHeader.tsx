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
}) {
  const {
    year, weekNumber, onPrevWeek, onNextWeek,
    dayToggles, onToggleDay,
    sortOrder, onChangeSort,
    showInactive, onToggleShowInactive,
  } = props;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const label = dayToggles.filter(d => d.visible).map(d => d.name).join(", ") || "Tage wählen";

  return (
    <header className="kt-header">
      <div className="kt-header__left">
        <button className="kt-btn" onClick={onPrevWeek} aria-label="Vorherige Woche">◀</button>
        <div className="kt-header__title">{year} – KW {String(weekNumber).padStart(2, "0")}</div>
        <button className="kt-btn" onClick={onNextWeek} aria-label="Nächste Woche">▶</button>
      </div>

      <div className="kt-header__right" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="kt-dropdown" ref={ref}>
          <button className="kt-input" onClick={() => setOpen(v => !v)} style={{ minWidth: 160, textAlign: "left" }}>
            {label}
          </button>
          {open && (
            <div className="kt-menu">
              {dayToggles.map(d => (
                <label key={d.key} className="kt-menu-item">
                  <input
                    type="checkbox"
                    checked={!!d.visible}
                    onChange={(e) => onToggleDay(d.key, e.target.checked)}
                  />
                  {d.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          Sortierung
          <select
            className="kt-input"
            value={sortOrder}
            onChange={(e) => onChangeSort(e.target.value as "vorname" | "nachname")}
          >
            <option value="vorname">Vorname</option>
            <option value="nachname">Nachname</option>
          </select>
        </label>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!showInactive}
            onChange={(e) => onToggleShowInactive(!e.target.checked)}
          />
          Nur aktive
        </label>
      </div>

      <style>
        {`
          .kt-header { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:8px 0; }
          .kt-header__left { display:flex; align-items:center; gap:8px; }
          .kt-header__title { font-weight:600; font-size:16px; }
          .kt-dropdown { position: relative; }
          .kt-menu { position:absolute; z-index:40; right:0; margin-top:4px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.08); min-width: 160px; padding:6px; }
          .kt-menu-item { display:flex; align-items:center; gap:8px; padding:6px 8px; font-size:13px; }
          .kt-menu-item:hover { background:#f8fafc; }
        `}
      </style>
    </header>
  );
}
