// src/modules/leistungsgruppe/trainingsdoku/pages/Trainingsdoku.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useTrainingsdokuForAthlete } from "../hooks/useTrainingsdokuForAthlete";
import { loadAthleten } from "../../../athleten/services/AthletenStore";
import type { Athlete } from "../../../athleten/types/athleten";
import "../styles/Trainingsdoku.css";
import TdHeader from "../components/TdHeader";
import TdOverallSection from "../components/TdOverallSection";
import TdBlockList from "../components/TdBlockList";

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

  function handleToggleBlockCollapsed(blockId: string) {
    setCollapsedBlocks((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
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
      
            <TdHeader
        athletes={athletes}
        athleteId={athleteId}
        dateISO={dateISO}
        onAthleteChange={handleAthleteChange}
        onDateChange={handleDateChange}
        overallStats={overallStats}
/>


      {error && <div className="td-error">Fehler: {error}</div>}
      {loading && <div className="td-loading">Lade Training ...</div>}

      {doc && (
        <TdOverallSection
          overallRpe={overallRpe}
          overallMood={overallMood}
          overallNote={overallNote}
          onChangeMood={handleOverallMoodChange}
          onChangeNote={handleOverallNoteChange}
        />
      )}

      <TdBlockList
        blockViews={blockViews}
        collapsedBlocks={collapsedBlocks}
        expandedKey={expandedKey}
        onToggleBlockCollapsed={handleToggleBlockCollapsed}
        onToggleExpanded={toggleExpanded}
        onQuickOk={handleQuickOk}
        onActualTargetChange={handleActualTargetChange}
        onPerSetActualChange={handlePerSetActualChange}
        onNoteChange={handleNoteChange}
        onSplitSeriesInDoc={handleSplitSeriesInDoc}
      />
    </div>
  );
};

export default Trainingsdoku;