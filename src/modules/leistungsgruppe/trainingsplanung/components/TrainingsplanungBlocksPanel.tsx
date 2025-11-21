import React from "react";
import type { PlanBlock } from "../services/TrainingsplanungStore";

type Props = {
  dateISO: string;
  blocks: Record<string, PlanBlock>;
  blockOrder: string[];
  activeBlockId: string | null;
  setActiveBlockId: (id: string | null) => void;
  onAddBlock: () => void;
  onChangeTitle: (blockId: string, title: string) => void;
  onChangeDuration: (blockId: string, value: string) => void;
  onMoveBlock: (blockId: string, dir: -1 | 1) => void;
  onDeleteBlock: (blockId: string) => void;
};

export default function TrainingsplanungBlocksPanel({
  dateISO,
  blocks,
  blockOrder,
  activeBlockId,
  setActiveBlockId,
  onAddBlock,
  onChangeTitle,
  onChangeDuration,
  onMoveBlock,
  onDeleteBlock,
}: Props) {
  return (
    <div className="tp-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 600 }}>Blöcke für {dateISO}</div>
        <button type="button" className="tp-btn" onClick={onAddBlock}>
          Block hinzufügen
        </button>
      </div>

      {blockOrder.length === 0 && (
        <div className="tp-empty">Noch keine Blöcke angelegt.</div>
      )}

      {blockOrder.map((blockId) => {
        const blk = blocks[blockId];
        if (!blk) return null;
        const isActive = activeBlockId === blockId;

        return (
          <div
            key={blockId}
            className={"tp-block-card" + (isActive ? " active" : "")}
            onClick={() => setActiveBlockId(blockId)}
          >
            <div className="tp-block-header">
              <input
                className="tp-input"
                value={blk.title}
                onChange={(e) => onChangeTitle(blockId, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="tp-block-actions">
                <button
                  type="button"
                  className="tp-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveBlock(blockId, -1);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="tp-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveBlock(blockId, 1);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="tp-icon-btn danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBlock(blockId);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="tp-block-meta">
              <label>
                Dauer (min):{" "}
                <input
                  className="tp-input small"
                  value={blk.targetDurationMin ?? ""}
                  onChange={(e) =>
                    onChangeDuration(blockId, e.target.value)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
              <div className="tp-badge">
                {blk.itemOrder.length} Übung(en) im Block
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
