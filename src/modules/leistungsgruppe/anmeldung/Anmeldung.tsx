// src/modules/leistungsgruppe/anmeldung/Anmeldung.tsx
import { useEffect, useMemo, useState } from "react";
import { useAnmeldung } from "./hooks/useAnmeldung";
import { getDaysOfWeek, startOfISOWeek, getISOWeek, getISOWeekYear } from "./utils/weekUtils";
import "./styles/Anmeldung.css";

type Status = "YES" | "NO" | "MAYBE" | null;
type AthleteLite = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  active?: boolean;
};

function formatName(a: AthleteLite): string {
  const ln = (a.lastName || "").trim();
  const fn = (a.firstName || "").trim();
  if (ln || fn) return `${ln}${ln && fn ? " " : ""}${fn}`.trim();
  return (a.name || "").trim();
}
function statusLabel(s: Status): string {
  if (s === "YES") return "Ja";
  if (s === "NO") return "Nein";
  return "?";
}
function nextStatus(s: Status): Status {
  if (s === "YES") return "NO";
  if (s === "NO") return "MAYBE";
  return "YES";
}

export default function AnmeldungPage() {
  const { athletes, statuses, notes, setStatus, setNote, weekStart, setWeekStart, error, loading } = useAnmeldung();

  const safeWeekStart = weekStart ?? new Date();
  const days = useMemo(() => getDaysOfWeek(safeWeekStart), [safeWeekStart]);

  const athletesSafe: AthleteLite[] = Array.isArray(athletes) ? athletes : [];
  const statusesSafe: Record<string, Status> = statuses && typeof statuses === "object" ? statuses : {};
  const notesSafe: Record<string, string> = notes && typeof notes === "object" ? notes : {};

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && athletesSafe.length > 0) {
      const firstActive = athletesSafe.find(a => a.active !== false) || athletesSafe[0];
      setSelectedId(firstActive.id);
    }
  }, [athletesSafe, selectedId]);

  const [noteForDay, setNoteForDay] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");

  const weekLabel = useMemo(() => {
    const w = getISOWeek(safeWeekStart);
    const y = getISOWeekYear(safeWeekStart);
    return `KW ${w}, ${y}`;
  }, [safeWeekStart]);

  const gotoWeek = (offset: number) => {
    const base = startOfISOWeek(safeWeekStart);
    const next = new Date(base);
    next.setDate(base.getDate() + offset * 7);
    setWeekStart(next);
  };

  if (loading) return <div className="anm-info">Lade…</div>;
  if (error) return <div className="anm-error">Fehler: {String(error)}</div>;

  const selected = athletesSafe.find(a => a.id === selectedId) || null;

  return (
    <div className="anm-container anm-lg">
      <div className="anm-toolbar">
        <div className="anm-nav">
          <button className="anm-btn" onClick={() => gotoWeek(-1)}>◀</button>
          <div className="anm-week">{weekLabel}</div>
          <button className="anm-btn" onClick={() => gotoWeek(+1)}>▶</button>
        </div>
        <div className="anm-picker">
          <label>
            <span>Athlet</span>
            <select
              className="anm-select"
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
            >
              {athletesSafe
                .slice()
                .sort((a,b) => {
                  const ln = (a.lastName||"").localeCompare(b.lastName||"", "de", {sensitivity:"base"});
                  if (ln !== 0) return ln;
                  return (a.firstName||"").localeCompare(b.firstName||"", "de", {sensitivity:"base"});
                })
                .map(a => (
                  <option key={a.id} value={a.id}>{formatName(a)}</option>
                ))}
            </select>
          </label>
        </div>
      </div>

      {!selected && <div className="anm-info">Kein Athlet ausgewählt.</div>}

      {selected && (
        <div className="anm-list-rows">
          {days.map(d => {
            const key = `${selected.id}:${d.isoDate}`;
            const s: Status = statusesSafe[key] ?? "MAYBE"; // Default „?“
            const hasNote = Boolean(notesSafe[key]);
            return (
              <div className="anm-row" key={d.isoDate}>
                <div className="anm-row-left">
                  <div className="day-weekday">{d.weekdayShort}</div>
                  <div className="day-label">{d.label}</div>
                </div>
                <div className="anm-row-right">
                  <button
                    className={`status-cycle ${s === "YES" ? "yes" : s === "NO" ? "no" : "maybe"}`}
                    onClick={() => setStatus(selected.id!, d.isoDate, nextStatus(statusesSafe[key] ?? "MAYBE"))}
                    title="Status wechseln"
                  >
                    {statusLabel(s)}
                  </button>
                  <button
                    className={`note-icon ${hasNote ? "filled" : ""}`}
                    aria-label="Notiz bearbeiten"
                    title={hasNote ? "Notiz vorhanden – klicken zum Bearbeiten" : "Notiz hinzufügen"}
                    onClick={() => { setNoteForDay(d.isoDate); setNoteDraft(notesSafe[key] || ""); }}
                  >
                    📝
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notiz-Overlay */}
      {selected && noteForDay && (
        <div className="note-overlay" role="dialog" aria-modal="true">
          <div className="note-card">
            <div className="note-title">
              Notiz – {formatName(selected)} – {noteForDay}
            </div>
            <textarea
              className="note-text lg"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Notiz eingeben…"
            />
            <div className="note-actions">
              <button className="anm-btn" onClick={() => setNoteForDay(null)}>Abbrechen</button>
              <button
                className="anm-btn primary"
                onClick={() => { setNote(selected.id!, noteForDay, noteDraft.trim()); setNoteForDay(null); }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
