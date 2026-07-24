import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Copy,
  ListChecks,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ExerciseTrainingGroup } from "@/features/exercise-catalog/types";
import {
  createEmptyTrainingBlockInput,
  createTrainingBlockItemInput,
  duplicateTrainingBlockItemInput,
  trainingBlockToInput,
  type TrainingBlock,
  type TrainingBlockExercise,
  type TrainingBlockInput,
  type TrainingBlockItemInput,
} from "@/features/training-blocks/types";

export type TrainingBlockEditorProps = {
  block: TrainingBlock | null;
  groups: ExerciseTrainingGroup[];
  exercises: TrainingBlockExercise[];
  canEdit: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: TrainingBlockInput) => Promise<void>;
};

type EditorSection = "basis" | "exercises";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Der Trainingsblock konnte nicht gespeichert werden.";
}

export function TrainingBlockEditor({
  block,
  groups,
  exercises,
  canEdit,
  busy,
  onCancel,
  onSubmit,
}: TrainingBlockEditorProps) {
  const [section, setSection] = useState<EditorSection>("basis");
  const [values, setValues] = useState<TrainingBlockInput>(() =>
    block ? trainingBlockToInput(block) : createEmptyTrainingBlockInput(),
  );
  const [pickerOpen, setPickerOpen] = useState(block === null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseCategory, setExerciseCategory] = useState("all");
  const [localError, setLocalError] = useState<string | null>(null);

  const exerciseById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );

  const categories = useMemo(() => {
    const values = new Map<string, string>();
    exercises.forEach((exercise) => values.set(exercise.categoryKey, exercise.categoryTitle));
    return [...values.entries()]
      .map(([key, title]) => ({ key, title }))
      .sort((left, right) => left.title.localeCompare(right.title, "de"));
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const search = exerciseSearch.trim().toLocaleLowerCase("de");
    return exercises
      .filter((exercise) => exercise.isActive)
      .filter((exercise) => exerciseCategory === "all" || exercise.categoryKey === exerciseCategory)
      .filter((exercise) => {
        if (!search) return true;
        return [
          exercise.name,
          exercise.categoryTitle,
          exercise.subcategory ?? "",
          exercise.goal ?? "",
        ].some((value) => value.toLocaleLowerCase("de").includes(search));
      })
      .sort((left, right) => left.name.localeCompare(right.name, "de", { sensitivity: "base" }));
  }, [exerciseCategory, exerciseSearch, exercises]);

  function update<K extends keyof TrainingBlockInput>(key: K, value: TrainingBlockInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleGroup(groupId: string) {
    setValues((current) => ({
      ...current,
      groupIds: current.groupIds.includes(groupId)
        ? current.groupIds.filter((id) => id !== groupId)
        : [...current.groupIds, groupId],
    }));
  }

  function addExercise(exercise: TrainingBlockExercise) {
    setValues((current) => ({
      ...current,
      items: [...current.items, createTrainingBlockItemInput(exercise)],
    }));
  }

  function updateItem(clientId: string, updater: (item: TrainingBlockItemInput) => TrainingBlockItemInput) {
    setValues((current) => ({
      ...current,
      items: current.items.map((item) => item.clientId === clientId ? updater(item) : item),
    }));
  }

  function moveItem(index: number, offset: -1 | 1) {
    setValues((current) => {
      const targetIndex = index + offset;
      if (targetIndex < 0 || targetIndex >= current.items.length) return current;
      const currentItem = current.items[index];
      const targetItem = current.items[targetIndex];
      if (!currentItem || !targetItem) return current;
      const items = [...current.items];
      items[index] = targetItem;
      items[targetIndex] = currentItem;
      return { ...current, items };
    });
  }

  function duplicateItem(index: number) {
    setValues((current) => {
      const item = current.items[index];
      if (!item) return current;
      const items = [...current.items];
      items.splice(index + 1, 0, duplicateTrainingBlockItemInput(item));
      return { ...current, items };
    });
  }

  function removeItem(clientId: string) {
    setValues((current) => ({
      ...current,
      items: current.items.filter((item) => item.clientId !== clientId),
    }));
  }

  async function handleSave() {
    setLocalError(null);
    if (values.name.trim().length < 2) {
      setSection("basis");
      setLocalError("Bitte einen Namen mit mindestens zwei Zeichen eingeben.");
      return;
    }
    if (values.items.length === 0) {
      setSection("exercises");
      setLocalError("Bitte mindestens eine Übung hinzufügen.");
      return;
    }

    try {
      await onSubmit(values);
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  }

  return (
    <div className="training-block-editor-backdrop" role="presentation">
      <section
        className="training-block-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-block-editor-title"
      >
        <header className="training-block-editor-header">
          <div>
            <p className="eyebrow">Trainingsplanung</p>
            <h2 id="training-block-editor-title">{block ? block.name : "Neuer Trainingsblock"}</h2>
            <small>{canEdit ? "Übungen ordnen und Belastungswerte anpassen" : "Trainingsblock ansehen"}</small>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Trainingsblock schließen"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="training-block-editor-tabs" role="tablist" aria-label="Trainingsblock bearbeiten">
          <button
            type="button"
            className={section === "basis" ? "active" : ""}
            onClick={() => setSection("basis")}
            role="tab"
            aria-selected={section === "basis"}
          >
            <ClipboardCheck aria-hidden="true" />
            Basis
          </button>
          <button
            type="button"
            className={section === "exercises" ? "active" : ""}
            onClick={() => setSection("exercises")}
            role="tab"
            aria-selected={section === "exercises"}
          >
            <ListChecks aria-hidden="true" />
            Übungen <span>{values.items.length}</span>
          </button>
        </div>

        <div className="training-block-editor-body">
          {localError && <div className="alert error compact-alert">{localError}</div>}

          <fieldset disabled={!canEdit || busy}>
            {section === "basis" && (
              <div className="training-block-editor-panel">
                <div className="training-block-form-grid">
                  <label className="training-block-field training-block-field-wide">
                    <span>Name *</span>
                    <input
                      value={values.name}
                      onChange={(event) => update("name", event.target.value)}
                      maxLength={120}
                      placeholder="z. B. Beschleunigung – Grundlagen"
                      autoFocus
                    />
                  </label>

                  <label className="training-block-field training-block-field-wide">
                    <span>Trainingsziel</span>
                    <input
                      value={values.goal}
                      onChange={(event) => update("goal", event.target.value)}
                      maxLength={240}
                      placeholder="Was soll mit diesem Block erreicht werden?"
                    />
                  </label>

                  <label className="training-block-field">
                    <span>Geschätzte Dauer</span>
                    <div className="training-block-number-field">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="600"
                        value={values.estimatedMinutes}
                        onChange={(event) => update("estimatedMinutes", event.target.value)}
                      />
                      <span>min</span>
                    </div>
                  </label>

                  <label className="training-block-active-toggle">
                    <input
                      type="checkbox"
                      checked={values.isActive}
                      onChange={(event) => update("isActive", event.target.checked)}
                    />
                    <span>
                      <strong>Block aktiv</strong>
                      <small>Inaktive Blöcke bleiben in bestehenden Plänen erhalten.</small>
                    </span>
                  </label>

                  <label className="training-block-field training-block-field-wide">
                    <span>Beschreibung</span>
                    <textarea
                      value={values.description}
                      onChange={(event) => update("description", event.target.value)}
                      rows={4}
                      placeholder="Hinweise zum Aufbau oder zur Verwendung"
                    />
                  </label>
                </div>

                <fieldset className="training-block-group-selection">
                  <legend>Geeignete Leistungsgruppen</legend>
                  <p>Ohne Auswahl ist der Block vereinsweit verfügbar.</p>
                  {groups.length === 0 ? (
                    <small>Keine aktiven Trainingsgruppen vorhanden.</small>
                  ) : (
                    <div>
                      {groups.map((group) => (
                        <label key={group.id}>
                          <input
                            type="checkbox"
                            checked={values.groupIds.includes(group.id)}
                            onChange={() => toggleGroup(group.id)}
                          />
                          {group.shortName || group.name}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              </div>
            )}

            {section === "exercises" && (
              <div className="training-block-editor-panel training-block-exercises-panel">
                {canEdit && (
                  <div className="training-block-picker-shell">
                    <button
                      type="button"
                      className="secondary-button training-block-picker-toggle"
                      onClick={() => setPickerOpen((current) => !current)}
                    >
                      <Plus aria-hidden="true" />
                      Übung hinzufügen
                    </button>

                    {pickerOpen && (
                      <div className="training-block-picker">
                        <div className="training-block-picker-toolbar">
                          <label>
                            <Search aria-hidden="true" />
                            <input
                              type="search"
                              value={exerciseSearch}
                              onChange={(event) => setExerciseSearch(event.target.value)}
                              placeholder="Übung suchen"
                              aria-label="Übung suchen"
                            />
                          </label>
                          <select
                            value={exerciseCategory}
                            onChange={(event) => setExerciseCategory(event.target.value)}
                            aria-label="Übungskategorie filtern"
                          >
                            <option value="all">Alle Kategorien</option>
                            {categories.map((category) => (
                              <option value={category.key} key={category.key}>{category.title}</option>
                            ))}
                          </select>
                        </div>

                        {filteredExercises.length === 0 ? (
                          <div className="training-block-picker-empty">Keine passende aktive Übung gefunden.</div>
                        ) : (
                          <div className="training-block-picker-list">
                            {filteredExercises.map((exercise) => (
                              <button type="button" onClick={() => addExercise(exercise)} key={exercise.id}>
                                <span>
                                  <strong>{exercise.name}</strong>
                                  <small>
                                    {exercise.categoryTitle}
                                    {exercise.subcategory ? ` · ${exercise.subcategory}` : ""}
                                  </small>
                                </span>
                                <Plus aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {values.items.length === 0 ? (
                  <div className="training-block-empty-items">
                    <ListChecks aria-hidden="true" />
                    <h3>Noch keine Übungen</h3>
                    <p>Füge Übungen aus dem Katalog hinzu und passe danach die Belastungswerte an.</p>
                  </div>
                ) : (
                  <div className="training-block-item-list">
                    {values.items.map((item, index) => {
                      const exercise = exerciseById.get(item.exerciseId);
                      if (!exercise) {
                        return (
                          <article className="training-block-item-card missing" key={item.clientId}>
                            <strong>Übung nicht mehr verfügbar</strong>
                            {canEdit && (
                              <button type="button" className="text-button danger-text" onClick={() => removeItem(item.clientId)}>
                                Entfernen
                              </button>
                            )}
                          </article>
                        );
                      }

                      return (
                        <article className="training-block-item-card" key={item.clientId}>
                          <header>
                            <span className="training-block-item-number">{index + 1}</span>
                            <div className="training-block-item-title">
                              <strong>{exercise.name}</strong>
                              <small>{exercise.categoryTitle}{!exercise.isActive ? " · inaktiv" : ""}</small>
                            </div>
                            {canEdit && (
                              <div className="training-block-item-actions">
                                <button
                                  type="button"
                                  onClick={() => moveItem(index, -1)}
                                  disabled={index === 0}
                                  aria-label={`${exercise.name} nach oben verschieben`}
                                  title="Nach oben"
                                >
                                  <ArrowUp aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveItem(index, 1)}
                                  disabled={index === values.items.length - 1}
                                  aria-label={`${exercise.name} nach unten verschieben`}
                                  title="Nach unten"
                                >
                                  <ArrowDown aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => duplicateItem(index)}
                                  aria-label={`${exercise.name} duplizieren`}
                                  title="Übung duplizieren"
                                >
                                  <Copy aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => removeItem(item.clientId)}
                                  aria-label={`${exercise.name} entfernen`}
                                  title="Entfernen"
                                >
                                  <Trash2 aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </header>

                          {exercise.parameters.length > 0 ? (
                            <div className="training-block-parameter-grid">
                              {exercise.parameters.map((parameter) => (
                                <label className="training-block-field" key={parameter.key}>
                                  <span>{parameter.label}{parameter.isRequired ? " *" : ""}</span>
                                  <div className={`training-block-parameter-control ${parameter.inputType === "number" && parameter.minValue !== null && parameter.maxValue !== null ? "has-slider" : ""}`}>
                                    <div className="training-block-parameter-input">
                                      <input
                                        type={parameter.inputType === "number" ? "number" : "text"}
                                        inputMode={parameter.inputType === "number" ? "decimal" : undefined}
                                        min={parameter.minValue ?? undefined}
                                        max={parameter.maxValue ?? undefined}
                                        step={parameter.stepValue ?? undefined}
                                        value={item.parameterValues[parameter.key] ?? ""}
                                        onChange={(event) => updateItem(item.clientId, (current) => ({
                                          ...current,
                                          parameterValues: {
                                            ...current.parameterValues,
                                            [parameter.key]: event.target.value,
                                          },
                                        }))}
                                        placeholder={parameter.defaultValue || undefined}
                                      />
                                      {parameter.unit && <span>{parameter.unit}</span>}
                                    </div>
                                    {parameter.inputType === "number" && parameter.minValue !== null && parameter.maxValue !== null && (
                                      <div className="training-block-slider-inline">
                                        <input
                                          type="range"
                                          min={parameter.minValue}
                                          max={parameter.maxValue}
                                          step={parameter.stepValue ?? 1}
                                          value={item.parameterValues[parameter.key] || parameter.defaultValue || parameter.minValue}
                                          onChange={(event) => updateItem(item.clientId, (current) => ({
                                            ...current,
                                            parameterValues: {
                                              ...current.parameterValues,
                                              [parameter.key]: event.target.value,
                                            },
                                          }))}
                                          aria-label={`${parameter.label} mit Schieberegler einstellen`}
                                        />
                                        <small>{parameter.minValue}–{parameter.maxValue}{parameter.unit ? ` ${parameter.unit}` : ""}</small>
                                      </div>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="training-block-no-parameters">Für diese Übung sind keine Planungsparameter hinterlegt.</p>
                          )}

                          <label className="training-block-field">
                            <span>Hinweis für diesen Block</span>
                            <textarea
                              value={item.note}
                              onChange={(event) => updateItem(item.clientId, (current) => ({
                                ...current,
                                note: event.target.value,
                              }))}
                              rows={2}
                              placeholder="z. B. Fokus auf vollständige Erholung"
                            />
                          </label>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </div>

        <footer className="training-block-editor-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            {canEdit ? "Abbrechen" : "Schließen"}
          </button>
          {canEdit && (
            <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={busy}>
              <Save aria-hidden="true" />
              {busy ? "Wird gespeichert …" : "Speichern"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
