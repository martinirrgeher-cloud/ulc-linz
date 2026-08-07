import { useMemo, useState, type ReactNode } from "react";
import { useDraftDirtyState } from "@/features/collaboration/useDraftDirtyState";
import {
  Check,
  Dumbbell,
  FileText,
  Link2,
  ListChecks,
  Save,
  Settings2,
  Video,
  X,
} from "lucide-react";
import { findExerciseNameCandidates } from "@/features/exercise-catalog/name-similarity";
import {
  createEmptyExerciseInput,
  createParameterDefinition,
  exerciseToInput,
  type Exercise,
  type ExerciseCategory,
  type ExerciseDifficulty,
  type ExerciseInput,
  type ExerciseListOption,
  type ExerciseParameterDefinition,
  type ExerciseParameterKey,
  type ExerciseParameterOption,
  type ExerciseTrainingGroup,
} from "@/features/exercise-catalog/types";
import { ExerciseVideoPanel } from "@/features/exercise-catalog/ExerciseVideoPanel";

export type EditorSection = "basis" | "anleitung" | "relations" | "parameter" | "videos";

export type ExerciseEditorProps = {
  exercise: Exercise | null;
  catalogExercises: Exercise[];
  categories: ExerciseCategory[];
  subcategories: ExerciseListOption[];
  materials: ExerciseListOption[];
  difficulties: ExerciseDifficulty[];
  parameterOptions: ExerciseParameterOption[];
  groups: ExerciseTrainingGroup[];
  organizationId: string;
  initialSection?: EditorSection;
  initialValues?: ExerciseInput;
  canEdit: boolean;
  busy: boolean;
  lockNotice?: ReactNode;
  headerEyebrow?: string;
  headerTitle?: string;
  headerMeta?: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  footerExtra?: ReactNode;
  showVideos?: boolean;
  videoEditEnabled?: boolean;
  validateValues?: (values: ExerciseInput) => string | null;
  onCancel: () => void;
  onSubmit: (values: ExerciseInput) => Promise<void>;
  onVideosChanged?: (videos: Exercise["videos"]) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function nullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberInputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

export function ExerciseEditor({
  exercise,
  catalogExercises,
  categories,
  subcategories,
  materials,
  difficulties,
  parameterOptions,
  groups,
  organizationId,
  initialSection = "basis",
  initialValues,
  canEdit,
  busy,
  lockNotice,
  headerEyebrow = "Übungskatalog",
  headerTitle,
  headerMeta,
  submitLabel = "Speichern",
  cancelLabel,
  footerExtra,
  showVideos = true,
  videoEditEnabled = true,
  validateValues,
  onCancel,
  onSubmit,
  onVideosChanged,
  onDirtyChange,
}: ExerciseEditorProps) {
  const defaultCategoryKey = categories.find((category) => category.isActive !== false)?.key
    ?? categories[0]?.key
    ?? "warmup";
  const [section, setSection] = useState<EditorSection>(initialSection);
  const [values, setValues] = useState<ExerciseInput>(() => {
    const source = initialValues ?? (exercise ? exerciseToInput(exercise) : createEmptyExerciseInput(defaultCategoryKey));
    return {
      ...source,
      equipment: [...source.equipment],
      similarExerciseIds: [...source.similarExerciseIds],
      groupIds: [...source.groupIds],
      parameters: source.parameters.map((parameter) => ({ ...parameter })),
    };
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videos, setVideos] = useState<Exercise["videos"]>(exercise?.videos ?? []);
  const [videoCount, setVideoCount] = useState(exercise?.videos.length ?? 0);
  const [relationSearch, setRelationSearch] = useState("");
  useDraftDirtyState(values, onDirtyChange);

  const selectedParameterKeys = useMemo(
    () => new Set(values.parameters.map((parameter) => parameter.key)),
    [values.parameters],
  );

  const duplicateCandidates = useMemo(
    () => findExerciseNameCandidates(values.name, catalogExercises, exercise?.id ?? null),
    [catalogExercises, exercise?.id, values.name],
  );
  const exactDuplicate = duplicateCandidates.find((candidate) => candidate.exactNormalized) ?? null;

  const relationOptions = useMemo(() => {
    const search = relationSearch.trim().toLocaleLowerCase("de");
    return catalogExercises
      .filter((candidate) => candidate.id !== exercise?.id)
      .filter((candidate) => !search || [
        candidate.name,
        candidate.categoryTitle,
        candidate.subcategory ?? "",
        candidate.goal ?? "",
      ].some((value) => value.toLocaleLowerCase("de").includes(search)))
      .sort((left, right) => left.name.localeCompare(right.name, "de", { sensitivity: "base" }));
  }, [catalogExercises, exercise?.id, relationSearch]);

  function update<K extends keyof ExerciseInput>(key: K, value: ExerciseInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function toggleGroup(groupId: string) {
    update(
      "groupIds",
      values.groupIds.includes(groupId)
        ? values.groupIds.filter((id) => id !== groupId)
        : [...values.groupIds, groupId],
    );
  }

  function toggleMaterial(material: string) {
    update(
      "equipment",
      values.equipment.includes(material)
        ? values.equipment.filter((item) => item !== material)
        : [...values.equipment, material],
    );
  }

  function toggleSimilarExercise(exerciseId: string) {
    update(
      "similarExerciseIds",
      values.similarExerciseIds.includes(exerciseId)
        ? values.similarExerciseIds.filter((id) => id !== exerciseId)
        : [...values.similarExerciseIds, exerciseId],
    );
  }

  function toggleParameter(key: ExerciseParameterKey) {
    setValues((current) => {
      const exists = current.parameters.some((parameter) => parameter.key === key);
      if (exists) {
        return {
          ...current,
          parameters: current.parameters.filter((parameter) => parameter.key !== key),
        };
      }

      return {
        ...current,
        parameters: [
          ...current.parameters,
          createParameterDefinition(
            parameterOptions.find((option) => option.key === key) ?? {
              key,
              label: key,
              unit: "",
              inputType: "text",
              stepValue: null,
              sortOrder: 100,
              isActive: true,
            },
            current.parameters.length + 1,
          ),
        ],
      };
    });
  }

  function updateParameter(
    key: ExerciseParameterKey,
    patch: Partial<ExerciseParameterDefinition>,
  ) {
    setValues((current) => ({
      ...current,
      parameters: current.parameters.map((parameter) =>
        parameter.key === key ? { ...parameter, ...patch } : parameter,
      ),
    }));
  }

  async function handleSave() {
    if (!canEdit) {
      onCancel();
      return;
    }

    if (!values.name.trim()) {
      setValidationError("Bitte einen Übungsnamen eingeben.");
      setSection("basis");
      return;
    }
    if (exactDuplicate) {
      setValidationError(`Die Übung „${exactDuplicate.exercise.name}“ besitzt praktisch denselben Namen. Bitte diese Übung verwenden oder den Namen der Variante eindeutiger formulieren.`);
      setSection("basis");
      return;
    }
    if (!values.categoryKey) {
      setValidationError("Bitte eine Kategorie auswählen.");
      setSection("basis");
      return;
    }
    if (values.videoUrl.trim() && !/^https?:\/\//i.test(values.videoUrl.trim())) {
      setValidationError("Der Video- oder Weblink muss mit http:// oder https:// beginnen.");
      setSection("anleitung");
      return;
    }
    const invalidParameter = values.parameters.find((parameter) => (
      parameter.minValue !== null
      && parameter.maxValue !== null
      && parameter.minValue > parameter.maxValue
    ));
    if (invalidParameter) {
      setValidationError(`Beim Parameter „${invalidParameter.label}“ darf das Minimum nicht größer als das Maximum sein.`);
      setSection("parameter");
      return;
    }
    const externalValidationError = validateValues?.(values) ?? null;
    if (externalValidationError) {
      setValidationError(externalValidationError);
      return;
    }

    setValidationError(null);
    await onSubmit(values);
  }

  return (
    <div className="exercise-editor-backdrop" role="presentation">
      <section
        className="exercise-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-editor-title"
      >
        <header className="exercise-editor-header">
          <div>
            <p className="eyebrow">{headerEyebrow}</p>
            <h2 id="exercise-editor-title">{headerTitle ?? (exercise ? exercise.name : "Übung anlegen")}</h2>
            {headerMeta}
            {!canEdit && <small>Nur-Lese-Ansicht</small>}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            disabled={busy || videoBusy}
            aria-label="Dialog schließen"
            title="Schließen"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <nav className="exercise-editor-tabs" aria-label="Übungsbereiche">
          <button type="button" className={section === "basis" ? "active" : ""} onClick={() => setSection("basis")}>
            <Dumbbell aria-hidden="true" />Basis
          </button>
          <button type="button" className={section === "anleitung" ? "active" : ""} onClick={() => setSection("anleitung")}>
            <FileText aria-hidden="true" />Anleitung
          </button>
          <button type="button" className={section === "relations" ? "active" : ""} onClick={() => setSection("relations")}>
            <Link2 aria-hidden="true" />Ähnlich<span>{values.similarExerciseIds.length}</span>
          </button>
          <button type="button" className={section === "parameter" ? "active" : ""} onClick={() => setSection("parameter")}>
            <Settings2 aria-hidden="true" />Parameter<span>{values.parameters.length}</span>
          </button>
          {showVideos && (
            <button type="button" className={section === "videos" ? "active" : ""} onClick={() => setSection("videos")}>
              <Video aria-hidden="true" />Videos<span>{videoCount}</span>
            </button>
          )}
        </nav>

        <div className="exercise-editor-form">
          {lockNotice}
          {validationError && <div className="alert error">{validationError}</div>}

          <fieldset disabled={!canEdit || busy || videoBusy}>
            {section === "basis" && (
              <div className="exercise-editor-panel">
                <div className="exercise-form-grid">
                  <label className="exercise-field exercise-field-wide">
                    <span>Name *</span>
                    <input
                      type="text"
                      value={values.name}
                      onChange={(event) => update("name", event.target.value)}
                      maxLength={120}
                      autoFocus={!exercise}
                    />
                  </label>

                  {duplicateCandidates.length > 0 && (
                    <div className={`alert ${exactDuplicate ? "error" : "warning"} exercise-field-wide`} role="alert">
                      <strong>{exactDuplicate ? "Mögliche Dublette" : "Ähnliche Namen gefunden"}</strong>
                      <div>
                        {duplicateCandidates.map((candidate) => (
                          <button
                            type="button"
                            className="text-button"
                            key={candidate.exercise.id}
                            onClick={() => toggleSimilarExercise(candidate.exercise.id)}
                          >
                            {candidate.exercise.name} · {Math.round(candidate.score * 100)} %
                            {values.similarExerciseIds.includes(candidate.exercise.id) ? " · verknüpft" : " · als ähnlich verknüpfen"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="exercise-field">
                    <span>Kategorie *</span>
                    <select value={values.categoryKey} onChange={(event) => update("categoryKey", event.target.value)}>
                      {categories
                        .filter((category) => category.isActive !== false || category.key === values.categoryKey)
                        .map((category) => (
                          <option value={category.key} key={category.key}>
                            {category.title}{category.isActive === false ? " (inaktiv)" : ""}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="exercise-field">
                    <span>Unterkategorie</span>
                    <select value={values.subcategory} onChange={(event) => update("subcategory", event.target.value)}>
                      <option value="">Keine Unterkategorie</option>
                      {subcategories
                        .filter((option) => option.isActive || option.label === values.subcategory)
                        .map((option) => <option value={option.label} key={option.key}>{option.label}</option>)}
                      {values.subcategory && !subcategories.some((option) => option.label === values.subcategory) && (
                        <option value={values.subcategory}>{values.subcategory} (bestehend)</option>
                      )}
                    </select>
                  </label>

                  <label className="exercise-field">
                    <span>Schwierigkeitsgrad</span>
                    <select value={values.difficultyKey} onChange={(event) => update("difficultyKey", event.target.value)}>
                      <option value="">Nicht festgelegt</option>
                      {difficulties
                        .filter((difficulty) => difficulty.isActive || difficulty.key === values.difficultyKey)
                        .map((difficulty) => (
                          <option value={difficulty.key} key={difficulty.key}>
                            {difficulty.label}{difficulty.isActive ? "" : " (inaktiv)"}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="exercise-field exercise-field-wide">
                    <span>Trainingsziel</span>
                    <input
                      type="text"
                      value={values.goal}
                      onChange={(event) => update("goal", event.target.value)}
                      placeholder="z. B. maximale horizontale Beschleunigung"
                      maxLength={240}
                    />
                  </label>

                  <div className="exercise-field exercise-field-wide">
                    <span>Material (Mehrfachauswahl)</span>
                    <details className="exercise-multi-select">
                      <summary>{values.equipment.length > 0 ? values.equipment.join(", ") : "Material auswählen"}</summary>
                      <div className="exercise-multi-select-options">
                        {materials
                          .filter((option) => option.isActive || values.equipment.includes(option.label))
                          .map((option) => (
                            <label key={option.key}>
                              <input type="checkbox" checked={values.equipment.includes(option.label)} onChange={() => toggleMaterial(option.label)} />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        {values.equipment
                          .filter((material) => !materials.some((option) => option.label === material))
                          .map((material) => (
                            <label key={material}>
                              <input type="checkbox" checked onChange={() => toggleMaterial(material)} />
                              <span>{material} (bestehend)</span>
                            </label>
                          ))}
                      </div>
                    </details>
                  </div>
                </div>

                <fieldset className="exercise-group-selection">
                  <legend>Geeignete Trainingsgruppen</legend>
                  <p>Keine Auswahl bedeutet: für alle Gruppen geeignet.</p>
                  <div>
                    {groups.map((group) => (
                      <label key={group.id}>
                        <input type="checkbox" checked={values.groupIds.includes(group.id)} onChange={() => toggleGroup(group.id)} />
                        <span>{group.shortName || group.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="exercise-active-toggle">
                  <input type="checkbox" checked={values.isActive} onChange={(event) => update("isActive", event.target.checked)} />
                  <span>
                    <strong>Übung aktiv</strong>
                    <small>Inaktive Übungen erscheinen im Archiv und bleiben in historischen Plänen erhalten.</small>
                  </span>
                </label>
              </div>
            )}

            {section === "anleitung" && (
              <div className="exercise-editor-panel">
                <label className="exercise-field"><span>Durchführung</span><textarea value={values.description} onChange={(event) => update("description", event.target.value)} rows={5} placeholder="Kurze, klare Beschreibung der Durchführung" /></label>
                <label className="exercise-field"><span>Trainerhinweise</span><textarea value={values.coachingCues} onChange={(event) => update("coachingCues", event.target.value)} rows={4} placeholder="Worauf soll besonders geachtet werden?" /></label>
                <label className="exercise-field"><span>Typische Fehler</span><textarea value={values.commonMistakes} onChange={(event) => update("commonMistakes", event.target.value)} rows={4} placeholder="Häufige Fehler und mögliche Korrekturen" /></label>
                <label className="exercise-field"><span>Video- oder Weblink</span><input type="url" inputMode="url" value={values.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} placeholder="https://…" /></label>
              </div>
            )}

            {section === "relations" && (
              <div className="exercise-editor-panel">
                <div className="parameter-picker-heading">
                  <div>
                    <h3>Ähnliche Übungen</h3>
                    <p>Verknüpfe Varianten und methodisch verwandte Übungen. Die Verbindung gilt in beide Richtungen.</p>
                  </div>
                </div>
                <label className="exercise-field">
                  <span>Übung suchen</span>
                  <input type="search" value={relationSearch} onChange={(event) => setRelationSearch(event.target.value)} placeholder="Name, Kategorie oder Ziel" />
                </label>
                <div className="exercise-multi-select-options">
                  {relationOptions.map((candidate) => (
                    <label key={candidate.id}>
                      <input type="checkbox" checked={values.similarExerciseIds.includes(candidate.id)} onChange={() => toggleSimilarExercise(candidate.id)} />
                      <span>{candidate.name} · {candidate.categoryTitle}{candidate.isActive ? "" : " · archiviert"}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {showVideos && section === "videos" && (
              <div className="exercise-editor-panel exercise-video-editor-panel">
                <ExerciseVideoPanel
                  organizationId={organizationId}
                  exerciseId={exercise?.id ?? null}
                  initialVideos={videos}
                  canEdit={canEdit && videoEditEnabled}
                  disabled={busy}
                  onBusyChange={setVideoBusy}
                  onVideosChanged={(nextVideos) => {
                    setVideos(nextVideos);
                    onVideosChanged?.(nextVideos);
                  }}
                  onVideoCountChange={setVideoCount}
                />
              </div>
            )}

            {section === "parameter" && (
              <div className="exercise-editor-panel">
                <div className="parameter-picker-heading"><div><h3>Planungsparameter</h3><p>Nur ausgewählte Parameter erscheinen später in der Trainingsplanung.</p></div></div>
                <div className="parameter-picker">
                  {parameterOptions.filter((option) => option.isActive || selectedParameterKeys.has(option.key)).map((option) => {
                    const selected = selectedParameterKeys.has(option.key);
                    return (
                      <button type="button" className={selected ? "selected" : ""} onClick={() => toggleParameter(option.key)} key={option.key}>
                        {selected && <Check aria-hidden="true" />}{option.label}{option.unit && <small>{option.unit}</small>}
                      </button>
                    );
                  })}
                </div>

                {values.parameters.length === 0 ? (
                  <div className="exercise-parameter-empty"><ListChecks aria-hidden="true" /><p>Diese Übung besitzt noch keine Planungsparameter.</p></div>
                ) : (
                  <div className="exercise-parameter-list">
                    {[...values.parameters].sort((left, right) => left.sortOrder - right.sortOrder).map((parameter) => (
                      <article className="exercise-parameter-card" key={parameter.key}>
                        <header>
                          <div><strong>{parameter.label}</strong><small>{parameter.unit || parameter.inputType}</small></div>
                          <button type="button" className="text-button danger-text" onClick={() => toggleParameter(parameter.key)}>Entfernen</button>
                        </header>
                        <div className="parameter-detail-grid">
                          <label className="exercise-field"><span>Standardwert</span><input type={parameter.inputType === "number" ? "number" : "text"} inputMode={parameter.inputType === "number" ? "decimal" : undefined} step={parameter.stepValue ?? undefined} value={parameter.defaultValue} onChange={(event) => updateParameter(parameter.key, { defaultValue: event.target.value })} /></label>
                          {parameter.inputType === "number" && (
                            <>
                              <label className="exercise-field"><span>Minimum</span><input type="number" inputMode="decimal" step="any" value={numberInputValue(parameter.minValue)} onChange={(event) => updateParameter(parameter.key, { minValue: nullableNumber(event.target.value) })} /></label>
                              <label className="exercise-field"><span>Maximum</span><input type="number" inputMode="decimal" step="any" value={numberInputValue(parameter.maxValue)} onChange={(event) => updateParameter(parameter.key, { maxValue: nullableNumber(event.target.value) })} /></label>
                              <label className="exercise-field"><span>Schrittweite</span><input type="number" inputMode="decimal" step="any" value={numberInputValue(parameter.stepValue)} onChange={(event) => updateParameter(parameter.key, { stepValue: nullableNumber(event.target.value) })} /></label>
                            </>
                          )}
                        </div>
                        <label className="exercise-parameter-required">
                          <input type="checkbox" checked={parameter.isRequired} onChange={(event) => updateParameter(parameter.key, { isRequired: event.target.checked })} />
                          Bei der Trainingsplanung als Pflichtfeld behandeln
                        </label>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <footer className="exercise-editor-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={busy || videoBusy}>{cancelLabel ?? (canEdit ? "Abbrechen" : "Schließen")}</button>
            {footerExtra}
            {canEdit && (
              <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={busy || videoBusy || Boolean(exactDuplicate)}>
                <Save aria-hidden="true" />{busy ? "Wird verarbeitet …" : submitLabel}
              </button>
            )}
          </footer>
        </div>
      </section>
    </div>
  );
}
