// src/modules/leistungsgruppe/trainingsplanung/components/BlockList.tsx
import React from "react";
import type {
  PlanBlock,
  PlanDay,
  PlanItem,
} from "../services/TrainingsplanungStore";

type BlockListProps = {
  blocks: PlanBlock[];
  currentDay: PlanDay | null;
  collapsedBlocks: Record<string, boolean>;

  onToggleCollapsed: (blockId: string) => void;

  onUpdateBlockTitle: (blockId: string, title: string) => void;
  onUpdateBlockDuration: (blockId: string, durationMin: string) => void;
  onUpdateBlockNotes: (blockId: string, notes: string) => void;

  onRemoveBlock: (blockId: string) => void;

  onMoveItem: (blockId: string, itemId: string, direction: -1 | 1) => void;
  onRemoveItem: (blockId: string, itemId: string) => void;
  onUpdateItemComment: (itemId: string, comment: string) => void;
  onUpdateItemTarget: (
    itemId: string,
    patch: Partial<PlanItem["target"]>
  ) => void;

  onOpenPickerForBlock: (blockId: string) => void;
};

const BlockList: React.FC<BlockListProps> = ({
  blocks,
  currentDay,
  collapsedBlocks,
  onToggleCollapsed,
  onUpdateBlockTitle,
  onUpdateBlockDuration,
  onUpdateBlockNotes,
  onRemoveBlock,
  onMoveItem,
  onRemoveItem,
  onUpdateItemComment,
  onUpdateItemTarget,
  onOpenPickerForBlock,
}) => {
  if (!currentDay) {
    return (
      <div className="tp-empty">
        Für diesen Tag gibt es noch keinen Plan – bitte zuerst Blöcke
        anlegen.
      </div>
    );
  }

  return (
    <div className="tp-blocks">
      {blocks.map((blk) => {
        const isCollapsed = !!collapsedBlocks[blk.id];
        return (
          <div key={blk.id} className="tp-block-card">
            <div className="tp-block-header">
              <input
                className="tp-input tp-block-title"
                value={blk.title}
                onChange={(e) =>
                  onUpdateBlockTitle(blk.id, e.target.value)
                }
                placeholder="Blocktitel (z.B. Aufwärmen, Sprint …)"
              />
              <div className="tp-block-header-right">
                <div className="tp-field-row">
                  <div className="tp-field">
                    <label className="tp-label">Dauer (min)</label>
                    <input
                      className="tp-input tp-input-xs"
                      value={
                        blk.targetDurationMin != null &&
                        !Number.isNaN(blk.targetDurationMin)
                          ? String(blk.targetDurationMin)
                          : ""
                      }
                      onChange={(e) =>
                        onUpdateBlockDuration(blk.id, e.target.value)
                      }
                      placeholder="z.B. 15"
                    />
                  </div>
                </div>
                <div className="tp-block-header-actions">
                  <button
                    type="button"
                    className="tp-btn tp-btn-mini"
                    onClick={() => onOpenPickerForBlock(blk.id)}
                  >
                    + Übung
                  </button>
                  <button
                    type="button"
                    className="tp-btn tp-btn-mini"
                    onClick={() => onToggleCollapsed(blk.id)}
                  >
                    {isCollapsed ? "▼" : "▲"}
                  </button>
                  <button
                    type="button"
                    className="tp-btn tp-btn-mini tp-btn-danger"
                    onClick={() => onRemoveBlock(blk.id)}
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            </div>

            {!isCollapsed && (
              <>
                <div className="tp-block-notes">
                  <textarea
                    className="tp-input"
                    value={blk.notes ?? ""}
                    onChange={(e) =>
                      onUpdateBlockNotes(blk.id, e.target.value)
                    }
                    placeholder="Notizen, Pausen, Hinweise …"
                  />
                </div>

                <div className="tp-block-items">
                  {blk.itemOrder.length === 0 && (
                    <div className="tp-empty">
                      Noch keine Übungen in diesem Block – bitte über „+
                      Übung“ hinzufügen.
                    </div>
                  )}
                  {blk.itemOrder.map((iid) => {
                    const it = currentDay.items?.[iid];
                    if (!it) return null;
                    const t = it.target ?? {};

                    return (
                      <div key={iid} className="tp-item-row">
                        <div className="tp-item-main">
                          <div className="tp-item-name">
  {it.nameCache ?? it.exerciseId}
</div>
                          <div className="tp-item-meta">
                            {it.groupCache?.haupt}
                            {it.groupCache?.unter
                              ? ` / ${it.groupCache.unter}`
                              : ""}
                          </div>
                          <div className="tp-item-comment">
                            <input
                              className="tp-input"
                              value={it.comment ?? ""}
                              onChange={(e) =>
                                onUpdateItemComment(iid, e.target.value)
                              }
                              placeholder="Kommentar / Hinweis"
                            />
                          </div>
                        </div>
                        <div className="tp-item-target">
                          <input
                            className="tp-input tp-input-xs"
                            value={
                              t.sets != null && !Number.isNaN(t.sets)
                                ? String(t.sets)
                                : ""
                            }
                            onChange={(e) =>
                              onUpdateItemTarget(iid, {
                                sets:
                                  e.target.value.trim() === ""
                                    ? null
                                    : Number(
                                        e.target.value.replace(",", ".")
                                      ),
                              })
                            }
                            placeholder="Sätze"
                          />
                          <input
                            className="tp-input tp-input-xs"
                            value={
                              t.reps != null && !Number.isNaN(t.reps)
                                ? String(t.reps)
                                : ""
                            }
                            onChange={(e) =>
                              onUpdateItemTarget(iid, {
                                reps:
                                  e.target.value.trim() === ""
                                    ? null
                                    : Number(
                                        e.target.value.replace(",", ".")
                                      ),
                              })
                            }
                            placeholder="Wdh."
                          />
                          <input
                            className="tp-input tp-input-xs"
                            value={
                              t.menge != null && !Number.isNaN(t.menge)
                                ? String(t.menge)
                                : ""
                            }
                            onChange={(e) =>
                              onUpdateItemTarget(iid, {
                                menge:
                                  e.target.value.trim() === ""
                                    ? null
                                    : Number(
                                        e.target.value.replace(",", ".")
                                      ),
                              })
                            }
                            placeholder="Menge"
                          />
                          <input
                            className="tp-input tp-input-xs"
                            value={t.einheit ?? ""}
                            onChange={(e) =>
                              onUpdateItemTarget(iid, {
                                einheit:
                                  e.target.value.trim() === ""
                                    ? null
                                    : e.target.value.trim(),
                              })
                            }
                            placeholder="Einheit"
                          />
                          <div className="tp-item-actions">
                            <button
                              type="button"
                              className="tp-btn tp-btn-mini"
                              onClick={() => onMoveItem(blk.id, iid, -1)}
                              title="nach oben"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="tp-btn tp-btn-mini"
                              onClick={() => onMoveItem(blk.id, iid, +1)}
                              title="nach unten"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="tp-btn tp-btn-mini tp-btn-danger"
                              onClick={() => onRemoveItem(blk.id, iid)}
                              title="Entfernen"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BlockList;
