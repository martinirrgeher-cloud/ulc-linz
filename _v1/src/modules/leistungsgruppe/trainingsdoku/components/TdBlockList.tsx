// src/modules/leistungsgruppe/trainingsdoku/components/TdBlockList.tsx
import React from "react";
import type { TrainingDocBlockView } from "../hooks/useTrainingsdokuForAthlete";
import { formatTarget, getPerSetExtraUnit, formatPerSetSummary } from "../utils/format";

type TdBlockListProps = {
  blockViews: TrainingDocBlockView[];
  collapsedBlocks: Record<string, boolean>;
  expandedKey: string | null;
  onToggleBlockCollapsed: (blockId: string) => void;
  onToggleExpanded: (blockId: string, itemId: string) => void;
  onQuickOk: (blockId: string, itemId: string) => void;
  onActualTargetChange: (
    blockId: string,
    itemId: string,
    field: "sets" | "reps",
    rawValue: string
  ) => void;
  onPerSetActualChange: (
    blockId: string,
    itemId: string,
    setIndex: number,
    rawValue: string
  ) => void;
  onNoteChange: (blockId: string, itemId: string, note: string) => void;
  onSplitSeriesInDoc: (blockId: string, itemId: string) => void;
};

const TdBlockList: React.FC<TdBlockListProps> = ({
  blockViews,
  collapsedBlocks,
  expandedKey,
  onToggleBlockCollapsed,
  onToggleExpanded,
  onQuickOk,
  onActualTargetChange,
  onPerSetActualChange,
  onNoteChange,
  onSplitSeriesInDoc,
}) => {
  return (
    <main className="td-block-list">
      {blockViews.map(({ block, items }) => {
        const total = items.length;
        const done = items.filter(
          (item) =>
            item.status === "completedAsPlanned" ||
            item.status === "completedModified" ||
            item.status === "partial" ||
            item.status === "completedWithIssues"
        ).length;

        const isCollapsed = !!collapsedBlocks[block.id];

        return (
          <section key={block.id} className="td-block">
            <div className="td-block-header">
              <div className="td-block-title">
                {block.title || "Block"}
              </div>
              <div className="td-block-meta">
                {done}/{total} erledigt
              </div>
              <button
                type="button"
                className="td-block-toggle"
                onClick={() => onToggleBlockCollapsed(block.id)}
                aria-label={isCollapsed ? "Block ausklappen" : "Block einklappen"}
              >
                {isCollapsed ? "▼" : "▲"}
              </button>
            </div>

            {!isCollapsed && (
              <div className="td-items">
                {items.map((item) => {
                  const key = `${block.id}:${item.id}`;
                  const isExpanded = expandedKey === key;
                  const planned = item.plannedTarget as any;
                  const hasNote = !!item.note;

                  return (
                    <div key={item.id} className="td-item-row">
                      <button
                        type="button"
                        className={
                          "td-ok-button td-ok-button--" +
                          (item.status || "planned")
                        }
                        onClick={() => onQuickOk(block.id, item.id)}
                      >
                        {item.status === "skipped"
                          ? "X"
                          : item.status === "completedModified"
                          ? "~"
                          : "OK"}
                      </button>

                      <div
                        className="td-item-main"
                        onClick={() => onToggleExpanded(block.id, item.id)}
                      >
                        <div className="td-item-title">
                          {item.nameCache || item.exerciseId}
                        </div>
                        <div className="td-item-sub">
                          {planned && (
                            <span className="td-item-plan-main">
                              {formatTarget(planned)}
                            </span>
                          )}
                          {item.plannedPerSetTargets &&
                            item.plannedPerSetTargets.length > 0 &&
                            planned && (
                              <span className="td-item-plan-perset">
                                {formatPerSetSummary(
                                  planned,
                                  item.plannedPerSetTargets as any[]
                                )}
                              </span>
                            )}
                        </div>
                        {hasNote && (
                          <div className="td-item-note-indicator">
                            Notiz vorhanden
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="td-item-details">
                          {planned && (
                            <div className="td-item-details-row">
                              <label>Ist Serien / Wdh</label>
                              <div className="td-item-actual-basic">
                                <input
                                  className="td-input-perset"
                                  value={
                                    item.actualTarget && (item.actualTarget as any).sets != null
                                      ? String((item.actualTarget as any).sets)
                                      : ""
                                  }
                                  onChange={(e) =>
                                    onActualTargetChange(
                                      block.id,
                                      item.id,
                                      "sets",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Serien"
                                />
                                <span className="td-item-actual-mult">×</span>
                                <input
                                  className="td-input-perset"
                                  value={
                                    item.actualTarget && (item.actualTarget as any).reps != null
                                      ? String((item.actualTarget as any).reps)
                                      : ""
                                  }
                                  onChange={(e) =>
                                    onActualTargetChange(
                                      block.id,
                                      item.id,
                                      "reps",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Wdh"
                                />
                              </div>
                            </div>
                          )}

                          {planned &&
                            (!item.plannedPerSetTargets || item.plannedPerSetTargets.length === 0) &&
                            planned.sets != null &&
                            planned.sets > 1 && (
                              <div className="td-item-details-row">
                                <button
                                  type="button"
                                  className="td-btn-secondary"
                                  onClick={() => onSplitSeriesInDoc(block.id, item.id)}
                                >
                                  Serien aufsplitten
                                </button>
                              </div>
                            )}

                          {planned &&
                            item.plannedPerSetTargets &&
                            item.plannedPerSetTargets.length > 0 && (
                              <div className="td-item-details-row">
                                <label>Serien-Dokumentation</label>
                                <div className="td-item-perset-list">
                                  {item.plannedPerSetTargets.map((st, idx) => {
                                    const unit = getPerSetExtraUnit(
                                      planned,
                                      item.plannedPerSetTargets as any[]
                                    );
                                    const plannedVal =
                                      unit === "kg"
                                        ? (st as any)?.weightKg
                                        : (st as any)?.durationSec;
                                    const plannedStr =
                                      plannedVal == null ||
                                      Number.isNaN(plannedVal as number)
                                        ? ""
                                        : String(plannedVal).replace(".", ",");
                                    const actualArr = item.actualPerSetTargets as any[] | undefined;
                                    const actualEntry = actualArr && actualArr[idx];
                                    const actualVal =
                                      unit === "kg"
                                        ? actualEntry?.weightKg
                                        : actualEntry?.durationSec;
                                    const actualStr =
                                      actualVal == null ||
                                      Number.isNaN(actualVal as number)
                                        ? ""
                                        : String(actualVal).replace(".", ",");

                                    return (
                                      <div key={idx} className="td-item-perset-row">
                                        <div className="td-item-perset-label">
                                          Satz {idx + 1}
                                        </div>
                                        <div className="td-item-perset-plan">
                                          {planned.reps != null
                                            ? `1×${planned.reps} Wdh`
                                            : ""}
                                          {planned.menge != null && planned.einheit
                                            ? (planned.reps != null ? " · " : "") +
                                              `${planned.menge} ${planned.einheit}`
                                            : ""}
                                          {plannedStr
                                            ? (planned.reps != null ||
                                                (planned.menge != null && planned.einheit)
                                                ? " · "
                                                : "") +
                                              `${plannedStr} ${
                                                unit === "kg" ? "kg" : "s"
                                              }`
                                            : ""}
                                        </div>
                                        <div className="td-item-perset-actual">
                                          <input
                                            className="td-input-perset"
                                            value={actualStr}
                                            onChange={(e) =>
                                              onPerSetActualChange(
                                                block.id,
                                                item.id,
                                                idx,
                                                e.target.value
                                              )
                                            }
                                            placeholder={
                                              unit === "kg" ? "Ist-Gewicht" : "Ist-Zeit"
                                            }
                                          />
                                          <span className="td-item-perset-unit">
                                            {unit === "kg"
                                              ? "kg"
                                              : unit === "sek"
                                              ? "s"
                                              : ""}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          <div className="td-item-details-row">
                            <label>Notiz / Problem</label>
                            <textarea
                              rows={3}
                              value={item.note || ""}
                              onChange={(e) =>
                                onNoteChange(
                                  block.id,
                                  item.id,
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
};

export default TdBlockList;
