import React from "react";
import { PlanItem, PlanTarget } from "../services/TrainingsplanungStore";

type Props = {
  planOrder: string[];
  planItems: Record<string, PlanItem>;
  onChangeItem: (id: string, next: PlanItem) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
};

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function PlanEditor({
  planOrder,
  planItems,
  onChangeItem,
  onRemove,
  onMove,
}: Props) {
  if (!planOrder.length) {
    return <div className="tp-empty">Noch keine Übungen im Block.</div>;
  }

  return (
    <div className="tp-plan-editor">
      {planOrder.map((id) => {
        const item = planItems[id];
        if (!item) return null;

        const target: PlanTarget = item.target ?? item.default;
        const def: PlanTarget = item.default;

        const handleChangeTarget = (field: keyof PlanTarget, value: string) => {
          const nextTarget: PlanTarget = { ...target };

          if (field === "einheit") {
            nextTarget.einheit = value;
          } else {
            (nextTarget as any)[field] = numberOrNull(value);
          }

          const nextItem: PlanItem = {
            ...item,
            target: nextTarget,
          };
          onChangeItem(id, nextItem);
        };

        const handleChangeComment = (value: string) => {
          const nextItem: PlanItem = {
            ...item,
            comment: value,
          };
          onChangeItem(id, nextItem);
        };

        const handleChangePause = (value: string) => {
          const pauseSec = numberOrNull(value);
          const nextItem: PlanItem = {
            ...item,
            pauseSec,
          };
          onChangeItem(id, nextItem);
        };

        return (
          <div key={id} className="tp-plan-item">
            <div className="tp-plan-item-header">
              <div>
                <div className="tp-plan-item-title">
                  {item.nameCache || item.exerciseId || "Übung"}
                </div>
                {(item.groupCache?.haupt || item.groupCache?.unter) && (
                  <div className="tp-plan-item-subtitle">
                    {[item.groupCache?.haupt, item.groupCache?.unter]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                )}
              </div>

              <div className="tp-plan-item-actions">
                <button
                  type="button"
                  className="tp-icon-btn"
                  onClick={() => onMove(id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="tp-icon-btn"
                  onClick={() => onMove(id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="tp-icon-btn danger"
                  onClick={() => onRemove(id)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="tp-plan-item-body">
              <div className="tp-row">
                <div className="tp-field">
                  <label>Wdh</label>
                  <input
                    className="tp-input small"
                    value={target.reps ?? ""}
                    onChange={(e) => handleChangeTarget("reps", e.target.value)}
                  />
                </div>
                <div className="tp-field">
                  <label>Menge</label>
                  <input
                    className="tp-input small"
                    value={target.menge ?? ""}
                    onChange={(e) => handleChangeTarget("menge", e.target.value)}
                  />
                </div>
                <div className="tp-field">
                  <label>Einheit</label>
                  <input
                    className="tp-input small"
                    value={target.einheit ?? ""}
                    onChange={(e) => handleChangeTarget("einheit", e.target.value)}
                  />
                </div>
              </div>

              <div className="tp-row">
                <div className="tp-field">
                  <label>Sätze</label>
                  <input
                    className="tp-input small"
                    value={target.sets ?? ""}
                    onChange={(e) => handleChangeTarget("sets", e.target.value)}
                  />
                </div>
                <div className="tp-field">
                  <label>Distanz (m)</label>
                  <input
                    className="tp-input small"
                    value={target.distanceM ?? ""}
                    onChange={(e) => handleChangeTarget("distanceM", e.target.value)}
                  />
                </div>
                <div className="tp-field">
                  <label>Gewicht (kg)</label>
                  <input
                    className="tp-input small"
                    value={target.weightKg ?? ""}
                    onChange={(e) => handleChangeTarget("weightKg", e.target.value)}
                  />
                </div>
                <div className="tp-field">
                  <label>Dauer (s)</label>
                  <input
                    className="tp-input small"
                    value={target.durationSec ?? ""}
                    onChange={(e) => handleChangeTarget("durationSec", e.target.value)}
                  />
                </div>
              </div>

              <div className="tp-row">
                <div className="tp-field">
                  <label>Pause (s)</label>
                  <input
                    className="tp-input small"
                    value={item.pauseSec ?? ""}
                    onChange={(e) => handleChangePause(e.target.value)}
                  />
                </div>
              </div>

              <div className="tp-row">
                <div className="tp-field" style={{ flex: 1 }}>
                  <label>Kommentar</label>
                  <textarea
                    className="tp-textarea"
                    rows={2}
                    value={item.comment ?? ""}
                    onChange={(e) => handleChangeComment(e.target.value)}
                  />
                </div>
              </div>

              <div className="tp-badge-row">
                <div className="tp-badge">
                  Default: {def.reps ?? ""} Wdh, {def.menge ?? ""} {def.einheit ?? ""}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
