// src/modules/leistungsgruppe/trainingsplanung/components/PlanWeekOverviewModal.tsx
import React, { useMemo } from "react";
import type {
  PlanDay,
  PlanBlock,
  PlanItem,
  PlanTarget,
  PlanTargetPerSet,
} from "../services/TrainingsplanungStore";

type PlansByDay = Record<string, PlanDay>;

type Props = {
  open: boolean;
  onClose: () => void;
  athleteName: string;
  weekLabel: string;
  weekDates: string[];
  plansByDay: PlansByDay | null | undefined;
};

function formatDateParts(iso: string): { weekday: string; date: string } {
  try {
    const d = new Date(iso + "T00:00:00");
    const weekday = d.toLocaleDateString("de-AT", {
      weekday: "short",
    });
    const date = d.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
    });
    return { weekday, date };
  } catch {
    return { weekday: iso, date: "" };
  }
}

function formatMainTarget(t: PlanTarget): string {
  const parts: string[] = [];

  if (t.sets != null && !Number.isNaN(t.sets as any) && t.sets > 0) {
    parts.push(`${t.sets} x`);
  }

  if (t.menge != null && !Number.isNaN(t.menge as any)) {
    parts.push(String(t.menge).replace(".", ","));
  }

  if (t.einheit) {
    parts.push(t.einheit);
  }

  return parts.join(" ");
}

function inferExtraUnit(t: PlanTarget): "" | "kg" | "sek" {
  if (t.weightKg != null && !Number.isNaN(t.weightKg as any)) return "kg";
  if (t.durationSec != null && !Number.isNaN(t.durationSec as any)) return "sek";
  return "";
}

function formatExtraTarget(t: PlanTarget): string {
  const unit = inferExtraUnit(t);
  if (unit === "kg" && t.weightKg != null && !Number.isNaN(t.weightKg as any)) {
    return `${String(t.weightKg).replace(".", ",")} kg`;
  }
  if (unit === "sek" && t.durationSec != null && !Number.isNaN(t.durationSec as any)) {
    return `${String(t.durationSec).replace(".", ",")} sek`;
  }
  return "";
}

function formatPerSetTargets(perSet: PlanTargetPerSet[] | undefined): string[] {
  if (!perSet || perSet.length === 0) return [];
  const lines: string[] = [];

  perSet.forEach((p, idx) => {
    const n = idx + 1;
    const parts: string[] = [];
    if (p.weightKg != null && !Number.isNaN(p.weightKg as any)) {
      parts.push(`${String(p.weightKg).replace(".", ",")} kg`);
    }
    if (p.durationSec != null && !Number.isNaN(p.durationSec as any)) {
      parts.push(`${String(p.durationSec).replace(".", ",")} sek`);
    }

    if (parts.length > 0) {
      lines.push(`Satz ${n}: ${parts.join(" / ")}`);
    }
  });

  return lines;
}

function PlanWeekOverviewModal(props: Props) {
  const { open, onClose, athleteName, weekLabel, weekDates, plansByDay } = props;

  const dayEntries = useMemo(
    () =>
      weekDates.map((iso) => ({
        iso,
        plan: plansByDay?.[iso] ?? null,
        labels: formatDateParts(iso),
      })),
    [weekDates, plansByDay]
  );

  if (!open) return null;

  return (
    <div className="tp-picker-overlay" onClick={onClose}>
      <div
        className="tp-picker-dialog tp-week-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tp-picker-header">
          <div className="tp-week-header-main">
            <div className="tp-week-title">
              Trainingsplan – {weekLabel}
            </div>
            <div className="tp-week-subtitle">{athleteName}</div>
          </div>
          <button
            type="button"
            className="tp-picker-close"
            onClick={onClose}
            aria-label="Wochenansicht schließen"
          >
            ✕
          </button>
        </div>

        <div className="tp-picker-body tp-week-body">
          {dayEntries.map(({ iso, plan, labels }) => {
            const blocks: PlanBlock[] =
              plan && plan.blocks && plan.blockOrder
                ? plan.blockOrder
                    .map((id) => plan.blocks![id])
                    .filter((b): b is PlanBlock => Boolean(b))
                : [];

            const hasContent = blocks.length > 0;

            return (
              <div key={iso} className="tp-week-day-card">
                <div className="tp-week-day-header">
                  <div className="tp-week-day-name">
                    {labels.weekday}
                  </div>
                  <div className="tp-week-day-date">
                    {labels.date}
                  </div>
                </div>

                {!hasContent && (
                  <div className="tp-week-empty">
                    Kein Training geplant.
                  </div>
                )}

                {hasContent && (
                  <div className="tp-week-blocks">
                    {blocks.map((blk) => {
                      const items: PlanItem[] =
                        blk.itemOrder
                          .map((iid) => plan!.items[iid])
                          .filter((it): it is PlanItem => Boolean(it)) ?? [];

                      return (
                        <div key={blk.id} className="tp-week-block">
                          <div className="tp-week-block-title-row">
                            <div className="tp-week-block-title">
                              {blk.title || "Block"}
                            </div>
                            {blk.targetDurationMin != null &&
                              !Number.isNaN(blk.targetDurationMin as any) && (
                                <div className="tp-week-block-duration">
                                  ca.{" "}
                                  {String(blk.targetDurationMin).replace(
                                    ".",
                                    ","
                                  )}{" "}
                                  min
                                </div>
                              )}
                          </div>
                          {blk.notes && blk.notes.trim() !== "" && (
                            <div className="tp-week-block-notes">
                              {blk.notes}
                            </div>
                          )}

                          <div className="tp-week-items">
                            {items.map((it) => {
                              const main = formatMainTarget(it.target);
                              const extra = formatExtraTarget(it.target);
                              const perSetLines = formatPerSetTargets(
                                it.perSetTargets
                              );

                              return (
                                <div
                                  key={it.exerciseId + ":" + main + extra}
                                  className="tp-week-item"
                                >
                                  <div className="tp-week-item-name">
                                    {it.nameCache ?? it.exerciseId}
                                  </div>
                                  {it.groupCache && (
                                    <div className="tp-week-item-meta">
                                      {[it.groupCache.haupt, it.groupCache.unter]
                                        .filter(Boolean)
                                        .join(" / ")}
                                    </div>
                                  )}
                                  {(main || extra) && (
                                    <div className="tp-week-item-target">
                                      {main}
                                      {extra && (main ? " – " : "")}
                                      {extra}
                                    </div>
                                  )}
                                  {perSetLines.length > 0 && (
                                    <div className="tp-week-item-perset">
                                      {perSetLines.map((line) => (
                                        <div
                                          key={line}
                                          className="tp-week-item-perset-line"
                                        >
                                          {line}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {it.comment && it.comment.trim() !== "" && (
                                    <div className="tp-week-item-comment">
                                      {it.comment}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PlanWeekOverviewModal;
