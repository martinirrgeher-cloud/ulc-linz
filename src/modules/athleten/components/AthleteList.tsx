// src/modules/athleten/components/AthleteList.tsx
import { useState, useMemo } from "react";
import type { Athlete } from "../types/athleten";
import AthleteForm from "./AthleteForm";
import Modal from "./Modal";

export default function AthleteList({
  items, onAdd, onUpdate, createEmptyAthlete, sortMode = "VORNAME"
}: {
  items: Athlete[] | undefined;
  onAdd: (a: Athlete) => void;
  onUpdate: (a: Athlete) => void;
  createEmptyAthlete: () => Athlete;
  sortMode?: "VORNAME" | "NACHNAME" | "JAHR_AUF" | "JAHR_AB";
}) {
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [creating, setCreating] = useState<Athlete | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = items || [];
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter((a) => {
      const fn = (a.firstName || "").toLowerCase();
      const ln = (a.lastName || "").toLowerCase();
      const name = (a.name || "").toLowerCase();
      const ak = (a.altersklasse || "").toLowerCase();
      const info = (a.info || "").toLowerCase();
      return fn.includes(s) || ln.includes(s) || name.includes(s) || ak.includes(s) || info.includes(s);
    });
  }, [items, q]);

  // Reihenfolge kommt vom Hook (keine weitere Sortierung hier)
  const list = filtered;

  return (
    <div>
      <div className="kt-list-header">
        <input
          className="kt-input"
          placeholder="Suchen…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="kt-btn primary" onClick={() => setCreating(createEmptyAthlete())}>
          + Neuer Athlet
        </button>
      </div>

      <div>
        {list.map((a) => (
          <div className="kt-row" key={a.id} onClick={() => setEditing(a)}>
            <div className="kt-left">
              <div className="kt-name">{a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim()}</div>
              {a.info ? <div className="kt-sub">{a.info}</div> : null}
            </div>
            <div className="kt-right">
              <div className="kt-meta">
                {a.altersklasse || ""}{a.geburtsjahr ? ` • ${a.geburtsjahr}` : ""}
              </div>
              {a.active === false ? <div className="kt-chip danger">inaktiv</div> : null}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Athlet bearbeiten">
        {editing && (
          <AthleteForm
            value={editing}
            onChange={(patch) => onUpdate(patch)}
            onSave={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={!!creating} onClose={() => setCreating(null)} title="Neuer Athlet">
        {creating && (
          <AthleteForm
            value={creating}
            onChange={(a) => onAdd(a)}
            onSave={() => setCreating(null)}
            onCancel={() => setCreating(null)}
          />
        )}
      </Modal>
    </div>
  );
}
