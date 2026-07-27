import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  Clock3,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Dumbbell,
  ListChecks,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createSectionFromBlock,
  createSectionFromExercise,
  type PlanningBlock,
  type PlanningExercise,
  type TrainingPlan,
  type TrainingPlanInput,
  type TrainingPlanItemInput,
  type TrainingPlanSectionInput,
} from "@/features/training-planning/types";

type PickerMode = "block" | "exercise" | null;

export type TrainingPlanEditorProps = {
  plan: TrainingPlan | null;
  athleteName: string;
  groupName: string;
  trainingDateLabel: string;
  values: TrainingPlanInput;
  blocks: PlanningBlock[];
  exercises: PlanningExercise[];
  canEdit: boolean;
  busy: boolean;
  dirty: boolean;
  onChange: (values: TrainingPlanInput) => void;
  onSave: () => Promise<void>;
  onImport: () => void;
};

function replaceSection(
  values: TrainingPlanInput,
  clientId: string,
  updater: (section: TrainingPlanSectionInput) => TrainingPlanSectionInput,
): TrainingPlanInput {
  return {
    ...values,
    sections: values.sections.map((section) => (
      section.clientId === clientId ? updater(section) : section
    )),
  };
}

function replaceItem(
  section: TrainingPlanSectionInput,
  clientId: string,
  updater: (item: TrainingPlanItemInput) => TrainingPlanItemInput,
): TrainingPlanSectionInput {
  return {
    ...section,
    items: section.items.map((item) => item.clientId === clientId ? updater(item) : item),
  };
}

function moveArrayItem<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  const current = next[index];
  const target = next[targetIndex];
  if (current === undefined || target === undefined) return items;
  next[index] = target;
  next[targetIndex] = current;
  return next;
}

export function TrainingPlanEditor({
  plan,
  athleteName,
  groupName,
  trainingDateLabel,
  values,
  blocks,
  exercises,
  canEdit,
  busy,
  dirty,
  onChange,
  onSave,
  onImport,
}: TrainingPlanEditorProps) {
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

  const totalMinutes = useMemo(() => values.sections.reduce((sum, section) => {
    const minutes = Number.parseInt(section.estimatedMinutes, 10);
    return sum + (Number.isFinite(minutes) && minutes > 0 ? minutes : 0);
  }, 0), [values.sections]);

  const exerciseCount = useMemo(
    () => values.sections.reduce((sum, section) => sum + section.items.length, 0),
    [values.sections],
  );

  const filteredBlocks = useMemo(() => {
    const search = pickerSearch.trim().toLocaleLowerCase("de");
    if (!search) return blocks;
    return blocks.filter((block) => [
      block.name,
      block.goal ?? "",
      block.description ?? "",
      block.items.map((item) => item.exerciseName).join(" "),
    ].some((value) => value.toLocaleLowerCase("de").includes(search)));
  }, [blocks, pickerSearch]);

  const filteredExercises = useMemo(() => {
    const search = pickerSearch.trim().toLocaleLowerCase("de");
    if (!search) return exercises;
    return exercises.filter((exercise) => [
      exercise.name,
      exercise.categoryTitle,
      exercise.subcategory ?? "",
      exercise.goal ?? "",
      exercise.equipment.join(" "),
    ].some((value) => value.toLocaleLowerCase("de").includes(search)));
  }, [exercises, pickerSearch]);

  function update<K extends keyof TrainingPlanInput>(key: K, value: TrainingPlanInput[K]) {
    onChange({ ...values, [key]: value });
  }

  function addBlock(block: PlanningBlock) {
    const section = createSectionFromBlock(block);
    onChange({ ...values, sections: [...values.sections, section] });
    setExpandedSections((current) => new Set([...current, section.clientId]));
    setPickerMode(null);
    setPickerSearch("");
  }

  function addExercise(exercise: PlanningExercise) {
    const section = createSectionFromExercise(exercise);
    onChange({ ...values, sections: [...values.sections, section] });
    setExpandedSections((current) => new Set([...current, section.clientId]));
    setPickerMode(null);
    setPickerSearch("");
  }

  function toggleSection(clientId: string) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  return (
    <section className="training-plan-editor">
      <header className="training-plan-editor-heading">
        <div>
          <p className="eyebrow">Athletenplan</p>
          <h2>{athleteName}</h2>
          <small>{groupName} · {trainingDateLabel}</small>
          {plan?.copiedFromAthleteName && (
            <span className="training-plan-copy-origin">
              <Copy aria-hidden="true" /> Übernommen von {plan.copiedFromAthleteName} · eigenständiger Plan
            </span>
          )}
        </div>
        <div className="training-plan-summary-chips">
          <span><Blocks aria-hidden="true" />{values.sections.length} Abschnitte</span>
          <span><ListChecks aria-hidden="true" />{exerciseCount} Übungen</span>
          <span><Clock3 aria-hidden="true" />{totalMinutes} min</span>
        </div>
      </header>

      <fieldset disabled={!canEdit || busy} className="training-plan-editor-fields">
        <div className="training-plan-basis-grid">
          <label className="training-plan-field">
            <span>Plantitel</span>
            <input
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              maxLength={160}
              placeholder="Trainingstitel"
            />
          </label>
          <label className="training-plan-field training-plan-field-wide">
            <span>Allgemeine Hinweise</span>
            <textarea
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              rows={1}
              placeholder="Hinweise für diesen Athleten und Trainingstag"
            />
          </label>
        </div>

        <div className="training-plan-add-actions">
          <button type="button" className="secondary-button" onClick={() => setPickerMode("block")}>
            <Blocks aria-hidden="true" />Block
          </button>
          <button type="button" className="secondary-button" onClick={() => setPickerMode("exercise")}>
            <Dumbbell aria-hidden="true" />Übung
          </button>
        </div>

        {values.sections.length === 0 ? (
          <div className="training-plan-empty">
            <Dumbbell aria-hidden="true" />
            <h3>Noch keine Inhalte</h3>
            <p>Übernimm einen Trainingsblock oder füge einzelne Übungen hinzu.</p>
          </div>
        ) : (
          <div className="training-plan-section-list">
            {values.sections.map((section, sectionIndex) => {
              const expanded = expandedSections.has(section.clientId);
              return (
                <article className="training-plan-section" key={section.clientId}>
                  <header className="training-plan-section-header">
                    <button
                      type="button"
                      className="training-plan-section-toggle"
                      onClick={() => toggleSection(section.clientId)}
                      aria-expanded={expanded}
                    >
                      <span className="training-plan-section-number">{sectionIndex + 1}</span>
                      <span className="training-plan-section-title">
                        <strong>{section.name}</strong>
                        <small>
                          {section.sectionType === "block" ? "Trainingsblock" : "Einzelübung"}
                          {section.items.length > 0 ? ` · ${section.items.length} Übung${section.items.length === 1 ? "" : "en"}` : ""}
                        </small>
                      </span>
                      <span className="training-plan-section-duration">
                        {section.estimatedMinutes ? `${section.estimatedMinutes} min` : "–"}
                      </span>
                      {expanded ? <ChevronDown className="training-plan-section-chevron" aria-hidden="true" /> : <ChevronRight className="training-plan-section-chevron" aria-hidden="true" />}
                    </button>
                    <div className="training-plan-section-actions">
                      <button
                        type="button"
                        onClick={() => onChange({ ...values, sections: moveArrayItem(values.sections, sectionIndex, -1) })}
                        disabled={sectionIndex === 0}
                        aria-label={`${section.name} nach oben verschieben`}
                        title="Nach oben"
                      ><ArrowUp aria-hidden="true" /></button>
                      <button
                        type="button"
                        onClick={() => onChange({ ...values, sections: moveArrayItem(values.sections, sectionIndex, 1) })}
                        disabled={sectionIndex === values.sections.length - 1}
                        aria-label={`${section.name} nach unten verschieben`}
                        title="Nach unten"
                      ><ArrowDown aria-hidden="true" /></button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => onChange({
                          ...values,
                          sections: values.sections.filter((item) => item.clientId !== section.clientId),
                        })}
                        aria-label={`${section.name} entfernen`}
                        title="Entfernen"
                      ><Trash2 aria-hidden="true" /></button>
                    </div>
                  </header>

                  {expanded && (
                    <div className="training-plan-section-body">
                      <div className="training-plan-section-settings">
                        <label className="training-plan-field">
                          <span>Bezeichnung</span>
                          <input
                            value={section.name}
                            onChange={(event) => onChange(replaceSection(values, section.clientId, (current) => ({
                              ...current,
                              name: event.target.value,
                            })))}
                            maxLength={160}
                          />
                        </label>
                        <label className="training-plan-field training-plan-duration-field">
                          <span>Dauer</span>
                          <span>
                            <input
                              type="number"
                              min={0}
                              max={1440}
                              value={section.estimatedMinutes}
                              onChange={(event) => onChange(replaceSection(values, section.clientId, (current) => ({
                                ...current,
                                estimatedMinutes: event.target.value,
                              })))}
                              placeholder="–"
                            />
                            <small>min</small>
                          </span>
                        </label>
                      </div>

                      {section.goal && <p className="training-plan-section-goal">{section.goal}</p>}

                      <div className="training-plan-item-list">
                        {section.items.map((item, itemIndex) => (
                          <article className="training-plan-item" key={item.clientId}>
                            <header>
                              <span className="training-plan-item-number">{itemIndex + 1}</span>
                              <span className="training-plan-item-title">
                                <strong>{item.exerciseName}</strong>
                                <small>{item.categoryTitle}</small>
                              </span>
                              {section.items.length > 1 && (
                                <div className="training-plan-item-actions">
                                  <button
                                    type="button"
                                    onClick={() => onChange(replaceSection(values, section.clientId, (current) => ({
                                      ...current,
                                      items: moveArrayItem(current.items, itemIndex, -1),
                                    })))}
                                    disabled={itemIndex === 0}
                                    aria-label={`${item.exerciseName} nach oben verschieben`}
                                  ><ArrowUp aria-hidden="true" /></button>
                                  <button
                                    type="button"
                                    onClick={() => onChange(replaceSection(values, section.clientId, (current) => ({
                                      ...current,
                                      items: moveArrayItem(current.items, itemIndex, 1),
                                    })))}
                                    disabled={itemIndex === section.items.length - 1}
                                    aria-label={`${item.exerciseName} nach unten verschieben`}
                                  ><ArrowDown aria-hidden="true" /></button>
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => onChange(replaceSection(values, section.clientId, (current) => ({
                                      ...current,
                                      items: current.items.filter((entry) => entry.clientId !== item.clientId),
                                    })))}
                                    aria-label={`${item.exerciseName} entfernen`}
                                  ><Trash2 aria-hidden="true" /></button>
                                </div>
                              )}
                            </header>

                            {item.parameterDefinitions.length > 0 ? (
                              <div className="training-plan-parameter-grid">
                                {item.parameterDefinitions.map((parameter) => {
                                  const hasSlider = parameter.inputType === "number"
                                    && parameter.minValue !== null
                                    && parameter.maxValue !== null;
                                  const inputValue = item.parameterValues[parameter.key] ?? "";
                                  return (
                                    <label className="training-plan-field" key={parameter.key}>
                                      <span>{parameter.label}{parameter.unit ? ` (${parameter.unit})` : ""}</span>
                                      <div className={`training-plan-parameter-control ${hasSlider ? "has-slider" : ""}`}>
                                        <input
                                          type={parameter.inputType === "number" ? "number" : "text"}
                                          min={parameter.minValue ?? undefined}
                                          max={parameter.maxValue ?? undefined}
                                          step={parameter.stepValue ?? undefined}
                                          value={inputValue}
                                          onChange={(event) => onChange(replaceSection(values, section.clientId, (current) => replaceItem(
                                            current,
                                            item.clientId,
                                            (currentItem) => ({
                                              ...currentItem,
                                              parameterValues: {
                                                ...currentItem.parameterValues,
                                                [parameter.key]: event.target.value,
                                              },
                                            }),
                                          )))}
                                          placeholder={parameter.defaultValue || undefined}
                                        />
                                        {hasSlider && (
                                          <input
                                            type="range"
                                            min={parameter.minValue ?? undefined}
                                            max={parameter.maxValue ?? undefined}
                                            step={parameter.stepValue ?? 1}
                                            value={inputValue || parameter.defaultValue || parameter.minValue || 0}
                                            onChange={(event) => onChange(replaceSection(values, section.clientId, (current) => replaceItem(
                                              current,
                                              item.clientId,
                                              (currentItem) => ({
                                                ...currentItem,
                                                parameterValues: {
                                                  ...currentItem.parameterValues,
                                                  [parameter.key]: event.target.value,
                                                },
                                              }),
                                            )))}
                                            aria-label={`${parameter.label} mit Schieberegler einstellen`}
                                          />
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <small className="training-plan-no-parameters">Keine Planungsparameter hinterlegt.</small>
                            )}

                            <label className="training-plan-field">
                              <span>Individueller Hinweis</span>
                              <textarea
                                rows={1}
                                value={item.note}
                                onChange={(event) => onChange(replaceSection(values, section.clientId, (current) => replaceItem(
                                  current,
                                  item.clientId,
                                  (currentItem) => ({ ...currentItem, note: event.target.value }),
                                )))}
                                placeholder="Hinweis nur für diesen Athleten"
                              />
                            </label>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </fieldset>

      <footer className="training-plan-editor-actions">
        {canEdit && (
          <>
            <button
              type="button"
              className="secondary-button"
              onClick={onImport}
              disabled={busy}
              title="Plan von einem Trainingstag und Athleten importieren"
            >
              <Download aria-hidden="true" />Importieren
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void onSave()}
              disabled={busy || Boolean(plan && !dirty)}
            >
              <Save aria-hidden="true" />
              {busy ? "Wird gespeichert …" : !plan ? "Plan speichern" : dirty ? "Änderungen speichern" : "Gespeichert"}
            </button>
          </>
        )}
      </footer>

      {pickerMode && (
        <div className="training-plan-picker-backdrop" role="presentation">
          <section className="training-plan-picker" role="dialog" aria-modal="true" aria-labelledby="training-plan-picker-title">
            <header>
              <div>
                <p className="eyebrow">Plan erweitern</p>
                <h2 id="training-plan-picker-title">
                  {pickerMode === "block" ? "Trainingsblock auswählen" : "Einzelübung auswählen"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => { setPickerMode(null); setPickerSearch(""); }}
                aria-label="Auswahl schließen"
              ><X aria-hidden="true" /></button>
            </header>
            <label className="training-plan-picker-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder={pickerMode === "block" ? "Block oder Übung suchen" : "Übung suchen"}
                autoFocus
              />
            </label>
            <div className="training-plan-picker-list">
              {pickerMode === "block" && filteredBlocks.map((block) => (
                <button type="button" key={block.id} onClick={() => addBlock(block)}>
                  <span>
                    <strong>{block.name}</strong>
                    <small>{block.items.length} Übungen{block.estimatedMinutes ? ` · ${block.estimatedMinutes} min` : ""}</small>
                  </span>
                  <Plus aria-hidden="true" />
                </button>
              ))}
              {pickerMode === "exercise" && filteredExercises.map((exercise) => (
                <button type="button" key={exercise.id} onClick={() => addExercise(exercise)}>
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{exercise.categoryTitle}{exercise.subcategory ? ` · ${exercise.subcategory}` : ""}</small>
                  </span>
                  <Plus aria-hidden="true" />
                </button>
              ))}
              {((pickerMode === "block" && filteredBlocks.length === 0)
                || (pickerMode === "exercise" && filteredExercises.length === 0)) && (
                <p className="training-plan-picker-empty">Keine passenden Einträge gefunden.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
