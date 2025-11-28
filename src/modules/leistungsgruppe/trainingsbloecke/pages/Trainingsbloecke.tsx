import React, { useEffect, useMemo, useState, useRef } from "react";
import "../styles/Trainingsbloecke.css";
import {
  loadTrainingsbloecke,
  saveAllTemplates,
  type BlockTemplate,
  type BlockTemplateItem,
} from "../services/TrainingsbloeckeStore";
import {
  loadBlockGroups,
  ensureBlockGroupExists,
  saveBlockGroupsData,
  type BlockGroup,
} from "../services/TrainingsbloeckeGroupsStore";
import {
  listExercisesLite,
  type ExerciseLite,
} from "@/modules/uebungskatalog/services/ExercisesLite";
import type { PlanTarget } from "@/modules/leistungsgruppe/trainingsplanung/services/TrainingsplanungStore";

type SearchState = {
  text: string;
  haupt: string;
  unter: string;
  difficulty: string;
};

type DifficultyValue = 1 | 2 | 3 | 4 | 5;

function createTargetFromExercise(ex: ExerciseLite): PlanTarget {
  return {
    reps: ex.reps ?? null,
    menge: ex.menge ?? null,
    einheit: ex.einheit ?? null,
    sets: null,
    distanceM: null,
    weightKg: null,
    durationSec: null,
  };
}

function createItemFromExercise(ex: ExerciseLite): BlockTemplateItem {
  return {
    id: `item-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    exerciseId: ex.id,
    name: ex.name,
    haupt: ex.haupt ?? null,
    unter: ex.unter ?? null,
    difficulty:
      typeof ex.difficulty === "number" && Number.isFinite(ex.difficulty)
        ? ex.difficulty
        : null,
    target: createTargetFromExercise(ex),
  };
}

function Stars({ value }: { value?: number | null }) {
  const v =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const full = Math.min(5, Math.max(0, Math.round(v)));
  return (
    <span className="tb-stars">
      {"★".repeat(full)}
    </span>
  );
}

function formatMengeEinheit(ex: ExerciseLite): string {
  const anyEx: any = ex as any;
  const menge = anyEx.menge;
  const einheit = anyEx.einheit;

  if (menge == null || menge === "") {
    return einheit ? String(einheit) : "";
  }
  if (einheit) {
    return `${menge} ${einheit}`;
  }
  return String(menge);
}

function getAverageDifficulty(tpl: BlockTemplate): number | null {
  if (!tpl.items || tpl.items.length === 0) return null;
  const values = tpl.items
    .map((it) => it.difficulty)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function formatAverageDifficulty(value: number): string {
  try {
    return value.toLocaleString("de-AT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  } catch {
    return value.toFixed(1);
  }
}

export default function TrainingsbloeckePage() {
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [groups, setGroups] = useState<BlockGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [exercises, setExercises] = useState<ExerciseLite[]>([]);
  const [search, setSearch] = useState<SearchState>({
    text: "",
    haupt: "",
    unter: "",
    difficulty: "",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renameSource, setRenameSource] = useState<string>("");
  const [renameTarget, setRenameTarget] = useState("");
  const pendingSaveRef = useRef<BlockTemplate[] | null>(null);
  const saveTimerRef = useRef<number | null>(null);



  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        const [tplData, exList, grpData] = await Promise.all([
          loadTrainingsbloecke(),
          listExercisesLite(),
          loadBlockGroups(),
        ]);
        if (cancelled) return;
        setTemplates(tplData.templates ?? []);
        setExercises(exList ?? []);
        setGroups(grpData.groups ?? []);
        if (!selectedId && (tplData.templates?.length ?? 0) > 0) {
          setSelectedId(tplData.templates[0].id);
        }
      } catch (err) {
        console.error("Trainingsblöcke: Laden fehlgeschlagen", err);
        if (!cancelled) setError("Fehler beim Laden der Trainingsblöcke.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const groupNames = useMemo(
    () =>
      (groups ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((g) => g.name),
    [groups]
  );

    const visibleTemplates = useMemo(
    () =>
      showInactive
        ? templates
        : templates.filter((tpl) => tpl.active !== false),
    [templates, showInactive]
  );

  const groupedTemplates = useMemo(() => {
    const byGroup: Record<string, BlockTemplate[]> = {};
    for (const tpl of visibleTemplates) {
      const group = (tpl.group ?? "Allgemein").trim() || "Allgemein";
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push(tpl);
    }
    const groupsSorted = Object.keys(byGroup).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
    for (const g of groupsSorted) {
      byGroup[g].sort((a, b) =>
        a.title.localeCompare(b.title, "de", { sensitivity: "base" })
      );
    }
    return { groups: groupsSorted, byGroup };
  }, [visibleTemplates]);

  useEffect(() => {
    if (groupedTemplates.groups.length === 0) return;
    if (Object.keys(collapsedGroups).length > 0) return;

    const initial: Record<string, boolean> = {};
    groupedTemplates.groups.forEach((g) => {
      initial[g] = true;
    });
    setCollapsedGroups(initial);
  }, [groupedTemplates.groups, collapsedGroups]);

  const allCollapsed = useMemo(
    () =>
      groupedTemplates.groups.length > 0 &&
      groupedTemplates.groups.every((g) => collapsedGroups[g]),
    [groupedTemplates.groups, collapsedGroups]
  );

  function handleToggleAllGroups() {
    const next = !allCollapsed;
    const newState: Record<string, boolean> = {};
    groupedTemplates.groups.forEach((g) => {
      newState[g] = next;
    });
    setCollapsedGroups(newState);
  }

  function queueSave(nextTemplates: BlockTemplate[]) {
    pendingSaveRef.current = nextTemplates;
    if (saveTimerRef.current != null) return;
    saveTimerRef.current = window.setTimeout(async () => {
      const toSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
      if (!toSave) return;
      try {
        setSaving(true);
        await saveAllTemplates(toSave);
        // Templates bleiben lokal, damit die Ansicht nicht springt
      } catch (err) {
        console.error("Trainingsblöcke: Autosave fehlgeschlagen", err);
        setError("Fehler beim Speichern.");
      } finally {
        setSaving(false);
      }
    }, 400);
  }

  const filteredExercises = useMemo(() => {
    const t = search.text.trim().toLowerCase();
    const h = search.haupt.trim().toLowerCase();
    const u = search.unter.trim().toLowerCase();
    const d = search.difficulty.trim();

    const diffVal =
      d && !Number.isNaN(Number(d)) ? Number(d) : undefined;

    return exercises.filter((ex) => {
      if (t) {
        const hay = `${ex.name} ${ex.haupt ?? ""} ${ex.unter ?? ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      if (h && !(ex.haupt ?? "").toLowerCase().includes(h)) return false;
      if (u && !(ex.unter ?? "").toLowerCase().includes(u)) return false;
      if (typeof diffVal === "number") {
        if ((ex.difficulty ?? null) !== diffVal) return false;
      }
      return true;
    });
  }, [exercises, search]);

  const hauptOptions = useMemo(
    () =>
      Array.from(
        new Set(
          exercises
            .map((ex) => (ex.haupt ?? "").trim())
            .filter((v) => v.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })),
    [exercises]
  );

  const unterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          exercises
            .filter((ex) =>
              search.haupt
                ? (ex.haupt ?? "")
                    .toLowerCase()
                    .includes(search.haupt.trim().toLowerCase())
                : true
            )
            .map((ex) => (ex.unter ?? "").trim())
            .filter((v) => v.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })),
    [exercises, search.haupt]
  );

  const difficultyOptions = useMemo(
  () =>
    Array.from(
      new Set(
        exercises
          .map((ex) => ex.difficulty)
          .filter(
            (d): d is DifficultyValue =>
              typeof d === "number" && Number.isFinite(d)
          )
      )
    ).sort((a, b) => a - b),
  [exercises]
);

  const usedExerciseIds = useMemo(() => {
    if (!selectedTemplate) return new Set<string>();
    return new Set<string>(
      (selectedTemplate.items ?? []).map((it) => it.exerciseId)
    );
  }, [selectedTemplate]);

  function updateTemplate(id: string, mutator: (tpl: BlockTemplate) => void) {
    setTemplates((prev) => {
      const next = prev.map((tpl) => {
        if (tpl.id !== id) return tpl;
        const copy: BlockTemplate = {
          ...tpl,
          items: tpl.items.map((it) => ({ ...it })),
        };
        mutator(copy);
        return copy;
      });
      queueSave(next);
      return next;
    });
  }


  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      setSaving(true);
      const data = await ensureBlockGroupExists(name);
      setGroups(data.groups ?? []);
      setNewGroupName("");
    } catch (err) {
      console.error("Trainingsblock-Gruppen: Anlegen fehlgeschlagen", err);
      setError("Fehler beim Anlegen der Gruppe.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameGroup() {
    const src = renameSource.trim();
    const tgt = renameTarget.trim();
    if (!src || !tgt || src.toLowerCase() === tgt.toLowerCase()) return;

    try {
      setSaving(true);

      const updatedTemplates = templates.map((tpl) =>
        (tpl.group ?? "Allgemein").trim().toLowerCase() === src.toLowerCase()
          ? { ...tpl, group: tgt }
          : tpl
      );
      setTemplates(updatedTemplates);
      queueSave(updatedTemplates);

      const grpData = await loadBlockGroups();
      const updatedGroups = (grpData.groups ?? []).map((g) =>
        g.name.trim().toLowerCase() === src.toLowerCase()
          ? { ...g, name: tgt }
          : g
      );
      const savedGroups = await saveBlockGroupsData({
        ...grpData,
        groups: updatedGroups,
      });
      setGroups(savedGroups.groups ?? updatedGroups);

      setRenameTarget("");
    } catch (err) {
      console.error("Trainingsblöcke: Gruppe umbenennen fehlgeschlagen", err);
      setError("Fehler beim Umbenennen der Gruppe.");
    } finally {
      setSaving(false);
    }
  }

  function handleNewTemplate() {
    const id = `tpl-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const defaultGroup =
      groupNames.length > 0 ? groupNames[0] : "Allgemein";
    const tpl: BlockTemplate = {
      id,
      title: "Neuer Block",
      group: defaultGroup,
      description: "",
      defaultDurationMin: 15,
      items: [],
    };
    setTemplates((prev) => {
      const next = [...prev, tpl];
      queueSave(next);
      return next;
    });
    setSelectedId(id);
  }

  function handleToggleActive() {
    if (!selectedTemplate) return;
    const id = selectedTemplate.id;
    updateTemplate(id, (tpl) => {
      tpl.active = tpl.active === false ? true : false;
    });
  }

  function handleClearTemplate() {
    if (!selectedTemplate) return;
    // Maske leeren: bestehende Vorlage unverändert lassen,
    // einfach eine neue, leere Vorlage anlegen
    handleNewTemplate();
  }

  function handleAddExercise(ex: ExerciseLite) {
    if (!selectedTemplate) return;
    const prevY = window.scrollY;
    updateTemplate(selectedTemplate.id, (tpl) => {
      tpl.items.push(createItemFromExercise(ex));
    });
    window.setTimeout(() => {
      window.scrollTo(0, prevY);
    }, 0);
  }

  function handleRemoveItem(itemId: string) {
    if (!selectedTemplate) return;
    updateTemplate(selectedTemplate.id, (tpl) => {
      tpl.items = tpl.items.filter((it) => it.id !== itemId);
    });
  }

  function handleMoveItem(itemId: string, dir: -1 | 1) {
    if (!selectedTemplate) return;
    updateTemplate(selectedTemplate.id, (tpl) => {
      const idx = tpl.items.findIndex((it) => it.id === itemId);
      if (idx === -1) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= tpl.items.length) return;
      const copy = [...tpl.items];
      const [removed] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, removed);
      tpl.items = copy;
    });
  }

  function handleChangeTarget(
    itemId: string,
    field: keyof PlanTarget,
    value: string
  ) {
    if (!selectedTemplate) return;
    updateTemplate(selectedTemplate.id, (tpl) => {
      const it = tpl.items.find((x) => x.id === itemId);
      if (!it) return;
      const t: PlanTarget = { ...(it.target as PlanTarget) };
      if (
        field === "reps" ||
        field === "menge" ||
        field === "sets" ||
        field === "distanceM" ||
        field === "weightKg" ||
        field === "durationSec"
      ) {
        const trimmed = value.trim();
        (t as any)[field] = trimmed
          ? Number(trimmed.replace(",", ".")) || null
          : null;
      } else if (field === "einheit") {
        t.einheit = value || null;
      } else {
        (t as any)[field] = value;
      }
      it.target = t;
    });
  }

  if (loading) {
    return <div className="tb-container">Lade Trainingsblöcke …</div>;
  }

  return (
    <div className="tb-container">
      {error && <div className="tb-error">{error}</div>}

      <div className="tb-left">
        <div className="tb-card">
          <div className="tb-card-header">
              <div className="tb-title">Blockvorlagen</div>
              <div className="tb-actions">
                <label className="tb-inline-checkbox">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                  />
                  Inaktive anzeigen
                </label>
                <button
                  className="tb-btn tb-btn-mini"
                  type="button"
                  onClick={handleToggleAllGroups}
                >
                  {allCollapsed ? "Alle öffnen" : "Alle schließen"}
                </button>
                <button
                  className="tb-btn"
                  type="button"
                  onClick={handleNewTemplate}
                >
                  Neue Vorlage
                </button>
              </div>
          </div>

          {groupedTemplates.groups.length === 0 && (
            <div className="tb-empty">Noch keine Vorlagen angelegt.</div>
          )}

          {groupedTemplates.groups.map((group) => {
            const collapsed = collapsedGroups[group] ?? false;
            const templatesInGroup = groupedTemplates.byGroup[group] ?? [];
            return (
              <div key={group} className="tb-group">
                <div
                  className="tb-group-header"
                  onClick={() =>
                    setCollapsedGroups((prev) => ({
                      ...prev,
                      [group]: !collapsed,
                    }))
                  }
                >
                  <span>{group}</span>
                  <span>
                    {templatesInGroup.length} Block
                    {templatesInGroup.length === 1 ? "" : "e"}
                  </span>
                  <span className="tb-group-toggle">
                    {collapsed ? "+" : "–"}
                  </span>
                </div>
                {!collapsed && (
                  <ul className="tb-template-list">
                    {templatesInGroup.map((tpl) => (
                      <li
                        key={tpl.id}
                        className={
                          "tb-template-item" +
                          (tpl.id === selectedId
                            ? " tb-template-item--active"
                            : "") +
                          (tpl.active === false ? " tb-template-item--inactive" : "")
                        }
                        onClick={() => setSelectedId(tpl.id)}
                      >
                        <div className="tb-template-title">{tpl.title}</div>
                        <div className="tb-template-meta">
                          {tpl.items.length} Übung(en)
                          {typeof tpl.defaultDurationMin === "number" &&
                            ` · ${tpl.defaultDurationMin} min`}
                          {(() => {
                            const avg = getAverageDifficulty(tpl);
                            return avg !== null ? (
                              <>
                                {" · "}
                                <span className="tb-template-diff">
                                  <span className="tb-template-diff-star">★</span>
                                  <span className="tb-template-diff-value">
                                    {formatAverageDifficulty(avg)}
                                  </span>
                                </span>
                              </>
                            ) : null;
                          })()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="tb-right">
        {selectedTemplate ? (
          <>
            <div className="tb-card">
              <div className="tb-card-header">
                <div className="tb-title">Vorlage bearbeiten</div>
                <div className="tb-actions">
                  <button
                    type="button"
                    className={
                      "tb-toggle" +
                      (selectedTemplate.active === false
                        ? " tb-toggle--off"
                        : " tb-toggle--on")
                    }
                    onClick={handleToggleActive}
                    disabled={saving}
                  >
                    {selectedTemplate.active === false ? "Inaktiv" : "Aktiv"}
                  </button>
                  <button
                    className="tb-btn tb-btn-secondary"
                    type="button"
                    onClick={handleClearTemplate}
                    disabled={saving}
                  >
                    Maske leeren
                  </button>
                </div>
              </div>
              <div className="tb-form-grid tb-form-grid--three">
                <label>
                  Titel
                  <input
                    className="tb-input"
                    value={selectedTemplate.title}
                    onChange={(e) =>
                      updateTemplate(selectedTemplate.id, (tpl) => {
                        tpl.title = e.target.value;
                      })
                    }
                  />
                </label>
                <label>
                  Gruppe
                  <div className="tb-group-select-row">
                    <select
                      className="tb-input"
                      value={
                        selectedTemplate.group ??
                        (groupNames[0] ?? "Allgemein")
                      }
                      onChange={(e) =>
                        updateTemplate(selectedTemplate.id, (tpl) => {
                          tpl.group = e.target.value;
                        })
                      }
                    >
                      {groupNames.length === 0 && (
                        <option value="Allgemein">Allgemein</option>
                      )}
                      {groupNames.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                      {selectedTemplate.group &&
                        !groupNames.includes(selectedTemplate.group) && (
                          <option value={selectedTemplate.group}>
                            {selectedTemplate.group}
                          </option>
                        )}
                    </select>
                    <button
                      type="button"
                      className="tb-btn tb-btn-mini"
                      onClick={() =>
                        setShowGroupManager((prev) => !prev)
                      }
                    >
                      +
                    </button>
                  </div>
                </label>
                <label>
                  Dauer (min)
                  <input
                    className="tb-input"
                    value={selectedTemplate.defaultDurationMin ?? ""}
                    onChange={(e) => {
                      const trimmed = e.target.value.trim();
                      const n = trimmed
                        ? Number(trimmed.replace(",", "."))
                        : null;
                      updateTemplate(selectedTemplate.id, (tpl) => {
                        tpl.defaultDurationMin =
                          n !== null && Number.isFinite(n) ? n : null;
                      });
                    }}
                  />
                </label>
              </div>
              <label>
                Beschreibung
                <textarea
                  className="tb-textarea"
                  rows={2}
                  value={selectedTemplate.description ?? ""}
                  onChange={(e) =>
                    updateTemplate(selectedTemplate.id, (tpl) => {
                      tpl.description = e.target.value;
                    })
                  }
                />
              </label>
            </div>

            

<div className="tb-card">
              <div className="tb-card-header">
                <div className="tb-title">Übungen im Block</div>
              </div>
              {selectedTemplate.items.length === 0 && (
                <div className="tb-empty">Noch keine Übungen im Block.</div>
              )}
              <div className="tb-items">
                {selectedTemplate.items.map((it) => (
                  <div key={it.id} className="tb-item-row">
                    <div className="tb-item-main">
                      <div className="tb-item-title">{it.name}</div>
                      <div className="tb-item-sub">
                        {it.haupt || it.unter
                          ? [it.haupt, it.unter].filter(Boolean).join(" / ")
                          : it.exerciseId}
                        {typeof it.difficulty === "number" && (
                          <>
                            {" "}
                            · <Stars value={it.difficulty} />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="tb-item-fields">
                      <label>
                        Serie
                        <input
                          className="tb-input tb-input-small"
                          value={it.target.reps ?? ""}
                          onChange={(e) =>
                            handleChangeTarget(it.id, "reps", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Menge
                        <input
                          className="tb-input tb-input-small"
                          value={it.target.menge ?? ""}
                          onChange={(e) =>
                            handleChangeTarget(it.id, "menge", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Einheit
                        <input
                          className="tb-input tb-input-small"
                          value={it.target.einheit ?? ""}
                          onChange={(e) =>
                            handleChangeTarget(it.id, "einheit", e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div className="tb-item-actions">
                      <button
                        className="tb-icon-btn"
                        type="button"
                        onClick={() => handleMoveItem(it.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className="tb-icon-btn"
                        type="button"
                        onClick={() => handleMoveItem(it.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        className="tb-icon-btn tb-icon-btn-danger"
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="tb-card">
              <div className="tb-card-header">
                <div className="tb-title">Übung aus Katalog hinzufügen</div>
              </div>
              <div className="tb-form-grid tb-form-grid--three">
                <input
                  className="tb-input"
                  placeholder="Textsuche"
                  value={search.text}
                  onChange={(e) =>
                    setSearch((prev) => ({ ...prev, text: e.target.value }))
                  }
                />
                <select
                  className="tb-input"
                  value={search.haupt}
                  onChange={(e) =>
                    setSearch((prev) => ({ ...prev, haupt: e.target.value }))
                  }
                >
                  <option value="">– Hauptgruppe –</option>
                  {hauptOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <select
                  className="tb-input"
                  value={search.unter}
                  onChange={(e) =>
                    setSearch((prev) => ({ ...prev, unter: e.target.value }))
                  }
                >
                  <option value="">– Untergruppe –</option>
                  {unterOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tb-form-grid tb-form-grid--single">
                <select
                  className="tb-input"
                  value={search.difficulty}
                  onChange={(e) =>
                    setSearch((prev) => ({
                      ...prev,
                      difficulty: e.target.value,
                    }))
                  }
                >
                  <option value="">– Schwierigkeit –</option>
                  {difficultyOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tb-exercise-list">
                {filteredExercises.length === 0 && (
                  <div className="tb-empty">Keine Übungen gefunden.</div>
                )}
                                {filteredExercises.map((ex) => {
                  const alreadyInBlock = usedExerciseIds.has(ex.id);
                  return (
                    <div key={ex.id} className="tb-exercise-row">
                      <div>
                        <div className="tb-exercise-title-row">
                          <span className="tb-exercise-title">{ex.name}</span>
                          {typeof ex.difficulty === "number" && (
                            <span className="tb-exercise-stars">
                              <Stars value={ex.difficulty} />
                            </span>
                          )}
                        </div>
                        <div className="tb-exercise-subtitle">
                          {[ex.haupt || "", ex.unter || "", formatMengeEinheit(ex)]
                            .filter(Boolean)
                            .join(" · ")}
                          {alreadyInBlock && (
                            <span className="tb-exercise-used">
                              {" "}
                              · bereits im Block
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className={"tb-btn"}
                        type="button"
                        disabled={!selectedTemplate}
                        onClick={() => handleAddExercise(ex)}
                      >
                        Hinzufügen
                      </button>
                    </div>
                  );
                })}
                              
              </div>
            </div>
          </>
        ) : (
          <div className="tb-empty">
            Bitte links eine Vorlage auswählen oder neu anlegen.
          </div>
        )}
      </div>

      {showGroupManager && (
        <div className="tb-overlay" onClick={() => setShowGroupManager(false)}>
          <div
            className="tb-overlay-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tb-card-header">
              <div className="tb-title">Gruppen verwalten</div>
              <button
                type="button"
                className="tb-btn tb-btn-mini"
                onClick={() => setShowGroupManager(false)}
              >
                ✕
              </button>
            </div>
            <div className="tb-group-manager">
              <div className="tb-group-manager-row">
                <div>Neue Gruppe</div>
                <input
                  className="tb-input"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="z.B. Mobility, Athletik …"
                />
                <button
                  type="button"
                  className="tb-btn"
                  onClick={handleCreateGroup}
                  disabled={saving}
                >
                  Hinzufügen
                </button>
              </div>
              <div className="tb-group-manager-row">
                <div>Gruppe umbenennen</div>
                <select
                  className="tb-input"
                  value={renameSource}
                  onChange={(e) => setRenameSource(e.target.value)}
                >
                  <option value="">– Gruppe wählen –</option>
                  {groupNames.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <div className="tb-group-rename-target">
                  <input
                    className="tb-input"
                    value={renameTarget}
                    onChange={(e) => setRenameTarget(e.target.value)}
                    placeholder="Neuer Name"
                  />
                  <button
                    type="button"
                    className="tb-btn"
                    onClick={handleRenameGroup}
                    disabled={
                      saving || !renameSource || !renameTarget.trim()
                    }
                  >
                    Umbenennen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}