// src/modules/leistungsgruppe/trainingsdoku/pages/Trainingsdoku.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useTrainingsdokuForAthlete } from "../hooks/useTrainingsdokuForAthlete";
import { loadAthleten } from "../../../athleten/services/AthletenStore";
import type { Athlete } from "../../../athleten/types/athleten";
import "../styles/Trainingsdoku.css";

type AthleteLite = {
  id: string;
  name: string;
  active: boolean;
};

function formatAthleteName(a: Athlete): string {
  if (a.firstName || a.lastName) {
    return `${a.lastName ?? ""} ${a.firstName ?? ""}`.trim();
  }
  return a.name ?? a.id;
}

function toAthleteLite(a: Athlete): AthleteLite {
  return {
    id: a.id,
    name: formatAthleteName(a),
    active: a.active ?? true,
  };
}

function formatTarget(target: any | null | undefined): string {
  if (!target) return "";
  const parts: string[] = [];

  const sets = target.sets;
  const reps = target.reps;
  const menge = target.menge;
  const einheit = target.einheit;

  let combinedMengeWithSets = false;

  if (sets != null && reps != null) {
    // Klassischer Fall: z.B. 5 × 5 Wdh
    parts.push(`${sets} × ${reps} Wdh`);
  } else if (sets != null && menge != null && einheit) {
    // Z.B. 5 × 200 m (Läufe etc.)
    parts.push(`${sets} × ${menge} ${einheit}`);
    combinedMengeWithSets = true;
  } else if (reps != null) {
    parts.push(`${reps} Wdh`);
  }

  if (!combinedMengeWithSets) {
    if (menge != null && einheit) {
      parts.push(`${menge} ${einheit}`);
    } else {
      const distance = target.distanceM ?? target.distance;
      if (distance != null) {
        const unit = target.distanceUnit || "m";
        parts.push(`${distance} ${unit}`);
      }
    }
  }

  // Zusatzwert (Zeit / Gewicht) sauber auswerten
  // - Für neue Pläne verwenden wir durationSec für Zeiten und weightKg für Gewichte,
  //   gesteuert über target.extraUnit.
  // - Für ältere Pläne unterstützen wir weiterhin target.timeSec.
  // - Falls extraUnit = "sek" gesetzt ist, aber nur weightKg befüllt ist,
  //   interpretieren wir weightKg rückwirkend als Sekunden.
  const extraUnit: "kg" | "sek" | "" =
    target.extraUnit === "kg" || target.extraUnit === "sek"
      ? target.extraUnit
      : "";

  let timeSec: number | null =
    (target.durationSec ?? target.timeSec) != null
      ? (target.durationSec ?? target.timeSec)
      : null;
  let weightKg: number | null =
    target.weightKg != null && !Number.isNaN(target.weightKg)
      ? target.weightKg
      : null;

  // Rückwärtskompatibilität: Sekunden wurden früher teilweise in weightKg gespeichert,
  // wenn im Plan "sek" ausgewählt war.
  if (extraUnit === "sek" && timeSec == null && weightKg != null) {
    timeSec = weightKg;
    weightKg = null;
  }

  // Zeit anzeigen (falls vorhanden)
  if (timeSec != null && !Number.isNaN(timeSec)) {
    const min = Math.floor(timeSec / 60);
    const sec = timeSec % 60;
    if (min > 0) {
      parts.push(`${min}′${sec.toString().padStart(2, "0")}″`);
    } else {
      parts.push(`${sec}s`);
    }
  }

  // Gewicht nur anzeigen, wenn es wirklich ein Gewicht ist
  if (weightKg != null && !Number.isNaN(weightKg) && extraUnit !== "sek") {
    parts.push(`${weightKg} kg`);
  }

  if (target.intensity != null) {
    parts.push(`Intensität ${target.intensity}`);
  }

  return parts.join(" · ");
}


function getPerSetExtraUnit(
  planned: any,
  perSet: any[] | undefined
): "" | "kg" | "sek" {
  // 1) Wenn im Plan explizit eine Einheit gesetzt wurde, hat diese Vorrang.
  if (planned?.extraUnit === "kg" || planned?.extraUnit === "sek") {
    return planned.extraUnit;
  }

  // 2) Zuerst auf Per-Set-Werte schauen: wenn nur Zeiten vorkommen -> "sek", wenn nur Gewichte -> "kg".
  if (perSet && perSet.length > 0) {
    let hasTime = false;
    let hasWeight = false;
    for (const st of perSet) {
      if (st?.durationSec != null && !Number.isNaN(st.durationSec as any)) {
        hasTime = true;
      }
      if (st?.weightKg != null && !Number.isNaN(st.weightKg as any)) {
        hasWeight = true;
      }
    }
    if (hasTime && !hasWeight) return "sek";
    if (hasWeight && !hasTime) return "kg";
    if (hasTime && hasWeight) {
      // Falls beides vorkommt, bevorzugen wir Zeiten, da Läufe typischerweise so dokumentiert werden.
      return "sek";
    }
  }

  // 3) Fallback auf aggregierte Plan-Werte.
  const durationSec = planned?.durationSec ?? planned?.timeSec;
  if (durationSec != null && !Number.isNaN(durationSec)) {
    return "sek";
  }
  if (planned?.weightKg != null && !Number.isNaN(planned.weightKg)) {
    return "kg";
  }

  return "";
}

function formatPerSetSummary(
  planned: any,
  perSet: any[] | undefined
): string {
  if (!planned || !perSet || perSet.length === 0) return "";

  const unit = getPerSetExtraUnit(planned, perSet);
  if (!unit) return "";

  const values: string[] = perSet.map((st) => {
    const raw =
      unit === "kg"
        ? st?.weightKg
        : (st?.durationSec);
    if (raw == null || Number.isNaN(raw)) return "?";
    const str = String(raw);
    return str.replace(".", ",");
  });

  const label = unit === "kg" ? "Gewichte" : "Zeiten";
  const suffix = unit === "kg" ? "kg" : "s";

  return `${label}: ${values.join(" / ")} ${suffix}`;
}
function statusLabel(status: string | undefined): string {
  switch (status) {
    case "completedAsPlanned":
      return "ok wie geplant";
    case "partial":
      return "gemacht mit Einschränkungen";
    case "completedWithIssues":
      return "gemacht, aber Probleme";
    case "completedModified":
      return "erledigt (angepasst)";
    case "skipped":
      return "nicht gemacht";
    case "planned":
    default:
      return "noch offen";
  }
}

export const Trainingsdoku: React.FC = () => {
  const {
    athleteId,
    setAthleteId,
    dateISO,
    setDateISO,
    doc,
    blockViews,
    loading,
    error,
    updateDoc,
  } = useTrainingsdokuForAthlete();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  const [athletes, setAthletes] = useState<AthleteLite[]>([]);

  // Athleten laden (analog Trainingsplanung), damit eine Auswahl möglich ist
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await loadAthleten();
        if (cancelled) return;
        const list = raw.map(toAthleteLite).filter((a) => a.active);
        setAthletes(list);

        // Falls noch kein Athlet gesetzt ist, wähle einen sinnvollen Default
        if (!athleteId && list.length > 0) {
          setAthleteId(list[0].id);
        }
      } catch (err) {
        console.error("Trainingsdoku: loadAthleten fehlgeschlagen", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, setAthleteId]);

  const athleteName = useMemo(() => {
    const fromList = athletes.find((a) => a.id === athleteId);
    if (fromList) return fromList.name;

    try {
      const w = window as any;
      const current = w?.ULC?.currentAthlete;
      if (!current) return athleteId || "";
      return (
        current.name ||
        current.displayName ||
        current.fullName ||
        athleteId ||
        ""
      );
    } catch {
      return athleteId || "";
    }
  }, [athletes, athleteId]);

  const overallStats = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const bv of blockViews) {
      for (const item of bv.items) {
        total += 1;
        if (
          item.status === "completedAsPlanned" ||
          item.status === "completedModified" ||
          item.status === "partial"
        ) {
          done += 1;
        }
      }
    }
    return { total, done };
  }, [blockViews]);

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setExpandedKey(null);
    setDateISO(e.target.value);
  }

  function handleAthleteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setExpandedKey(null);
    setAthleteId(e.target.value);
  }

  function toggleExpanded(blockId: string, itemId: string) {
    const key = `${blockId}:${itemId}`;
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  function handleQuickOk(blockId: string, itemId: string) {
    updateDoc((draft) => {
      const block = draft.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const item = block.items[itemId];
      if (!item) return;

      const current = (item.status || "planned") as any;
      let next: any;
      switch (current) {
        case "planned":
          next = "completedAsPlanned";
          break;
        case "completedAsPlanned":
          next = "partial";
          break;
        case "partial":
          next = "completedWithIssues";
          break;
        case "completedWithIssues":
          next = "skipped";
          break;
        case "skipped":
          next = "planned";
          break;
        case "completedModified":
          next = "completedAsPlanned";
          break;
        default:
          next = "completedAsPlanned";
      }

      item.status = next as any;

      if (next === "planned" || next === "skipped") {
        item.actualTarget = null;
        item.actualPerSetTargets = undefined;
      } else {
        if (item.plannedTarget && !item.actualTarget) {
          item.actualTarget = JSON.parse(JSON.stringify(item.plannedTarget));
        }
        if (
          item.plannedPerSetTargets &&
          item.plannedPerSetTargets.length > 0 &&
          (!item.actualPerSetTargets ||
            item.actualPerSetTargets.length !== item.plannedPerSetTargets.length)
        ) {
          item.actualPerSetTargets = item.plannedPerSetTargets.map((st: any) =>
            st
              ? {
                  weightKg: st.weightKg ?? null,
                  durationSec: st.durationSec ?? null,
                }
              : { weightKg: null, durationSec: null }
          );
        }
      }
    });
  }

  
function handlePerSetActualChange(
    blockId: string,
    itemId: string,
    setIndex: number,
    rawValue: string
  ) {
    updateDoc((draft) => {
      const block = draft.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const item = block.items[itemId];
      if (!item) return;

      const planned = item.plannedTarget as any;
      const perSet = item.plannedPerSetTargets as any[] | undefined;
      if (!planned || !perSet || perSet.length === 0) return;

      const unit = getPerSetExtraUnit(planned, perSet);
      if (!unit) return;

      const count = perSet.length;
      if (!item.actualPerSetTargets || item.actualPerSetTargets.length !== count) {
        item.actualPerSetTargets = perSet.map((st: any) => ({
          weightKg: st?.weightKg ?? null,
          durationSec: st?.durationSec ?? null,
        }));
      }

      const arr = item.actualPerSetTargets!;
      const target = { ...(arr[setIndex] || { weightKg: null, durationSec: null }) };

      const trimmed = rawValue.trim();
      if (trimmed === "") {
        if (unit === "kg") {
          target.weightKg = null;
        } else if (unit === "sek") {
          target.durationSec = null;
        }
      } else {
        const normalized = trimmed.replace(",", ".").replace(/\s+/g, "");
        const num = Number(normalized);
        if (Number.isNaN(num)) {
          return;
        }
        if (unit === "kg") {
          target.weightKg = num;
        } else if (unit === "sek") {
          target.durationSec = num;
        }
        if (item.status === "completedAsPlanned" || item.status === "planned") {
          item.status = "completedModified";
        }
      }

      arr[setIndex] = target;
      item.actualPerSetTargets = arr;
    });
  }

    
  function handleActualTargetChange(
    blockId: string,
    itemId: string,
    field: "sets" | "reps",
    rawValue: string
  ) {
    updateDoc((draft) => {
      const block = draft.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const item = block.items[itemId];
      if (!item) return;

      const planned = item.plannedTarget as any;
      if (!planned) return;

      if (!item.actualTarget && item.plannedTarget) {
        item.actualTarget = JSON.parse(JSON.stringify(item.plannedTarget));
      }
      const actual = item.actualTarget as any;
      if (!actual) return;

      const trimmed = rawValue.trim();
      let nextValue: number | null;
      if (trimmed === "") {
        nextValue = null;
      } else {
        const normalized = trimmed.replace(",", ".").replace(/\s+/g, "");
        const num = Number(normalized);
        if (Number.isNaN(num)) {
          return;
        }
        nextValue = Math.max(0, Math.floor(num));
      }

      if (field === "sets") {
        actual.sets = nextValue;
      } else if (field === "reps") {
        actual.reps = nextValue;
      }

      item.actualTarget = actual;

      if (
        item.status === "planned" ||
        item.status === "completedAsPlanned"
      ) {
        item.status = "completedModified" as any;
      }
    });
  }

  function handleSplitSeriesInDoc(blockId: string, itemId: string) {
    updateDoc((draft) => {
      const block = draft.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const item = block.items[itemId];
      if (!item) return;

      const planned = item.plannedTarget as any;
      const actual = item.actualTarget as any;

      const sets =
        (actual && typeof actual.sets === "number" && actual.sets > 0
          ? actual.sets
          : undefined) ??
        (planned && typeof planned.sets === "number" && planned.sets > 0
          ? planned.sets
          : undefined);

      if (!sets || sets <= 1) return;

      const basePlannedWeight = planned?.weightKg ?? null;
      const basePlannedDur = planned?.durationSec ?? planned?.timeSec ?? null;

      const baseActualWeight =
        actual && typeof actual.weightKg === "number"
          ? actual.weightKg
          : basePlannedWeight;
      const baseActualDur =
        (actual && typeof actual.durationSec === "number"
          ? actual.durationSec
          : actual && typeof actual.timeSec === "number"
          ? actual.timeSec
          : undefined) ?? basePlannedDur;

      const prevPlanned = item.plannedPerSetTargets || [];
      const prevActual = item.actualPerSetTargets || [];

      item.plannedPerSetTargets = Array.from({ length: sets }, (_, idx) => {
        const prev = prevPlanned[idx];
        return {
          weightKg:
            prev && typeof prev.weightKg === "number"
              ? prev.weightKg
              : basePlannedWeight,
          durationSec:
            prev && typeof prev.durationSec === "number"
              ? prev.durationSec
              : basePlannedDur,
        };
      });

      item.actualPerSetTargets = Array.from({ length: sets }, (_, idx) => {
        const prev = prevActual[idx];
        return {
          weightKg:
            prev && typeof prev.weightKg === "number"
              ? prev.weightKg
              : baseActualWeight,
          durationSec:
            prev && typeof prev.durationSec === "number"
              ? prev.durationSec
              : baseActualDur,
        };
      });
    });
  }

  function handleNoteChange(
    blockId: string,
    itemId: string,
    note: string
  ) {
    updateDoc((draft) => {
      const block = draft.blocks.find((b) => b.id === blockId);
      if (!block) return;
      const item = block.items[itemId];
      if (!item) return;
      item.note = note || undefined;
    });
  }

  function handleOverallRpeChange(value: number) {
    updateDoc((draft) => {
      if (!draft.overall) draft.overall = {};
      draft.overall.rpe = value;
    });
  }

  function handleOverallMoodChange(value: string) {
    updateDoc((draft) => {
      if (!draft.overall) draft.overall = {};
      draft.overall.mood = (value || undefined) as any;
    });
  }

  function handleOverallNoteChange(value: string) {
    updateDoc((draft) => {
      if (!draft.overall) draft.overall = {};
      draft.overall.note = value || undefined;
    });
  }

  const overallRpe = doc?.overall?.rpe ?? 0;
  const overallMood = doc?.overall?.mood ?? "";
  const overallNote = doc?.overall?.note ?? "";

  return (
    <div className="td-root">
      
            <div className="td-top-row">
        <div className="td-athlete-select">
          <label htmlFor="td-athlete">Athlet</label>
          <select
            id="td-athlete"
            value={athleteId}
            onChange={handleAthleteChange}
          >
            <option value="">– bitte wählen –</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="td-date-picker">
          <label htmlFor="td-date">Datum</label>
          <input
            id="td-date"
            type="date"
            value={dateISO}
            onChange={handleDateChange}
          />
        </div>
      </div>

      <div className="td-summary-row">
        {overallStats.total > 0 ? (
          <span>
            {overallStats.done}/{overallStats.total} Übungen erledigt
          </span>
        ) : (
          <span>Keine Übungen für diesen Tag</span>
        )}
      </div>


      {error && <div className="td-error">Fehler: {error}</div>}
      {loading && <div className="td-loading">Lade Training ...</div>}

      {doc && (
        <section className="td-overall">
          <h2 className="td-section-title">Tagesfeedback</h2>
          <div className="td-overall-row">
            <label>Tagesverfassung</label>
            <select
              value={overallMood}
              onChange={(e) => handleOverallMoodChange(e.target.value)}
            >
              <option value="">–</option>
              <option value="great">😊 gut</option>
              <option value="ok">😐 ok</option>
              <option value="tired">🥱 müde</option>
            </select>
          </div>

          <div className="td-overall-row">
            <label>Tagesnotiz</label>
            <textarea
              rows={3}
              value={overallNote}
              onChange={(e) => handleOverallNoteChange(e.target.value)}
            />
          </div>
        </section>
      )}

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
                  onClick={() =>
                    setCollapsedBlocks((prev) => ({
                      ...prev,
                      [block.id]: !prev[block.id],
                    }))
                  }
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
                        onClick={() => handleQuickOk(block.id, item.id)}
                      >
                        {item.status === "skipped"
                          ? "X"
                          : item.status === "completedModified"
                          ? "~"
                          : "OK"}
                      </button>

                      <div
                        className="td-item-main"
                        onClick={() => toggleExpanded(block.id, item.id)}
                      >
                        <div className="td-item-title">
                          {item.nameCache || item.exerciseId}
                        </div>
                        <div className="td-item-sub">
                          {planned && (
                            <span className="td-item-plan">
                              Plan: {formatTarget(planned)}
                            </span>
                          )}
                          {planned && item.plannedPerSetTargets && item.plannedPerSetTargets.length > 0 && (
                            <span className="td-item-plan-perset">
                              {formatPerSetSummary(planned, item.plannedPerSetTargets as any[])}
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
                                    handleActualTargetChange(
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
                                    handleActualTargetChange(
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
                                  onClick={() => handleSplitSeriesInDoc(block.id, item.id)}
                                >
                                  Serien aufsplitten
                                </button>
                              </div>
                            )}

                          {planned && item.plannedPerSetTargets && item.plannedPerSetTargets.length > 0 && (
                            <div className="td-item-details-row td-item-details-row--perset">
                              <label>Serien (Plan / Ist)</label>
                              <div className="td-item-perset-list">
                                {item.plannedPerSetTargets.map((st, idx) => {
                                  const unit = getPerSetExtraUnit(planned, item.plannedPerSetTargets as any[]);
                                  const plannedVal =
                                    unit === "kg"
                                      ? st?.weightKg
                                      : (st?.durationSec);
                                  const plannedStr =
                                    plannedVal == null || Number.isNaN(plannedVal)
                                      ? ""
                                      : String(plannedVal).replace(".", ",");
                                  const actualArr = item.actualPerSetTargets as any[] | undefined;
                                  const actualEntry = actualArr && actualArr[idx];
                                  const actualVal =
                                    unit === "kg"
                                      ? actualEntry?.weightKg
                                      : (actualEntry?.durationSec);
                                  const actualStr =
                                    actualVal == null || Number.isNaN(actualVal)
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
                                          ? (planned.reps != null || (planned.menge != null && planned.einheit)
                                              ? " · "
                                              : "") +
                                            `${plannedStr} ${unit === "kg" ? "kg" : "s"}`
                                          : ""}
                                      </div>
                                      <div className="td-item-perset-actual">
                                        <input
                                          className="td-input-perset"
                                          value={actualStr}
                                          onChange={(e) =>
                                            handlePerSetActualChange(
                                              block.id,
                                              item.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                          placeholder={unit === "kg" ? "Ist-Gewicht" : "Ist-Zeit"}
                                        />
                                        <span className="td-item-perset-unit">
                                          {unit === "kg" ? "kg" : unit === "sek" ? "s" : ""}
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
                                handleNoteChange(
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
    </div>
  );
};

export default Trainingsdoku;