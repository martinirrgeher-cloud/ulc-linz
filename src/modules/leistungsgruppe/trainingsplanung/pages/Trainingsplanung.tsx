// src/modules/leistungsgruppe/trainingsplanung/pages/Trainingsplanung.tsx
import React, { useEffect, useMemo, useState } from "react";
import "../styles/Trainingsplanung.css";
import BlockTemplatePicker from "../components/BlockTemplatePicker";
import {
  startOfISOWeek as startOfISOWeekStr,
  weekRangeFrom,
  toISODate,
  addDays,
} from "../../common/date";
import {
  loadAthleten,
} from "../../../athleten/services/AthletenStore";
import type { Athlete } from "../../../athleten/types/athleten";
import {
  loadAnmeldung,
  DayStatus,
  AnmeldungData,
} from "../../anmeldung/services/AnmeldungStore";
import TrainingsplanungHeader from "../components/TrainingsplanungHeader";
import BlockList from "../components/BlockList";
import ExercisePicker, { ManualExerciseDraft, PickerTab } from "../components/ExercisePicker";
import {
  loadPlans,
  upsertAthleteDay,
  PlanDay,
  PlanItem,
  PlanBlock,
} from "../services/TrainingsplanungStore";
import {
  listExercisesLite,
  ExerciseLite,
} from "../../../uebungskatalog/services/ExercisesLite";
import { loadTrainingsbloecke, type BlockTemplate } from "../../trainingsbloecke/services/TrainingsbloeckeStore";

type AthleteLite = {
  id: string;
  name: string;
  active?: boolean;
};

type StatusMap = Record<string, DayStatus>;

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

function startOfISOWeek(date: Date): string {
  // Wrapper für String-Version
  return startOfISOWeekStr(date);
}

function ensureDay(base: PlanDay | null): PlanDay {
  if (!base) {
    return {
      order: [],
      items: {},
      blocks: {},
      blockOrder: [],
    };
  }
  const blocks = base.blocks ?? {};
  let blockOrder = base.blockOrder ?? Object.keys(blocks);

  // Falls es noch keine Blöcke gibt, aber eine flache order, alles in einen Default-Block legen
  if ((!blockOrder || blockOrder.length === 0) && base.order && base.order.length > 0) {
    const id = "block-standard";
    const blk: PlanBlock = {
      id,
      title: "Plan",
      type: "SONSTIGES",
      targetDurationMin: null,
      itemOrder: [...base.order],
    };
    return {
      ...base,
      blocks: { [id]: blk },
      blockOrder: [id],
    };
  }

  return {
    ...base,
    blocks,
    blockOrder: blockOrder ?? [],
  };
}

function normalizeOrder(day: PlanDay): PlanDay {
  if (!day.blocks || !day.blockOrder || day.blockOrder.length === 0) {
    return day;
  }
  const order: string[] = [];
  for (const bid of day.blockOrder) {
    const blk = day.blocks[bid];
    if (!blk) continue;
    for (const iid of blk.itemOrder) {
      if (!order.includes(iid)) order.push(iid);
    }
  }
  return { ...day, order };
}




export default function TrainingsplanungPage() {
  const [athletes, setAthletes] = useState<AthleteLite[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [weekStartISO, setWeekStartISO] = useState<string>(() =>
    startOfISOWeek(new Date())
  );
  const [dateISO, setDateISO] = useState<string>(() => toISODate(new Date()));

  const [plansByAthlete, setPlansByAthlete] = useState<
    Record<string, Record<string, PlanDay>>
  >({});
  const [currentDay, setCurrentDay] = useState<PlanDay | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [anmeldung, setAnmeldung] = useState<AnmeldungData | null>(null);
  const [anmeldungLoading, setAnmeldungLoading] = useState(false);

  const [exercises, setExercises] = useState<ExerciseLite[]>([]);
  const [exerciseLoading, setExerciseLoading] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("KATALOG");
  const [pickerBlockId, setPickerBlockId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [searchHaupt, setSearchHaupt] = useState("");
  const [searchUnter, setSearchUnter] = useState("");

  const [manualDraft, setManualDraft] = useState<ManualExerciseDraft>({
    name: "",
    haupt: "",
    unter: "",
    reps: "",
    menge: "",
    einheit: "",
  });
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  const [blockTemplates, setBlockTemplates] = useState<BlockTemplate[]>([]);
  const [blockTemplatesLoading, setBlockTemplatesLoading] = useState(false);
  const [blockTemplatesError, setBlockTemplatesError] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // -------------------------------------------------------
  // Initial: Athleten, Pläne, Anmeldung, Katalog laden
  // -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);

        // Athleten
        try {
          const ath = await loadAthleten();
          if (!cancelled) {
            const lite = ath.map(toAthleteLite).sort((a, b) =>
              a.name.localeCompare(b.name, "de", { sensitivity: "base" })
            );
            setAthletes(lite);
            if (!selectedAthleteId && lite.length > 0) {
              setSelectedAthleteId(lite[0].id);
            }
          }
        } catch (err) {
          console.error("Trainingsplanung: loadAthleten fehlgeschlagen", err);
        }

        // Pläne
        try {
          const data = await loadPlans();
          if (!cancelled) {
            setPlansByAthlete(data.plansByAthlete ?? {});
          }
        } catch (err) {
          console.error("Trainingsplanung: loadPlans fehlgeschlagen", err);
          if (!cancelled) {
            setPlansByAthlete({});
          }
        }

        // Anmeldung
        try {
          setAnmeldungLoading(true);
          const a = await loadAnmeldung();
          if (!cancelled) setAnmeldung(a);
        } catch (err) {
          console.error("Trainingsplanung: loadAnmeldung fehlgeschlagen", err);
        } finally {
          if (!cancelled) setAnmeldungLoading(false);
        }

        // Übungskatalog (Lite)
        try {
          setExerciseLoading(true);
          const ex = await listExercisesLite();
          if (!cancelled) setExercises(ex);
        } catch (err) {
          console.error("Trainingsplanung: listExercisesLite fehlgeschlagen", err);
        } finally {
          if (!cancelled) setExerciseLoading(false);
        }

        // Blockvorlagen (Trainingsblöcke)
        try {
          setBlockTemplatesLoading(true);
          const tbData = await loadTrainingsbloecke();
          if (!cancelled) {
            setBlockTemplates(tbData.templates ?? []);
            setBlockTemplatesError(null);
          }
        } catch (err) {
          console.error("Trainingsplanung: loadTrainingsbloecke fehlgeschlagen", err);
          if (!cancelled) {
            setBlockTemplates([]);
            setBlockTemplatesError("Fehler beim Laden der Blockvorlagen.");
          }
        } finally {
          if (!cancelled) setBlockTemplatesLoading(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------
  // Week / days
  // -------------------------------------------------------
  const weekDates: string[] = useMemo(
    () => weekRangeFrom(weekStartISO),
    [weekStartISO]
  );

  // Falls aktuelles Datum nicht in der Woche liegt → auf Wochenstart setzen
  useEffect(() => {
    if (!weekDates.includes(dateISO)) {
      setDateISO(weekDates[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO]);

  const weekLabel = useMemo(() => {
    const d = new Date(weekStartISO + "T00:00:00");
    // einfache KW-Bestimmung über Index in Jahr; reicht hier als Orientierung
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - jan1.getTime();
    const day = Math.floor(diff / (1000 * 60 * 60 * 24));
    const kw = Math.floor((day + jan1.getDay()) / 7) + 1;
    return `KW${kw.toString().padStart(2, "0")} - ${d.getFullYear()}`;
  }, [weekStartISO]);

  // -------------------------------------------------------
  // Anmeldung-Status-Map
  // -------------------------------------------------------
  const statusMap: StatusMap = useMemo(() => {
    const result: StatusMap = {};
    if (!anmeldung || !selectedAthleteId) return result;
    const statuses = anmeldung.statuses ?? {};
    for (const [key, val] of Object.entries(statuses)) {
      // Format in Anmeldung: `${athletId}:${isoDate}`
      if (typeof val === "string" || val === null) {
        result[key] = val as DayStatus;
      }
    }
    return result;
  }, [anmeldung, selectedAthleteId]);

  // -------------------------------------------------------
  // Aktuellen Tagesplan ableiten
  // -------------------------------------------------------
  useEffect(() => {
    if (!selectedAthleteId) {
      setCurrentDay(null);
      return;
    }
    const byAth = plansByAthlete[selectedAthleteId] ?? {};
    const base = byAth[dateISO] ?? null;
    const norm = ensureDay(base);
    setCurrentDay(norm);
  }, [plansByAthlete, selectedAthleteId, dateISO]);

  // -------------------------------------------------------
  // Hilfsfunktionen zum Speichern
  // -------------------------------------------------------
  function saveDay(athleteId: string, iso: string, day: PlanDay) {
    if (!athleteId) return;
    (async () => {
      try {
        setSaving(true);
        const normalized = normalizeOrder(day);
        await upsertAthleteDay(athleteId, iso, normalized);
      } catch (err) {
        console.error("Trainingsplanung: Speichern fehlgeschlagen", err);
        setError("Fehler beim Speichern des Plans.");
      } finally {
        setSaving(false);
      }
    })();
  }

  function updateDay(mutator: (prev: PlanDay) => PlanDay) {
    if (!selectedAthleteId) return;
    setCurrentDay((prev) => {
      const base = ensureDay(prev);
      const next = normalizeOrder(mutator(base));
      setPlansByAthlete((prevPlans) => {
        const copy = { ...prevPlans };
        const inner = { ...(copy[selectedAthleteId] ?? {}) };
        inner[dateISO] = next;
        copy[selectedAthleteId] = inner;
        return copy;
      });
      saveDay(selectedAthleteId, dateISO, next);
      return next;
    });
  }

  // -------------------------------------------------------
  // Block-Operationen
  // -------------------------------------------------------
  function handleAddBlock() {
    const id = `blk-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    setCollapsedBlocks((prev) => ({
      ...prev,
      [id]: true,
    }));
    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const blockOrder = [...(prev.blockOrder ?? [])];
      blocks[id] = {
        id,
        title: "Neuer Block",
        type: "SONSTIGES",
        targetDurationMin: null,
        itemOrder: [],
      };
      blockOrder.push(id);
      return { ...prev, blocks, blockOrder };
    });
  }

  function handleAddBlockFromTemplate(tpl: BlockTemplate) {
    const blockId = `tpl-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    setCollapsedBlocks((prev) => ({
      ...prev,
      [blockId]: true,
    }));

    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const items = { ...(prev.items ?? {}) };
      const blockOrder = [...(prev.blockOrder ?? [])];

      const itemOrder: string[] = [];

      for (const tplItem of tpl.items ?? []) {
        const id = `it-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        itemOrder.push(id);

        const baseTarget = {
          reps: tplItem.target?.reps ?? null,
          menge: tplItem.target?.menge ?? null,
          einheit: tplItem.target?.einheit ?? null,
          sets: tplItem.target?.sets ?? null,
          distanceM: tplItem.target?.distanceM ?? null,
          weightKg: tplItem.target?.weightKg ?? null,
          durationSec: tplItem.target?.durationSec ?? null,
        };

        const item: PlanItem = {
          exerciseId: tplItem.exerciseId || id,
          nameCache: tplItem.name,
          groupCache: {
            haupt: tplItem.haupt ?? undefined,
            unter: tplItem.unter ?? undefined,
          },
          default: baseTarget,
          target: { ...baseTarget },
          pauseSec: null,
          comment: "",
        };

        items[id] = item;
      }

      blocks[blockId] = {
        id: blockId,
        title: tpl.title,
        type: "SONSTIGES",
        targetDurationMin:
          typeof tpl.defaultDurationMin === "number"
            ? tpl.defaultDurationMin
            : null,
        itemOrder,
        notes: tpl.description ?? "",
      };

      blockOrder.push(blockId);

      return {
        ...prev,
        blocks,
        items,
        blockOrder,
      };
    });

    setTemplatePickerOpen(false);
  }

  function handleRemoveBlock(blockId: string) {
    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const removed = blocks[blockId];
      delete blocks[blockId];

      // Items des Blocks optional auch aus items entfernen
      const items = { ...prev.items };
      if (removed) {
        for (const iid of removed.itemOrder) {
          delete items[iid];
        }
      }

      const blockOrder = (prev.blockOrder ?? []).filter((id) => id !== blockId);
      return { ...prev, blocks, blockOrder, items };
    setCollapsedBlocks((prev) => {
      const copy = { ...prev };
      delete copy[blockId];
      return copy;
    });
    });
  }

  function handleUpdateBlockTitle(blockId: string, title: string) {
    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const blk = blocks[blockId];
      if (!blk) return prev;
      blocks[blockId] = { ...blk, title };
      return { ...prev, blocks };
    });
  }

  function handleUpdateBlockDuration(blockId: string, durationMin: string) {
    const val = durationMin.trim();
    const num = val === "" ? null : Number(val.replace(",", "."));
    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const blk = blocks[blockId];
      if (!blk) return prev;
      blocks[blockId] = {
        ...blk,
        targetDurationMin:
          num !== null && !Number.isNaN(num) && num >= 0 ? num : null,
      };
      return { ...prev, blocks };
    });
  }

  function handleUpdateBlockNotes(blockId: string, notes: string) {
    // notes wird einfach als zusätzliches Feld am Block abgelegt
    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const blk = blocks[blockId];
      if (!blk) return prev;
      blocks[blockId] = { ...(blk as any), notes };
      return { ...prev, blocks };
    });
  }

  function toggleBlockCollapsed(blockId: string) {
    setCollapsedBlocks((prev) => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  }
  // -------------------------------------------------------
  // Exercise Picker öffnen
  // -------------------------------------------------------
  function openPickerForBlock(blockId: string) {
    setPickerBlockId(blockId);
    setPickerOpen(true);
    setPickerTab("KATALOG");
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerBlockId(null);
    setSearchText("");
    setSearchHaupt("");
    setSearchUnter("");
    setManualDraft({
      name: "",
      haupt: "",
      unter: "",
      reps: "",
      menge: "",
      einheit: "",
    });
  }

  // -------------------------------------------------------
  // Übungen filtern (Katalog)
  // -------------------------------------------------------
  const filteredExercises = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const h = searchHaupt.trim().toLowerCase();
    const u = searchUnter.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (q) {
        const hay = `${ex.name} ${ex.haupt ?? ""} ${ex.unter ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (h && (ex.haupt ?? "").toLowerCase() !== h) return false;
      if (u && (ex.unter ?? "").toLowerCase() !== u) return false;
      return true;
    });
  }, [exercises, searchText, searchHaupt, searchUnter]);

  const allHauptgruppen = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((ex) => {
      if (ex.haupt) set.add(ex.haupt);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [exercises]);

  const allUntergruppen = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((ex) => {
      if (ex.unter) set.add(ex.unter);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [exercises]);

  // -------------------------------------------------------
  // Übung zu Block hinzufügen (Katalog)
  // -------------------------------------------------------
  function handleAddCatalogExercise(ex: ExerciseLite) {
    if (!pickerBlockId) return;
    const id = `it-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const baseTarget = {
      reps: ex.reps ?? null,
      menge: ex.menge ?? null,
      einheit: ex.einheit ?? null,
      sets: null,
      distanceM: null,
      weightKg: null,
      durationSec: null,
    };

    const item: PlanItem = {
      exerciseId: ex.id,
      nameCache: ex.name,
      groupCache: {
        haupt: ex.haupt ?? undefined,
        unter: ex.unter ?? undefined,
      },
      default: baseTarget,
      target: { ...baseTarget },
      pauseSec: null,
      comment: "",
    };

    updateDay((prev) => {
      const items = { ...prev.items, [id]: item };
      const blocks = { ...(prev.blocks ?? {}) };
      const blk = blocks[pickerBlockId];
      if (!blk) return prev;
      const itemOrder = [...blk.itemOrder, id];
      blocks[pickerBlockId] = { ...blk, itemOrder };
      return { ...prev, items, blocks };
    });

    // nach Auswahl Picker offen lassen (für mehrere Übungen) oder schließen -> hier offen lassen
  }

  // -------------------------------------------------------
  // Übung zu Block hinzufügen (manuell)
  // -------------------------------------------------------
  function handleAddManualExercise() {
    if (!pickerBlockId) return;
    const name = manualDraft.name.trim();
    if (!name) return;

    const reps =
      manualDraft.reps.trim() === ""
        ? null
        : Number(manualDraft.reps.replace(",", "."));
    const menge =
      manualDraft.menge.trim() === ""
        ? null
        : Number(manualDraft.menge.replace(",", "."));
    const einheit = manualDraft.einheit.trim() || null;

    const id = `manual-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const baseTarget = {
      reps: !Number.isNaN(reps ?? NaN) ? reps : null,
      menge: !Number.isNaN(menge ?? NaN) ? menge : null,
      einheit,
      sets: null,
      distanceM: null,
      weightKg: null,
      durationSec: null,
    };

    const item: PlanItem = {
      exerciseId: id,
      nameCache: name,
      groupCache: {
        haupt: manualDraft.haupt || undefined,
        unter: manualDraft.unter || undefined,
      },
      default: baseTarget,
      target: { ...baseTarget },
      pauseSec: null,
      comment: "",
    };

    updateDay((prev) => {
      const items = { ...prev.items, [id]: item };
      const blocks = { ...(prev.blocks ?? {}) };
      const blk = blocks[pickerBlockId];
      if (!blk) return prev;
      const itemOrder = [...blk.itemOrder, id];
      blocks[pickerBlockId] = { ...blk, itemOrder };
      return { ...prev, items, blocks };
    });

    setManualDraft({
      name: "",
      haupt: manualDraft.haupt,
      unter: manualDraft.unter,
      reps: "",
      menge: "",
      einheit: manualDraft.einheit,
    });
  }

  // -------------------------------------------------------
  // Items in Blöcken bearbeiten
  // -------------------------------------------------------
  function handleRemoveItem(blockId: string, itemId: string) {
    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const blk = blocks[blockId];
      if (!blk) return prev;
      const itemOrder = blk.itemOrder.filter((id) => id !== itemId);
      blocks[blockId] = { ...blk, itemOrder };
      const items = { ...prev.items };
      delete items[itemId];
      return { ...prev, blocks, items };
    });
  }

  function handleMoveItem(blockId: string, itemId: string, dir: -1 | 1) {
    updateDay((prev) => {
      const blocks = { ...(prev.blocks ?? {}) };
      const blk = blocks[blockId];
      if (!blk) return prev;
      const idx = blk.itemOrder.indexOf(itemId);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= blk.itemOrder.length) return prev;
      const itemOrder = [...blk.itemOrder];
      const [spliced] = itemOrder.splice(idx, 1);
      itemOrder.splice(target, 0, spliced);
      blocks[blockId] = { ...blk, itemOrder };
      return { ...prev, blocks };
    });
  }

  function handleUpdateItemComment(itemId: string, comment: string) {
    updateDay((prev) => {
      const items = { ...prev.items };
      const it = items[itemId];
      if (!it) return prev;
      items[itemId] = { ...it, comment };
      return { ...prev, items };
    });
  }

  function handleUpdateItemTarget(
    itemId: string,
    patch: Partial<PlanItem["target"]>
  ) {
    updateDay((prev) => {
      const items = { ...prev.items };
      const it = items[itemId];
      if (!it) return prev;
      items[itemId] = {
        ...it,
        target: { ...it.target, ...patch },
      };
      return { ...prev, items };
    });
  }

  // -------------------------------------------------------
  // UI Hilfsdaten
  // -------------------------------------------------------
  const selectedAthlete = useMemo(
    () => athletes.find((a) => a.id === selectedAthleteId) ?? null,
    [athletes, selectedAthleteId]
  );

  const blocks: PlanBlock[] = useMemo(() => {
    if (!currentDay || !currentDay.blocks || !currentDay.blockOrder) return [];
    return currentDay.blockOrder
      .map((id) => currentDay.blocks![id])
      .filter((b): b is PlanBlock => Boolean(b));
  }, [currentDay]);

  const isBusy = loading || saving;

  const handlePrevWeek = () => {
    setWeekStartISO(
      startOfISOWeek(new Date(addDays(weekStartISO, -7) + "T00:00:00"))
    );
  };

  const handleNextWeek = () => {
    setWeekStartISO(
      startOfISOWeek(new Date(addDays(weekStartISO, 7) + "T00:00:00"))
    );
  };


  // -------------------------------------------------------
  // Rendering
  // -------------------------------------------------------
  return (
    <div className="tp-root">
      <TrainingsplanungHeader
        athletes={athletes}
        selectedAthleteId={selectedAthleteId}
        onChangeAthlete={setSelectedAthleteId}
        weekLabel={weekLabel}
        weekDates={weekDates}
        dateISO={dateISO}
        onChangeDate={setDateISO}
        statusMap={statusMap}
        anmeldungLoading={anmeldungLoading}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
      />
      {!selectedAthlete && (
        <div className="tp-info">Bitte zuerst einen Athleten auswählen.</div>
      )}

      {selectedAthlete && (
        <div className="tp-body">
          <div className="tp-body-header">
            <div className="tp-body-title">
              Trainingsplan für {selectedAthlete.name} – {dateISO}
            </div>
            <div className="tp-body-actions">
              <button
                type="button"
                className="tp-btn"
                onClick={handleAddBlock}
              >
                Neuer Block
              </button>
              <button
                type="button"
                className="tp-btn"
                disabled={blockTemplatesLoading || blockTemplates.length === 0}
                onClick={() => setTemplatePickerOpen(true)}
              >
                Block aus Vorlage
              </button>
            </div>
          </div>

          {error && <div className="tp-error">{error}</div>}

          {blocks.length === 0 && (
            <div className="tp-empty">
              Noch keine Blöcke angelegt. Lege einen neuen Block an.
            </div>
          )}

          <BlockList
            blocks={blocks}
            currentDay={currentDay}
            collapsedBlocks={collapsedBlocks}
            onToggleCollapsed={toggleBlockCollapsed}
            onUpdateBlockTitle={handleUpdateBlockTitle}
            onUpdateBlockDuration={handleUpdateBlockDuration}
            onUpdateBlockNotes={handleUpdateBlockNotes}
            onRemoveBlock={handleRemoveBlock}
            onMoveItem={handleMoveItem}
            onRemoveItem={handleRemoveItem}
            onUpdateItemComment={handleUpdateItemComment}
            onUpdateItemTarget={handleUpdateItemTarget}
            onOpenPickerForBlock={openPickerForBlock}
          />
          {isBusy && (
            <div className="tp-badge" style={{ marginTop: 8 }}>
              Änderungen werden gespeichert …
            </div>
          )}
        </div>
      )}

      {/* Übungsauswahl als Overlay / Drawer */}
      <ExercisePicker
        open={pickerOpen}
        onClose={closePicker}
        pickerTab={pickerTab}
        onChangeTab={setPickerTab}
        searchText={searchText}
        onChangeSearchText={setSearchText}
        searchHaupt={searchHaupt}
        onChangeSearchHaupt={setSearchHaupt}
        searchUnter={searchUnter}
        onChangeSearchUnter={setSearchUnter}
        allHauptgruppen={allHauptgruppen}
        allUntergruppen={allUntergruppen}
        filteredExercises={filteredExercises}
        manualDraft={manualDraft}
        onChangeManualDraft={setManualDraft}
        onAddCatalogExercise={handleAddCatalogExercise}
        onAddManualExercise={handleAddManualExercise}
        exerciseLoading={exerciseLoading}
      />
      <BlockTemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        templates={blockTemplates}
        loading={blockTemplatesLoading}
        error={blockTemplatesError}
        onSelectTemplate={handleAddBlockFromTemplate}
      />
    </div>
  );
}