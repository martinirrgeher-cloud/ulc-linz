import React, { useEffect, useMemo, useState } from "react";
import "../styles/Trainingsbloecke.css";
import {
  loadTrainingsbloecke,
  upsertBlockTemplate,
  deleteBlockTemplate,
  type BlockTemplate,
  type BlockTemplateItem,
} from "../services/TrainingsbloeckeStore";
import { listExercisesLite, type ExerciseLite } from "@/modules/uebungskatalog/services/ExercisesLite";
import type { PlanTarget } from "@/modules/leistungsgruppe/trainingsplanung/services/TrainingsplanungStore";

type SearchState = {
  text: string;
  haupt: string;
  unter: string;
};

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
    id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    exerciseId: ex.id,
    name: ex.name,
    haupt: ex.haupt ?? null,
    unter: ex.unter ?? null,
    target: createTargetFromExercise(ex),
  };
}

export default function TrainingsbloeckePage() {
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseLite[]>([]);
  const [search, setSearch] = useState<SearchState>({
    text: "",
    haupt: "",
    unter: "",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        const [tplData, exList] = await Promise.all([
          loadTrainingsbloecke(),
          listExercisesLite(),
        ]);
        if (cancelled) return;
        setTemplates(tplData.templates ?? []);
        setExercises(exList ?? []);
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

  const filteredExercises = useMemo(() => {
    const t = search.text.trim().toLowerCase();
    const h = search.haupt.trim().toLowerCase();
    const u = search.unter.trim().toLowerCase();

    return exercises.filter((ex) => {
      if (t) {
        const hay = `${ex.name} ${ex.haupt ?? ""} ${ex.unter ?? ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      if (h && !(ex.haupt ?? "").toLowerCase().includes(h)) return false;
      if (u && !(ex.unter ?? "").toLowerCase().includes(u)) return false;
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
                ? (ex.haupt ?? "").toLowerCase().includes(search.haupt.trim().toLowerCase())
                : true
            )
            .map((ex) => (ex.unter ?? "").trim())
            .filter((v) => v.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })),
    [exercises, search.haupt]
  );


  function updateTemplate(id: string, mutator: (tpl: BlockTemplate) => void) {
    setTemplates((prev) =>
      prev.map((tpl) => {
        if (tpl.id !== id) return tpl;
        const copy: BlockTemplate = {
          ...tpl,
          items: tpl.items.map((it) => ({ ...it })),
        };
        mutator(copy);
        return copy;
      })
    );
  }

  function handleNewTemplate() {
    const id = `tpl-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const tpl: BlockTemplate = {
      id,
      title: "Neuer Block",
      description: "",
      defaultDurationMin: 15,
      items: [],
    };
    setTemplates((prev) => [...prev, tpl]);
    setSelectedId(id);
  }

  async function handleSave() {
    if (!selectedTemplate) return;
    try {
      setSaving(true);
      const data = await upsertBlockTemplate(selectedTemplate);
      setTemplates(data.templates ?? []);
    } catch (err) {
      console.error("Trainingsblöcke: Speichern fehlgeschlagen", err);
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedTemplate) return;
    if (!window.confirm("Vorlage wirklich löschen?")) return;
    try {
      setSaving(true);
      const data = await deleteBlockTemplate(selectedTemplate.id);
      setTemplates(data.templates ?? []);
      if (data.templates.length > 0) {
        setSelectedId(data.templates[0].id);
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      console.error("Trainingsblöcke: Löschen fehlgeschlagen", err);
      setError("Fehler beim Löschen.");
    } finally {
      setSaving(false);
    }
  }

  function handleAddExercise(ex: ExerciseLite) {
    if (!selectedTemplate) return;
    updateTemplate(selectedTemplate.id, (tpl) => {
      tpl.items.push(createItemFromExercise(ex));
    });
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
      const t = { ...it.target };
      if (field === "reps" || field === "menge" || field === "sets" || field === "distanceM" || field === "weightKg" || field === "durationSec") {
        const trimmed = value.trim();
        t[field] = trimmed ? Number(trimmed.replace(",", ".")) || null : null;
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
            <button className="tb-btn" type="button" onClick={handleNewTemplate}>
              Neue Vorlage
            </button>
          </div>
          {templates.length === 0 && (
            <div className="tb-empty">Noch keine Vorlagen angelegt.</div>
          )}
          <ul className="tb-template-list">
            {templates.map((tpl) => (
              <li
                key={tpl.id}
                className={
                  "tb-template-item" +
                  (tpl.id === selectedId ? " tb-template-item--active" : "")
                }
                onClick={() => setSelectedId(tpl.id)}
              >
                <div className="tb-template-title">{tpl.title}</div>
                <div className="tb-template-meta">
                  {tpl.items.length} Übung(en)
                  {typeof tpl.defaultDurationMin === "number" &&
                    ` · ${tpl.defaultDurationMin} min`}
                </div>
              </li>
            ))}
          </ul>
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
                    className="tb-btn tb-btn-secondary"
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    Löschen
                  </button>
                  <button
                    className="tb-btn tb-btn-primary"
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Speichere …" : "Speichern"}
                  </button>
                </div>
              </div>
              <div className="tb-form-grid">
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
                      </div>
                    </div>
                    <div className="tb-item-fields">
                      <label>
                        Wdh.
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
              <div className="tb-form-grid">
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
              <div className="tb-exercise-list">
                {filteredExercises.length === 0 && (
                  <div className="tb-empty">Keine Übungen gefunden.</div>
                )}
                {filteredExercises.map((ex) => (
                  <div key={ex.id} className="tb-exercise-row">
                    <div>
                      <div className="tb-exercise-title">{ex.name}</div>
                      {(ex.haupt || ex.unter) && (
                        <div className="tb-exercise-subtitle">
                          {[ex.haupt, ex.unter].filter(Boolean).join(" / ")}
                        </div>
                      )}
                    </div>
                    <button
                      className="tb-btn"
                      type="button"
                      onClick={() => handleAddExercise(ex)}
                    >
                      Hinzufügen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="tb-empty">
            Bitte links eine Vorlage auswählen oder neu anlegen.
          </div>
        )}
      </div>
    </div>
  );
}
