import React, { useEffect, useMemo, useState } from "react";
import { useTrainingsplanung } from "../hooks/useTrainingsplanung";
import PlanEditor from "../components/PlanEditor";
import "../styles/Trainingsplanung.css";
import { toISODate } from "../../common/date";
import {
  loadAnmeldung,
  DayStatus,
  AnmeldungData,
} from "../../anmeldung/services/AnmeldungStore";
import { loadAthleten } from "@/modules/athleten/services/AthletenStore";
import type { Athlete } from "@/modules/athleten/types/athleten";
import type {
  PlanDay,
  PlanItem,
  PlanBlock,
} from "../services/TrainingsplanungStore";
import type { ExerciseLite } from "@/modules/uebungskatalog/services/ExercisesLite";
import TrainingsplanungHeader from "../components/TrainingsplanungHeader";
import TrainingsplanungExercisePanel from "../components/TrainingsplanungExercisePanel";
import TrainingsplanungBlocksPanel from "../components/TrainingsplanungBlocksPanel";
import TrainingsplanungCopyPanel from "../components/TrainingsplanungCopyPanel";

type CandidateExercise = {
  id: string;
  name: string;
  haupt?: string | null;
  unter?: string | null;
  reps?: number | null;
  menge?: number | null;
  einheit?: string | null;
};

function isoWeek(dateIso: string): number {
  const d = new Date(dateIso + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - day + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const diff = d.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function createPlanItemFromCandidate(ex: CandidateExercise): PlanItem {
  const baseTarget = {
    reps: ex.reps ?? null,
    menge: ex.menge ?? null,
    einheit: ex.einheit ?? "",
    sets: null,
    distanceM: null,
    weightKg: null,
    durationSec: null,
  };

  return {
    exerciseId: ex.id,
    nameCache: ex.name,
    groupCache: { haupt: ex.haupt ?? undefined, unter: ex.unter ?? undefined },
    default: baseTarget,
    target: { ...baseTarget },
    pauseSec: null,
    comment: "",
  } as PlanItem;
}

export default function TrainingsplanungPage() {
  const {
    dateISO,
    setDateISO,
    athleteId,
    setAthleteId,
    athleteName,
    setAthleteName,
    planDay,
    loading,
    saving,
    dirty,
    canSave,
    allExercises,
    search,
    setSearch,
    onlyRegistered,
    setOnlyRegistered,
    weekDates,
    updateDay,
    updateItem,
    save,
    filteredExercises,
    copyScope,
    setCopyScope,
    copyToAthleteId,
    setCopyToAthleteId,
    copyToWeekOffset,
    setCopyToWeekOffset,
    copyPlanTo,
  } = useTrainingsplanung();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [anmeldung, setAnmeldung] = useState<AnmeldungData | null>(null);
  const [anmeldungLoading, setAnmeldungLoading] = useState<boolean>(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [manualEx, setManualEx] = useState<{
    id: string;
    name: string;
    reps?: number | null;
    menge?: number | null;
    einheit?: string | null;
  }>({
    id: "",
    name: "",
    reps: null,
    menge: null,
    einheit: null,
  });

  // Athleten laden
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await loadAthleten();
        if (!cancelled) {
          const base = Array.isArray(list) ? list : [];
          setAthletes(base.filter((a) => a.active !== false));
        }
      } catch (e) {
        console.error("Trainingsplanung: Athleten laden fehlgeschlagen", e);
        if (!cancelled) {
          setAthletes([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Anmeldedaten laden
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setAnmeldungLoading(true);
        const data = await loadAnmeldung();
        if (!cancelled) setAnmeldung(data);
      } catch (err) {
        console.error("Trainingsplanung: Anmeldung laden fehlgeschlagen", err);
        if (!cancelled) setAnmeldung(null);
      } finally {
        if (!cancelled) setAnmeldungLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Blöcke / aktiver Block
  const blocks: Record<string, PlanBlock> = planDay.blocks ?? {};
  const blockOrder: string[] = planDay.blockOrder ?? [];

  useEffect(() => {
    if (!activeBlockId && blockOrder.length > 0) {
      setActiveBlockId(blockOrder[0]);
    }
  }, [blockOrder, activeBlockId]);

  const activeBlock: PlanBlock | undefined = activeBlockId
    ? blocks[activeBlockId]
    : undefined;

  const planOrder: string[] = activeBlock
    ? activeBlock.itemOrder
    : planDay.order ?? [];
  const planItems: Record<string, PlanItem> = planDay.items ?? {};

  const dayInfos = useMemo(
    () =>
      weekDates.map((d) => {
        let status: DayStatus | null = null;
        if (athleteId && anmeldung?.statuses) {
          const key = `${athleteId}:${d}`;
          status = anmeldung.statuses[key] ?? null;
        }
        return { date: d, status };
      }),
    [weekDates, athleteId, anmeldung]
  );

  const currentWeek = isoWeek(dateISO);

  const handleSelectAthlete = (id: string) => {
    setAthleteId(id);
    const a = athletes.find((x) => x.id === id);
    setAthleteName(a ? `${a.lastName} ${a.firstName}` : "");
  };

  const handleAddBlock = () => {
    const id = `block-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    updateDay((draft: PlanDay) => {
      if (!draft.blocks) draft.blocks = {};
      if (!draft.blockOrder) draft.blockOrder = [];
      draft.blocks[id] = {
        id,
        title: "Neuer Block",
        type: "SONSTIGES",
        targetDurationMin: 15,
        itemOrder: [],
      };
      draft.blockOrder.push(id);
    });
    setActiveBlockId(id);
  };

  const handleBlockTitleChange = (blockId: string, title: string) => {
    updateDay((draft: PlanDay) => {
      if (!draft.blocks || !draft.blocks[blockId]) return;
      draft.blocks[blockId].title = title;
    });
  };

  const handleBlockDurationChange = (blockId: string, value: string) => {
    const trimmed = value.trim();
    const n = trimmed ? Number(trimmed.replace(",", ".")) : null;
    updateDay((draft: PlanDay) => {
      if (!draft.blocks || !draft.blocks[blockId]) return;
      draft.blocks[blockId].targetDurationMin =
        n !== null && Number.isFinite(n) ? n : null;
    });
  };

  const handleMoveBlock = (blockId: string, dir: -1 | 1) => {
    updateDay((draft: PlanDay) => {
      if (!draft.blockOrder) return;
      const idx = draft.blockOrder.indexOf(blockId);
      if (idx === -1) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= draft.blockOrder.length) return;
      const copy = [...draft.blockOrder];
      const [removed] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, removed);
      draft.blockOrder = copy;
    });
  };

  const handleDeleteBlock = (blockId: string) => {
    updateDay((draft: PlanDay) => {
      if (!draft.blocks) return;
      const block = draft.blocks[blockId];
      if (!block) return;

      const itemIds = new Set(block.itemOrder);
      draft.order = (draft.order ?? []).filter((id) => !itemIds.has(id));
      delete draft.blocks[blockId];
      if (draft.blockOrder) {
        draft.blockOrder = draft.blockOrder.filter((id) => id !== blockId);
      }
    });

    if (activeBlockId === blockId) {
      setActiveBlockId(null);
    }
  };

  const handleAddExerciseToActiveBlock = (ex: ExerciseLite) => {
    if (!athleteId) return;
    if (!activeBlockId) return;

    const newId = `item-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const candidate: CandidateExercise = {
      id: ex.id,
      name: ex.name,
      haupt: ex.haupt ?? null,
      unter: ex.unter ?? null,
      reps: ex.reps ?? null,
      menge: ex.menge ?? null,
      einheit: ex.einheit ?? null,
    };
    const newItem = createPlanItemFromCandidate(candidate);

    updateDay((draft: PlanDay) => {
      if (!draft.items) draft.items = {};
      draft.items[newId] = newItem;
      if (draft.blocks && draft.blocks[activeBlockId]) {
        draft.blocks[activeBlockId].itemOrder.push(newId);
      } else {
        draft.order = [...(draft.order ?? []), newId];
      }
    });
  };

  const handleAddManual = (m: {
    id: string;
    name: string;
    reps?: number | null;
    menge?: number | null;
    einheit?: string | null;
  }) => {
    if (!athleteId) return;
    if (!activeBlockId) return;
    if (!m.id.trim() && !m.name.trim()) return;

    const ex: CandidateExercise = {
      id: m.id.trim() || m.name.trim(),
      name: m.name.trim() || m.id.trim(),
      reps: m.reps ?? null,
      menge: m.menge ?? null,
      einheit: m.einheit ?? null,
    };

    const newId = `item-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const newItem = createPlanItemFromCandidate(ex);

    updateDay((draft: PlanDay) => {
      if (!draft.items) draft.items = {};
      draft.items[newId] = newItem;
      if (draft.blocks && draft.blocks[activeBlockId]) {
        draft.blocks[activeBlockId].itemOrder.push(newId);
      } else {
        draft.order = [...(draft.order ?? []), newId];
      }
    });

    setManualEx({
      id: "",
      name: "",
      reps: null,
      menge: null,
      einheit: null,
    });
  };

  const handleMoveItem = (id: string, dir: -1 | 1) => {
    updateDay((draft: PlanDay) => {
      if (activeBlockId && draft.blocks && draft.blocks[activeBlockId]) {
        const order = draft.blocks[activeBlockId].itemOrder;
        const idx = order.indexOf(id);
        if (idx === -1) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= order.length) return;
        const copy = [...order];
        const [removed] = copy.splice(idx, 1);
        copy.splice(newIdx, 0, removed);
        draft.blocks[activeBlockId].itemOrder = copy;
      } else {
        const order = draft.order ?? [];
        const idx = order.indexOf(id);
        if (idx === -1) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= order.length) return;
        const copy = [...order];
        const [removed] = copy.splice(idx, 1);
        copy.splice(newIdx, 0, removed);
        draft.order = copy;
      }
    });
  };

  const handleRemoveItem = (id: string) => {
    updateDay((draft: PlanDay) => {
      if (draft.items) {
        delete draft.items[id];
      }
      if (draft.order) {
        draft.order = draft.order.filter((x) => x !== id);
      }
      if (draft.blocks) {
        Object.values(draft.blocks).forEach((blk) => {
          blk.itemOrder = blk.itemOrder.filter((x) => x !== id);
        });
      }
    });
  };

  const handleChangeItem = (id: string, next: PlanItem) => {
    updateItem(id, next);
  };

  const handleCopy = () => {
    if (!copyToAthleteId) return;
    copyPlanTo();
  };

  if (loading) {
    return <div className="tp-container">Lade Trainingsplanung …</div>;
  }

  const canSaveHeader = canSave && !saving;
  const saveLabel = saving ? "Speichere …" : dirty ? "Speichern*" : "Speichern";

  return (
    <div className="tp-container">
      <div className="tp-left">
        <TrainingsplanungHeader
          dateISO={dateISO}
          onChangeDate={setDateISO}
          currentWeek={currentWeek}
          weekDates={weekDates}
          dayInfos={dayInfos}
          onlyRegistered={onlyRegistered}
          onToggleOnlyRegistered={setOnlyRegistered}
          athletes={athletes}
          athleteId={athleteId}
          athleteName={athleteName}
          onSelectAthlete={handleSelectAthlete}
          canSave={canSaveHeader}
          onSave={save}
          anmeldungLoading={anmeldungLoading}
        />

        <TrainingsplanungExercisePanel
          search={search}
          setSearch={setSearch}
          filteredExercises={filteredExercises}
          hasActiveBlock={!!activeBlockId}
          manualEx={manualEx}
          setManualEx={setManualEx}
          onAddExercise={handleAddExerciseToActiveBlock}
          onAddManual={handleAddManual}
        />
      </div>

      <div className="tp-right">
        <TrainingsplanungBlocksPanel
          dateISO={dateISO}
          blocks={blocks}
          blockOrder={blockOrder}
          activeBlockId={activeBlockId}
          setActiveBlockId={setActiveBlockId}
          onAddBlock={handleAddBlock}
          onChangeTitle={handleBlockTitleChange}
          onChangeDuration={handleBlockDurationChange}
          onMoveBlock={handleMoveBlock}
          onDeleteBlock={handleDeleteBlock}
        />

        <div className="tp-card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Plan für {athleteName || "—"} am {dateISO}
            {activeBlock ? ` – Block ${activeBlock.title}` : ""}
          </div>
          <PlanEditor
            planOrder={planOrder}
            planItems={planItems}
            onChangeItem={handleChangeItem}
            onRemove={handleRemoveItem}
            onMove={handleMoveItem}
          />
        </div>

        <TrainingsplanungCopyPanel
          dateISO={dateISO}
          weekDates={weekDates}
          copyScope={copyScope}
          setCopyScope={setCopyScope}
          copyToAthleteId={copyToAthleteId}
          setCopyToAthleteId={setCopyToAthleteId}
          copyToWeekOffset={copyToWeekOffset}
          setCopyToWeekOffset={setCopyToWeekOffset}
          athletes={athletes}
          onCopy={handleCopy}
        />
      </div>
    </div>
  );
}
