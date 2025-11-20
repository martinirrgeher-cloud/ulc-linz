import React, { useMemo, useState } from "react";
import { PlanItem } from "../services/TrainingsplanungStore";

type Props = {
  planOrder: string[];
  planItems: Record<string, PlanItem>;
  onUpdate: (id: string, patch: Partial<PlanItem>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
};

export default function PlanEditor({
  planOrder,
  planItems,
  onUpdate,
  onRemove,
  onMove,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const entries = useMemo(
    () => planOrder.map((id) => ({ id, it: planItems[id] })).filter((e) => !!e.it),
    [planOrder, planItems]
  );

  if (!entries.length) {
    return <div className="tp-badge">Noch keine Übungen im Plan.</div>;
  }

  return (
    <div>
      {entries.map(({ id, it }) => {
        const editable = editingId === id;
        const safe: PlanItem = {
          ...it,
          default: it.default ?? { reps: null, menge: null, einheit: null },
          target: it.target ?? { reps: null, menge: null, einheit: null },
        };

        const t = safe.target;

        return (
          <div key={id} className="tp-plan-item">
            <div className="tp-plan-header">
              <div>
                <div className="tp-plan-title">{safe.nameCache || "Ohne Name"}</div>
                <div className="tp-plan-groups">
                  {safe.groupCache?.haupt ?? "—"}
                  {safe.groupCache?.unter ? ` / ${safe.groupCache.unter}` : ""}
                </div>
              </div>
              <div className="tp-list-actions">
                <button
                  className="tp-btn"
                  type="button"
                  title="nach oben"
                  onClick={() => onMove(id, -1)}
                >
                  ↑
                </button>
                <button
                  className="tp-btn"
                  type="button"
                  title="nach unten"
                  onClick={() => onMove(id, +1)}
                >
                  ↓
                </button>
                <button
                  className="tp-btn"
                  type="button"
                  onClick={() => setEditingId(editable ? null : id)}
                >
                  {editable ? "Fertig" : "Bearb."}
                </button>
                <button
                  className="tp-btn"
                  type="button"
                  onClick={() => onRemove(id)}
                >
                  Entf
                </button>
              </div>
            </div>

            <div className="tp-row" style={{ marginTop: 6 }}>
              <div>
                <div className="tp-section-title">Serien / Wiederholungen</div>
                <div className="tp-plan-grid">
                  <input
                    className="tp-input"
                    type="number"
                    placeholder="Serien"
                    value={t.sets ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        target: {
                          ...t,
                          sets: e.target.value === "" ? null : Number(e.target.value),
                        } as any,
                      })
                    }
                    disabled={!editable}
                  />
                  <input
                    className="tp-input"
                    type="number"
                    placeholder="Wdh."
                    value={t.reps ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        target: {
                          ...t,
                          reps: e.target.value === "" ? null : Number(e.target.value),
                        } as any,
                      })
                    }
                    disabled={!editable}
                  />
                  <input
                    className="tp-input"
                    type="number"
                    placeholder="Pause (s)"
                    value={safe.pauseSec ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        pauseSec: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    disabled={!editable}
                  />
                </div>
              </div>
            </div>

            <div className="tp-row" style={{ marginTop: 6 }}>
              <div>
                <div className="tp-section-title">Belastung / Umfang</div>
                <div className="tp-plan-grid">
                  <input
                    className="tp-input"
                    type="number"
                    placeholder="Menge"
                    value={t.menge ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        target: {
                          ...t,
                          menge: e.target.value === "" ? null : Number(e.target.value),
                        } as any,
                      })
                    }
                    disabled={!editable}
                  />
                  <input
                    className="tp-input"
                    type="text"
                    placeholder="Einheit (min, km, m…)"
                    value={t.einheit ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        target: {
                          ...t,
                          einheit: e.target.value || null,
                        } as any,
                      })
                    }
                    disabled={!editable}
                  />
                  <input
                    className="tp-input"
                    type="number"
                    placeholder="Distanz (m)"
                    value={t.distanceM ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        target: {
                          ...t,
                          distanceM: e.target.value === "" ? null : Number(e.target.value),
                        } as any,
                      })
                    }
                    disabled={!editable}
                  />
                </div>
              </div>
            </div>

            <div className="tp-row" style={{ marginTop: 6 }}>
              <div>
                <div className="tp-section-title">Gewicht / Kommentar</div>
                <div className="tp-plan-grid">
                  <input
                    className="tp-input"
                    type="number"
                    placeholder="Gewicht (kg)"
                    value={t.weightKg ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        target: {
                          ...t,
                          weightKg: e.target.value === "" ? null : Number(e.target.value),
                        } as any,
                      })
                    }
                    disabled={!editable}
                  />
                  <textarea
                    className="tp-textarea"
                    placeholder="Technik-Fokus, Hinweise…"
                    value={safe.comment ?? ""}
                    onChange={(e) =>
                      onUpdate(id, {
                        comment: e.target.value,
                      })
                    }
                    disabled={!editable}
                  />
                  <div className="tp-badge">
                    Default: {safe.default.reps ?? ""} Wdh, {safe.default.menge ?? ""}{" "}
                    {safe.default.einheit ?? ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
