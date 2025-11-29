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
  const [visibleBlockNotes, setVisibleBlockNotes] =
    React.useState<Record<string, boolean>>({});
  const [openItemComments, setOpenItemComments] =
    React.useState<Record<string, boolean>>({});

  const handleTextareaAutoResize = (
    e: React.FormEvent<HTMLTextAreaElement>
  ) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

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
        const hasBlockNotes = (blk.notes ?? "").trim() !== "";
        const blockNotesVisible =
          visibleBlockNotes[blk.id] === undefined
            ? hasBlockNotes
            : visibleBlockNotes[blk.id];

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
                <div className="tp-block-duration">
                  <input
                    className="tp-input tp-input-xs tp-block-duration-input"
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
                  <span className="tp-block-duration-unit">min</span>
                  <button
                    type="button"
                    className={
                      "tp-icon-button tp-note-btn" +
                      (hasBlockNotes ? " tp-note-btn--active" : "")
                    }
                    title={
                      blockNotesVisible
                        ? "Block-Notizen ausblenden"
                        : hasBlockNotes
                        ? "Block-Notizen anzeigen"
                        : "Block-Notizen hinzufügen"
                    }
                    onClick={() =>
                      setVisibleBlockNotes((prev) => ({
                        ...prev,
                        [blk.id]: !blockNotesVisible,
                      }))
                    }
                  >
                    {hasBlockNotes ? "🗒️" : "📝"}
                  </button>
                </div>
                <div className="tp-block-header-actions">
                  <button
                    type="button"
                    className="tp-btn tp-btn-lg"
                    onClick={() => onOpenPickerForBlock(blk.id)}
                  >
                    + Übung
                  </button>
                  <button
                    type="button"
                    className="tp-btn tp-btn-lg"
                    onClick={() => onToggleCollapsed(blk.id)}
                  >
                    {isCollapsed ? "▼" : "▲"}
                  </button>
                  <button
                    type="button"
                    className="tp-btn tp-btn-lg tp-btn-danger"
                    onClick={() => onRemoveBlock(blk.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {!isCollapsed && (
              <>
                {blockNotesVisible && (
                  <div className="tp-block-notes">
                    <textarea
                      className="tp-input tp-block-notes-textarea"
                      value={blk.notes ?? ""}
                      onChange={(e) =>
                        onUpdateBlockNotes(blk.id, e.target.value)
                      }
                      onInput={handleTextareaAutoResize}
                      placeholder="Notizen, Pausen, Hinweise …"
                      rows={1}
                    />
                  </div>
                )}

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
                    const hasComment = (it.comment ?? "").trim() !== "";
                    const commentState = openItemComments[iid];
                    const commentVisible =
                      commentState === undefined ? hasComment : commentState;

                    return (
                      <div key={iid} className="tp-item-row">
                        <div className="tp-item-main">
                          <div className="tp-item-header">
                            <div className="tp-item-name-meta">
                              <div className="tp-item-name-row">
                                <div className="tp-item-name">
                                  {it.nameCache ?? it.exerciseId}
                                </div>
                              </div>
                              <div className="tp-item-meta">
                                {it.groupCache?.haupt}
                                {it.groupCache?.unter
                                  ? ` / ${it.groupCache.unter}`
                                  : ""}
                              </div>
                            </div>
                            <div className="tp-item-actions">
                              <button
                                type="button"
                                className="tp-btn tp-btn-mini tp-btn-rect"
                                onClick={() => onMoveItem(blk.id, iid, -1)}
                                title="nach oben"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="tp-btn tp-btn-mini tp-btn-rect"
                                onClick={() => onMoveItem(blk.id, iid, +1)}
                                title="nach unten"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="tp-btn tp-btn-mini tp-btn-rect tp-btn-danger"
                                onClick={() => onRemoveItem(blk.id, iid)}
                                title="Entfernen"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Ziel / Menge in einer Zeile */}
                          <div className="tp-item-target">
                            <div className="tp-item-target-row">
                              <div className="tp-item-target-main">
                                {/* Serien/Sätze */}
                                <input
                                  className="tp-input tp-input-xs tp-item-input-small"
                                  value={
                                    t.sets != null &&
                                    !Number.isNaN(t.sets)
                                      ? String(t.sets)
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value.trim();
                                    const num =
                                      raw === ""
                                        ? null
                                        : Number(
                                            raw.replace(",", ".")
                                          );
                                    onUpdateItemTarget(iid, {
                                      sets: num,
                                    });
                                  }}
                                  placeholder="Sätze"
                                />
                                <span className="tp-item-math-sign">x</span>

                                {/* Menge / Wiederholungen / Distanz-Wert */}
                                <input
                                  className="tp-input tp-input-xs tp-item-input-small"
                                  value={
                                    t.menge != null &&
                                    !Number.isNaN(t.menge)
                                      ? String(t.menge)
                                      : ""
                                  }
                                  onChange={(e) =>
                                    onUpdateItemTarget(iid, {
                                      menge:
                                        e.target.value.trim() === ""
                                          ? null
                                          : Number(
                                              e.target.value
                                                .trim()
                                                .replace(",", ".")
                                            ),
                                    })
                                  }
                                  placeholder="Menge"
                                />

                                {/* Einheit (z.B. m, s, Wdh.) */}
                                <input
                                  className="tp-input tp-input-xs tp-item-input-small"
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
                              </div>

                              {/* Notiz-Icon rechts in derselben Zeile */}
                              <div className="tp-item-comment-toggle">
                                <button
                                  type="button"
                                  className={
                                    "tp-icon-button tp-note-btn" +
                                    (hasComment
                                      ? " tp-note-btn--active"
                                      : "")
                                  }
                                  title={
                                    commentVisible
                                      ? "Kommentar ausblenden"
                                      : hasComment
                                      ? "Kommentar anzeigen"
                                      : "Kommentar hinzufügen"
                                  }
                                  onClick={() =>
                                    setOpenItemComments((prev) => ({
                                      ...prev,
                                      [iid]: !commentVisible,
                                    }))
                                  }
                                >
                                  {hasComment ? "🗒️" : "📝"}
                                </button>
                              </div>
                            </div>

                            {/* Kommentar-Zeile unterhalb, volle Breite */}
                            {commentVisible && (
                              <div className="tp-item-comment">
                                <textarea
                                  className="tp-input tp-item-comment-textarea"
                                  value={it.comment ?? ""}
                                  onChange={(e) =>
                                    onUpdateItemComment(
                                      iid,
                                      e.target.value
                                    )
                                  }
                                  onInput={handleTextareaAutoResize}
                                  placeholder="Kommentar / Hinweis"
                                  rows={1}
                                />
                              </div>
                            )}
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
