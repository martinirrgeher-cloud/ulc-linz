import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Clock3,
  Film,
  Flag,
  Info,
  ListChecks,
  MessageSquareText,
  MinusCircle,
  PauseCircle,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteTrainingDocumentationMedia,
  registerTrainingDocumentationMedia,
  removeTrainingDocumentationStorageObject,
} from "@/features/training-documentation/api";
import {
  documentationVideoMimeType,
  uploadTrainingDocumentationVideo,
  validateDocumentationVideoFile,
} from "@/features/training-documentation/media-upload";
import { isResumableUploadPausedError } from "@/lib/resumable-upload";
import {
  createDocumentationClientId,
  type DocumentationItemInput,
  type DocumentationSetInput,
  type ExerciseDocumentationStatus,
  type PainLevel,
  type SaveState,
  type TrainingDocumentationInput,
  type TrainingSessionStatus,
} from "@/features/training-documentation/types";

import { diagnosticErrorMessage, reportTechnicalError } from "@/lib/diagnostics";
const EXERCISE_STATUS_OPTIONS: Array<{
  value: Exclude<ExerciseDocumentationStatus, "planned">;
  label: string;
  shortLabel: string;
  icon: typeof Check;
}> = [
  { value: "as_planned", label: "Wie geplant", shortLabel: "Plan", icon: Check },
  { value: "changed", label: "Geändert", shortLabel: "Geändert", icon: Flag },
  { value: "partial", label: "Teilweise", shortLabel: "Teil", icon: PauseCircle },
  { value: "skipped", label: "Nicht gemacht", shortLabel: "Ausgelassen", icon: MinusCircle },
  { value: "aborted", label: "Abgebrochen", shortLabel: "Abbruch", icon: Ban },
];

const PAIN_OPTIONS: Array<{ value: PainLevel; label: string }> = [
  { value: "none", label: "Keine" },
  { value: "mild", label: "Leicht" },
  { value: "strong", label: "Stark" },
];

const SESSION_STATUS_LABELS: Record<Exclude<TrainingSessionStatus, "not_started">, string> = {
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
  partial: "Teilweise absolviert",
  aborted: "Abgebrochen",
};

function replaceItem(
  value: TrainingDocumentationInput,
  itemId: string,
  updater: (item: DocumentationItemInput) => DocumentationItemInput,
): TrainingDocumentationInput {
  return {
    ...value,
    sections: value.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => item.id === itemId ? updater(item) : item),
    })),
  };
}

function parameterText(item: DocumentationItemInput, actual: boolean): string {
  const values = actual ? item.actualValues : item.plannedValues;
  return item.parameterDefinitions.flatMap((parameter) => {
    const parameterValue = values[parameter.key];
    if (!parameterValue) return [];
    return [`${parameter.label}: ${parameterValue}${parameter.unit ? ` ${parameter.unit}` : ""}`];
  }).join(" · ");
}

function setDefaults(item: DocumentationItemInput): DocumentationSetInput {
  return {
    clientId: createDocumentationClientId("training-set"),
    id: null,
    setNumber: item.sets.length + 1,
    plannedValues: { ...item.plannedValues },
    actualValues: { ...item.actualValues },
    status: item.status === "planned" ? "as_planned" : item.status,
    comment: "",
  };
}

function completionCount(value: TrainingDocumentationInput): { completed: number; total: number } {
  const items = value.sections.flatMap((section) => section.items);
  return {
    total: items.length,
    completed: items.filter((item) => item.status !== "planned").length,
  };
}

function saveLabel(saveState: SaveState): string {
  if (saveState === "saving") return "Wird gespeichert …";
  if (saveState === "saved") return "Gespeichert";
  if (saveState === "local") return "Lokal gespeichert";
  if (saveState === "error") return "Speichern fehlgeschlagen";
  return "Änderungen offen";
}

function elapsedMinutes(startedAt: string): string {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return "";
  const minutes = Math.round((Date.now() - started) / 60_000);
  return String(Math.min(1440, Math.max(1, minutes)));
}

function suggestedCompletionStatus(value: TrainingDocumentationInput): "completed" | "partial" {
  const items = value.sections.flatMap((section) => section.items);
  if (items.length === 0) return "partial";
  return items.every((item) => item.status === "as_planned" || item.status === "changed")
    ? "completed"
    : "partial";
}

function hasExerciseInformation(item: DocumentationItemInput): boolean {
  return Boolean(
    item.exerciseGoal
    || item.exerciseDescription
    || item.exerciseCoachingCues
    || item.exerciseCommonMistakes
    || item.plannedNote
    || (item.exerciseEquipment?.length ?? 0) > 0
    || item.parameterDefinitions.length > 0
    || item.exerciseVideoSignedUrl
    || item.exerciseVideoUrl,
  );
}

type CompletionDialogProps = {
  value: TrainingDocumentationInput;
  onClose: () => void;
  onComplete: (value: TrainingDocumentationInput) => Promise<boolean>;
};

function CompletionDialog({ value, onClose, onComplete }: CompletionDialogProps) {
  const suggestedStatus = suggestedCompletionStatus(value);
  const [next, setNext] = useState<TrainingDocumentationInput>(() => ({
    ...value,
    status: value.status === "in_progress" ? suggestedStatus : value.status,
    actualMinutes: value.actualMinutes || elapsedMinutes(value.startedAt),
  }));
  const [busy, setBusy] = useState(false);

  async function complete() {
    setBusy(true);
    try {
      await onComplete(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="training-doc-modal-backdrop" role="presentation">
      <section className="training-doc-modal" role="dialog" aria-modal="true" aria-labelledby="training-doc-complete-title">
        <header>
          <div>
            <p className="eyebrow">Training beenden</p>
            <h2 id="training-doc-complete-title">Abschluss dokumentieren</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Dialog schließen">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="training-doc-modal-content">
          <label className="ui-labeled-field">
            <span className="ui-field-label">Abschlussstatus</span>
            <select className="ui-field-control"
              value={next.status}
              onChange={(event) => setNext((current) => ({
                ...current,
                status: event.target.value as TrainingDocumentationInput["status"],
              }))}
            >
              <option value="completed">Vollständig abgeschlossen</option>
              <option value="partial">Teilweise absolviert</option>
              <option value="aborted">Training abgebrochen</option>
            </select>
            <small className="training-doc-completion-suggestion">
              Vorschlag aus den Übungsrückmeldungen: {suggestedStatus === "completed" ? "vollständig abgeschlossen" : "teilweise absolviert"}.
            </small>
          </label>
          <label className="ui-labeled-field">
            <span className="ui-field-label">Tatsächliche Dauer (Minuten)</span>
            <input className="ui-field-control"
              type="number"
              min={0}
              max={1440}
              inputMode="numeric"
              value={next.actualMinutes}
              onChange={(event) => setNext((current) => ({ ...current, actualMinutes: event.target.value }))}
              placeholder={String(next.plannedMinutes)}
            />
          </label>
          <label>
            Gesamtbelastung RPE: <strong>{next.overallRpe ?? "–"}</strong>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={next.overallRpe ?? 5}
              onChange={(event) => setNext((current) => ({ ...current, overallRpe: Number(event.target.value) }))}
            />
          </label>
          <div className="training-doc-rating-field">
            <span>Gesamtbewertung</span>
            <div className="training-doc-rating-buttons" aria-label="Gesamtbewertung von 1 bis 5">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  type="button"
                  className={next.overallRating === rating ? "active" : ""}
                  onClick={() => setNext((current) => ({ ...current, overallRating: rating }))}
                  aria-label={`${rating} von 5`}
                  key={rating}
                ><Star aria-hidden="true" />{rating}</button>
              ))}
            </div>
          </div>
          <label className="ui-labeled-field">
            <span className="ui-field-label">Tageskommentar</span>
            <textarea className="ui-field-control"
              rows={3}
              value={next.overallComment}
              onChange={(event) => setNext((current) => ({ ...current, overallComment: event.target.value }))}
              placeholder="Was ist gut gelaufen, was war schwierig?"
            />
          </label>
          <div className="training-doc-pain-field">
            <span>Beschwerden</span>
            <div className="training-doc-segmented ui-segmented">
              {PAIN_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={`${next.painLevel === option.value ? "active" : ""} pain-${option.value}`}
                  onClick={() => setNext((current) => ({ ...current, painLevel: option.value }))}
                  key={option.value}
                >{option.label}</button>
              ))}
            </div>
          </div>
          {next.painLevel !== "none" && (
            <label className="ui-labeled-field">
              <span className="ui-field-label">Beschwerden beschreiben</span>
              <textarea className="ui-field-control"
                rows={2}
                value={next.painComment}
                onChange={(event) => setNext((current) => ({ ...current, painComment: event.target.value }))}
              />
            </label>
          )}
        </div>

        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Abbrechen</button>
          <button type="button" className="primary-button" onClick={() => void complete()} disabled={busy}>
            <CheckCircle2 aria-hidden="true" />{busy ? "Wird abgeschlossen …" : "Training abschließen"}
          </button>
        </footer>
      </section>
    </div>
  );
}

type ExerciseInfoDialogProps = {
  item: DocumentationItemInput;
  onClose: () => void;
};

function ExerciseInfoDialog({ item, onClose }: ExerciseInfoDialogProps) {
  const plannedText = parameterText(item, false);
  const hasInfo = hasExerciseInformation(item);

  return (
    <div className="training-doc-modal-backdrop" role="presentation">
      <section
        className="training-doc-modal training-doc-exercise-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-doc-exercise-info-title"
      >
        <header>
          <div>
            <p className="eyebrow">Übungsinformation</p>
            <h2 id="training-doc-exercise-info-title">{item.exerciseName}</h2>
            <small>{item.categoryTitle || "Ohne Kategorie"}</small>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Übungsinformationen schließen">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="training-doc-modal-content training-doc-exercise-info-content">
          {((item.exerciseEquipment?.length ?? 0) > 0 || item.categoryTitle) && (
            <div className="training-doc-exercise-info-chips">
              {item.categoryTitle && <span>{item.categoryTitle}</span>}
              {(item.exerciseEquipment ?? []).map((equipment) => <span key={equipment}>{equipment}</span>)}
            </div>
          )}

          {item.exerciseGoal && <section><h3>Trainingsziel</h3><p>{item.exerciseGoal}</p></section>}
          {item.exerciseDescription && <section><h3>Beschreibung</h3><p>{item.exerciseDescription}</p></section>}
          {item.exerciseCoachingCues && <section><h3>Hinweise zur Ausführung</h3><p>{item.exerciseCoachingCues}</p></section>}
          {item.exerciseCommonMistakes && <section><h3>Häufige Fehler</h3><p>{item.exerciseCommonMistakes}</p></section>}
          {item.plannedNote && <section><h3>Hinweis im Trainingsplan</h3><p>{item.plannedNote}</p></section>}

          {item.parameterDefinitions.length > 0 && (
            <section>
              <h3>Vorgaben</h3>
              <div className="training-doc-exercise-info-parameters">
                {item.parameterDefinitions.map((parameter) => (
                  <span key={parameter.key}>
                    <strong>{parameter.label}</strong>
                    <small>
                      {item.plannedValues[parameter.key] || parameter.defaultValue || "–"}
                      {parameter.unit ? ` ${parameter.unit}` : ""}
                    </small>
                  </span>
                ))}
              </div>
              {plannedText && <p className="training-doc-exercise-info-summary">Soll: {plannedText}</p>}
            </section>
          )}

          {(item.exerciseVideoSignedUrl || item.exerciseVideoUrl) && (
            <section>
              <h3>Übungsvideo</h3>
              {item.exerciseVideoSignedUrl ? (
                <video controls playsInline preload="metadata" src={item.exerciseVideoSignedUrl} />
              ) : (
                <a href={item.exerciseVideoUrl || "#"} target="_blank" rel="noreferrer">
                  <Film aria-hidden="true" />Externes Übungsvideo öffnen
                </a>
              )}
            </section>
          )}

          {!hasInfo && <p className="training-doc-exercise-info-empty">Für diese Übung sind noch keine weiteren Informationen hinterlegt.</p>}
        </div>
      </section>
    </div>
  );
}

type Props = {
  organizationId: string;
  value: TrainingDocumentationInput;
  saveState: SaveState;
  onChange: (value: TrainingDocumentationInput) => void;
  onSave: () => Promise<void>;
  onComplete: (value: TrainingDocumentationInput) => Promise<boolean>;
  onReload: () => Promise<void>;
};

export function TrainingDocumentationEditor({
  organizationId,
  value,
  saveState,
  onChange,
  onSave,
  onComplete,
  onReload,
}: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const [completionOpen, setCompletionOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<DocumentationItemInput | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [retryableUploads, setRetryableUploads] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingUploadFiles = useRef<Record<string, File | undefined>>({});
  const uploadControllers = useRef<Record<string, AbortController | undefined>>({});
  const progress = useMemo(() => completionCount(value), [value]);

  useEffect(() => {
    if (!value.canEdit) setCompletionOpen(false);
  }, [value.canEdit]);

  useEffect(() => () => {
    Object.values(uploadControllers.current).forEach((controller) => controller?.abort());
  }, []);

  function toggleSet(current: Set<string>, id: string): Set<string> {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function setItemStatus(item: DocumentationItemInput, status: Exclude<ExerciseDocumentationStatus, "planned">) {
    onChange(replaceItem(value, item.id, (current) => ({
      ...current,
      status,
      actualValues: status === "as_planned" ? { ...current.plannedValues } : current.actualValues,
    })));
    setExpandedItems((current) => {
      const next = new Set(current);
      if (status !== "as_planned") next.add(item.id);
      return next;
    });
  }

  function updateSet(itemId: string, setClientId: string, updater: (set: DocumentationSetInput) => DocumentationSetInput) {
    onChange(replaceItem(value, itemId, (item) => ({
      ...item,
      sets: item.sets.map((set) => set.clientId === setClientId ? updater(set) : set),
    })));
  }

  function setUploadRetryable(itemId: string, retryable: boolean) {
    setRetryableUploads((current) => {
      const next = { ...current };
      if (retryable) next[itemId] = true;
      else delete next[itemId];
      return next;
    });
  }

  function pauseVideoUpload(itemId: string) {
    uploadControllers.current[itemId]?.abort();
  }

  async function runVideoUpload(item: DocumentationItemInput, file: File) {
    uploadControllers.current[item.id]?.abort();
    const controller = new AbortController();
    uploadControllers.current[item.id] = controller;
    pendingUploadFiles.current[item.id] = file;
    setUploadRetryable(item.id, false);
    setUploadError(null);
    setUploadProgress((current) => ({ ...current, [item.id]: 0 }));

    let storagePath: string | null = null;
    let mediaRegistered = false;

    try {
      storagePath = await uploadTrainingDocumentationVideo({
        organizationId,
        sessionId: value.sessionId,
        itemId: item.id,
        file,
        signal: controller.signal,
        onProgress: (upload) => setUploadProgress((current) => ({
          ...current,
          [item.id]: upload.percent,
        })),
      });
      await registerTrainingDocumentationMedia(
        organizationId,
        value.sessionId,
        item.id,
        storagePath,
        file.name.replace(/\.[^.]+$/, "") || "Trainingsvideo",
        documentationVideoMimeType(file),
        file.size,
      );
      mediaRegistered = true;
      delete pendingUploadFiles.current[item.id];
      setUploadRetryable(item.id, false);
      await onReload();
    } catch (error) {
      if (isResumableUploadPausedError(error, controller.signal)) {
        setUploadRetryable(item.id, true);
        setUploadError(
          "Der Video-Upload ist pausiert. Mit „Fortsetzen“ wird an derselben Stelle weitergemacht.",
        );
      } else {
        let message = diagnosticErrorMessage(
          error,
          "Das Video konnte nicht hochgeladen werden.",
          "training_documentation.video_upload",
        );

        if (storagePath && !mediaRegistered) {
          try {
            await removeTrainingDocumentationStorageObject(storagePath);
          } catch (cleanupError) {
            const cleanupDiagnostic = reportTechnicalError(
              cleanupError,
              "training_documentation.storage_cleanup",
            );
            message += ` Die unvollständige Storage-Datei konnte nicht automatisch entfernt werden. Fehler-ID: ${cleanupDiagnostic.reference}`;
          }
        }

        setUploadRetryable(item.id, !mediaRegistered);
        setUploadError(message);
      }
    } finally {
      if (uploadControllers.current[item.id] === controller) {
        delete uploadControllers.current[item.id];
      }
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }
  }

  function handleVideoSelected(item: DocumentationItemInput, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      validateDocumentationVideoFile(file);
      pendingUploadFiles.current[item.id] = file;
      void runVideoUpload(item, file);
    } catch (error) {
      setUploadError(
        diagnosticErrorMessage(
          error,
          "Das Video konnte nicht ausgewählt werden.",
          "training_documentation.video_selection",
        ),
      );
    }
  }

  function resumeVideoUpload(item: DocumentationItemInput) {
    const file = pendingUploadFiles.current[item.id];
    if (!file) {
      setUploadRetryable(item.id, false);
      fileInputs.current[item.id]?.click();
      return;
    }
    void runVideoUpload(item, file);
  }

  async function deleteMedia(mediaId: string) {
    if (!window.confirm("Dieses Trainingsvideo wirklich löschen?")) return;
    setUploadError(null);
    try {
      await deleteTrainingDocumentationMedia(organizationId, mediaId);
      await onReload();
    } catch (error) {
      setUploadError(
        diagnosticErrorMessage(
          error,
          "Das Video konnte nicht gelöscht werden.",
          "training_documentation.video_delete",
        ),
      );
    }
  }

  return (
    <section className="training-doc-editor">
      <header className="training-doc-editor-heading">
        <div>
          <p className="eyebrow">Trainingsdokumentation</p>
          <h2>{value.planTitle}</h2>
          <small>{value.athleteName} · {value.groupName} · {new Date(`${value.trainingDate}T12:00:00`).toLocaleDateString("de-AT")}</small>
        </div>
        <div className="training-doc-header-stats">
          <span><ListChecks aria-hidden="true" />{progress.completed}/{progress.total}</span>
          <span><Clock3 aria-hidden="true" />Soll {value.plannedMinutes} min</span>
          <span className={`session-${value.status}`}>{SESSION_STATUS_LABELS[value.status]}</span>
        </div>
      </header>

      <div className="training-doc-save-strip">
        <span className={`save-${saveState}`}><Save aria-hidden="true" />{saveLabel(saveState)}</span>
        {value.editedAfterCompletion && <span><AlertTriangle aria-hidden="true" />Nach Abschluss bearbeitet</span>}
        <button type="button" className="text-button" onClick={() => void onSave()} disabled={!value.canEdit || saveState === "saving"}>Jetzt speichern</button>
      </div>

      {value.planNotes && (
        <details className="training-doc-plan-notes">
          <summary><Info aria-hidden="true" />Hinweise zum Trainingsplan</summary>
          <p>{value.planNotes}</p>
        </details>
      )}
      {uploadError && <div className="alert error">{uploadError}</div>}

      <div className="training-doc-progress" aria-label={`${progress.completed} von ${progress.total} Übungen dokumentiert`}>
        <span style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} />
      </div>

      <div className="training-doc-section-list">
        {value.sections.map((section, sectionIndex) => {
          const sectionExpanded = expandedSections.has(section.id);
          const sectionCompleted = section.items.filter((item) => item.status !== "planned").length;
          return (
            <article className="training-doc-section" key={section.id}>
              <button
                type="button"
                className="training-doc-section-toggle"
                onClick={() => setExpandedSections((current) => toggleSet(current, section.id))}
                aria-expanded={sectionExpanded}
              >
                <span className="training-doc-number">{sectionIndex + 1}</span>
                <span>
                  <strong>{section.name}</strong>
                  <small>{sectionCompleted}/{section.items.length} Übungen{section.estimatedMinutes ? ` · ${section.estimatedMinutes} min` : ""}</small>
                </span>
                {sectionExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>

              {sectionExpanded && (
                <div className="training-doc-item-list">
                  {section.description && <p className="training-doc-section-description">{section.description}</p>}
                  {section.items.map((item, itemIndex) => {
                    const itemExpanded = expandedItems.has(item.id);
                    const statusOption = EXERCISE_STATUS_OPTIONS.find((option) => option.value === item.status);
                    const actualText = parameterText(item, true);
                    const plannedText = parameterText(item, false);
                    const itemUploadPercent = uploadProgress[item.id];
                    const itemUploading = itemUploadPercent !== undefined;
                    const itemRetryable = retryableUploads[item.id] === true;
                    return (
                      <article className={`training-doc-item status-${item.status}`} key={item.id}>
                        <header className="training-doc-item-heading">
                          <button
                            type="button"
                            className="training-doc-item-toggle"
                            onClick={() => setExpandedItems((current) => toggleSet(current, item.id))}
                            aria-expanded={itemExpanded}
                          >
                            <span className="training-doc-number secondary">{itemIndex + 1}</span>
                            <span>
                              <strong>{item.exerciseName}</strong>
                              <small>{statusOption?.label ?? "Noch offen"}{actualText ? ` · ${actualText}` : plannedText ? ` · Soll ${plannedText}` : ""}</small>
                            </span>
                            {itemExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                          </button>
                          <button
                            type="button"
                            className={`icon-button training-doc-item-info-button${(item.exerciseVideoSignedUrl || item.exerciseVideoUrl) ? " has-video" : ""}`}
                            onClick={() => setInfoItem(item)}
                            title="Übungsbeschreibung und Video anzeigen"
                            aria-label={`Informationen zu ${item.exerciseName} anzeigen`}
                          >
                            <Info aria-hidden="true" />
                            {(item.exerciseVideoSignedUrl || item.exerciseVideoUrl) && <Film aria-hidden="true" />}
                          </button>
                        </header>

                        <div className="training-doc-quick-status" aria-label={`Status für ${item.exerciseName}`}>
                          {EXERCISE_STATUS_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            return (
                              <button
                                type="button"
                                className={item.status === option.value ? `active status-${option.value}` : ""}
                                onClick={() => setItemStatus(item, option.value)}
                                disabled={!value.canEdit}
                                title={option.label}
                                key={option.value}
                              ><Icon aria-hidden="true" /><span>{option.shortLabel}</span></button>
                            );
                          })}
                        </div>

                        {itemExpanded && (
                          <div className="training-doc-item-body">
                            {(item.plannedNote || item.exerciseVideoUrl || item.exerciseVideoSignedUrl) && (
                              <div className="training-doc-exercise-info">
                                {item.plannedNote && <p><MessageSquareText aria-hidden="true" />{item.plannedNote}</p>}
                                {(item.exerciseVideoSignedUrl || item.exerciseVideoUrl) && (
                                  <a
                                    href={item.exerciseVideoSignedUrl || item.exerciseVideoUrl || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                  ><Film aria-hidden="true" />Übungsvideo öffnen</a>
                                )}
                              </div>
                            )}

                            {item.parameterDefinitions.length > 0 && (
                              <div className="training-doc-parameter-table">
                                <div className="training-doc-parameter-heading"><span>Parameter</span><span>Soll</span><span>Ist</span></div>
                                {item.parameterDefinitions.map((parameter) => (
                                  <label className="training-doc-parameter-row" key={parameter.key}>
                                    <span>{parameter.label}{parameter.unit ? ` (${parameter.unit})` : ""}</span>
                                    <output>{item.plannedValues[parameter.key] || "–"}</output>
                                    <input
                                      type={parameter.inputType === "number" ? "number" : "text"}
                                      min={parameter.minValue ?? undefined}
                                      max={parameter.maxValue ?? undefined}
                                      step={parameter.stepValue ?? undefined}
                                      value={item.actualValues[parameter.key] ?? ""}
                                      onChange={(event) => onChange(replaceItem(value, item.id, (current) => ({
                                        ...current,
                                        status: current.status === "planned" || current.status === "as_planned" ? "changed" : current.status,
                                        actualValues: { ...current.actualValues, [parameter.key]: event.target.value },
                                      })))}
                                      disabled={!value.canEdit}
                                    />
                                  </label>
                                ))}
                              </div>
                            )}

                            <div className="training-doc-feedback-grid">
                              <div className="training-doc-rating-field">
                                <span>Ausführung</span>
                                <div className="training-doc-rating-buttons">
                                  {[1, 2, 3, 4, 5].map((rating) => (
                                    <button
                                      type="button"
                                      className={item.rating === rating ? "active" : ""}
                                      onClick={() => onChange(replaceItem(value, item.id, (current) => ({ ...current, rating })))}
                                      disabled={!value.canEdit}
                                      aria-label={`${rating} von 5`}
                                      key={rating}
                                    ><Star aria-hidden="true" />{rating}</button>
                                  ))}
                                </div>
                              </div>
                              <label className="training-doc-rpe-field">
                                <span>Belastung RPE <strong>{item.rpe ?? "–"}</strong></span>
                                <input
                                  type="range"
                                  min={1}
                                  max={10}
                                  step={1}
                                  value={item.rpe ?? 5}
                                  onChange={(event) => onChange(replaceItem(value, item.id, (current) => ({ ...current, rpe: Number(event.target.value) })))}
                                  disabled={!value.canEdit}
                                />
                              </label>
                            </div>

                            <label className="training-doc-field ui-labeled-field">
                              <span className="ui-field-label">Kommentar</span>
                              <textarea className="ui-field-control"
                                rows={2}
                                value={item.comment}
                                onChange={(event) => onChange(replaceItem(value, item.id, (current) => ({ ...current, comment: event.target.value })))}
                                disabled={!value.canEdit}
                                placeholder="Abweichungen, Gefühl oder wichtige Beobachtung"
                              />
                            </label>

                            <div className="training-doc-pain-field">
                              <span>Beschwerden</span>
                              <div className="training-doc-segmented ui-segmented">
                                {PAIN_OPTIONS.map((option) => (
                                  <button
                                    type="button"
                                    className={`${item.painLevel === option.value ? "active" : ""} pain-${option.value}`}
                                    onClick={() => onChange(replaceItem(value, item.id, (current) => ({ ...current, painLevel: option.value })))}
                                    disabled={!value.canEdit}
                                    key={option.value}
                                  >{option.label}</button>
                                ))}
                              </div>
                            </div>
                            {item.painLevel !== "none" && (
                              <label className="training-doc-field ui-labeled-field">
                                <span className="ui-field-label">Beschwerden beschreiben</span>
                                <textarea className="ui-field-control"
                                  rows={2}
                                  value={item.painComment}
                                  onChange={(event) => onChange(replaceItem(value, item.id, (current) => ({ ...current, painComment: event.target.value })))}
                                  disabled={!value.canEdit}
                                />
                              </label>
                            )}

                            <section className="training-doc-sets">
                              <header>
                                <div>
                                  <strong>Satzweise Dokumentation</strong>
                                  <small>Optional für Kraft-, Sprint- oder Serienprogramme</small>
                                </div>
                                {value.canEdit && (
                                  <button
                                    type="button"
                                    className="secondary-button compact-button"
                                    onClick={() => onChange(replaceItem(value, item.id, (current) => ({
                                      ...current,
                                      sets: [...current.sets, setDefaults(current)],
                                    })))}
                                  ><Plus aria-hidden="true" />Satz</button>
                                )}
                              </header>
                              {item.sets.map((set, setIndex) => (
                                <article className="training-doc-set" key={set.clientId}>
                                  <header>
                                    <strong>Satz {setIndex + 1}</strong>
                                    <select
                                      value={set.status}
                                      onChange={(event) => updateSet(item.id, set.clientId, (current) => ({
                                        ...current,
                                        status: event.target.value as DocumentationSetInput["status"],
                                      }))}
                                      disabled={!value.canEdit}
                                    >
                                      {EXERCISE_STATUS_OPTIONS.map((option) => (
                                        <option value={option.value} key={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                    {value.canEdit && (
                                      <button
                                        type="button"
                                        className="icon-button icon-button--danger"
                                        onClick={() => onChange(replaceItem(value, item.id, (current) => ({
                                          ...current,
                                          sets: current.sets.filter((entry) => entry.clientId !== set.clientId),
                                        })))}
                                        aria-label={`Satz ${setIndex + 1} löschen`}
                                      ><Trash2 aria-hidden="true" /></button>
                                    )}
                                  </header>
                                  <div className="training-doc-set-values">
                                    {item.parameterDefinitions.map((parameter) => (
                                      <label key={parameter.key}>
                                        <span>{parameter.label}{parameter.unit ? ` (${parameter.unit})` : ""}</span>
                                        <small>Soll {set.plannedValues[parameter.key] || "–"}</small>
                                        <input
                                          type={parameter.inputType === "number" ? "number" : "text"}
                                          min={parameter.minValue ?? undefined}
                                          max={parameter.maxValue ?? undefined}
                                          step={parameter.stepValue ?? undefined}
                                          value={set.actualValues[parameter.key] ?? ""}
                                          onChange={(event) => updateSet(item.id, set.clientId, (current) => ({
                                            ...current,
                                            actualValues: { ...current.actualValues, [parameter.key]: event.target.value },
                                          }))}
                                          disabled={!value.canEdit}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                  <input
                                    className="training-doc-set-comment"
                                    value={set.comment}
                                    onChange={(event) => updateSet(item.id, set.clientId, (current) => ({ ...current, comment: event.target.value }))}
                                    disabled={!value.canEdit}
                                    placeholder="Satz-Kommentar"
                                  />
                                </article>
                              ))}
                            </section>

                            <section className="training-doc-media">
                              <header>
                                <div>
                                  <strong>Video oder Technikaufnahme</strong>
                                  <small>Optional, maximal 50 MB</small>
                                </div>
                                {value.canEdit && (
                                  <>
                                    <input
                                      ref={(element: HTMLInputElement | null) => { fileInputs.current[item.id] = element; }}
                                      type="file"
                                      accept="video/*"
                                      hidden
                                      onChange={(event) => void handleVideoSelected(item, event)}
                                    />
                                    <button
                                      type="button"
                                      className="secondary-button compact-button"
                                      onClick={() => {
                                        if (itemUploading) pauseVideoUpload(item.id);
                                        else if (itemRetryable) resumeVideoUpload(item);
                                        else fileInputs.current[item.id]?.click();
                                      }}
                                    >
                                      {itemUploading ? <PauseCircle aria-hidden="true" /> : <Upload aria-hidden="true" />}
                                      {itemUploading
                                        ? `${itemUploadPercent} % · Pause`
                                        : itemRetryable
                                          ? "Fortsetzen"
                                          : "Video"}
                                    </button>
                                  </>
                                )}
                              </header>
                              {item.media.length > 0 && (
                                <div className="training-doc-media-list">
                                  {item.media.map((medium) => (
                                    <div key={medium.id}>
                                      <a href={medium.signedUrl ?? "#"} target="_blank" rel="noreferrer">
                                        <Film aria-hidden="true" /><span>{medium.title}</span>
                                      </a>
                                      {value.canEdit && (
                                        <button type="button" className="icon-button icon-button--danger" onClick={() => void deleteMedia(medium.id)} aria-label={`${medium.title} löschen`}>
                                          <Trash2 aria-hidden="true" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>

                            {value.canReview ? (
                              <label className="training-doc-field trainer-field ui-labeled-field">
                                <span className="ui-field-label">Trainerrückmeldung zur Übung</span>
                                <textarea className="ui-field-control"
                                  rows={2}
                                  value={item.trainerComment}
                                  onChange={(event) => onChange(replaceItem(value, item.id, (current) => ({ ...current, trainerComment: event.target.value })))}
                                  disabled={!value.canEdit}
                                  placeholder="Technischer Hinweis oder Rückmeldung des Trainers"
                                />
                              </label>
                            ) : item.trainerComment ? (
                              <div className="training-doc-trainer-feedback">
                                <MessageSquareText aria-hidden="true" />
                                <div><strong>Trainerrückmeldung zur Übung</strong><p>{item.trainerComment}</p></div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <section className="training-doc-overall">
        <header><CircleGauge aria-hidden="true" /><div><h3>Trainingsabschluss</h3><small>Gesamtwerte und Rückmeldung</small></div></header>
        <div className="training-doc-overall-grid">
          <label className="ui-labeled-field">
            <span className="ui-field-label">Ist-Dauer (Min.)</span>
            <input className="ui-field-control"
              type="number"
              min={0}
              max={1440}
              inputMode="numeric"
              value={value.actualMinutes}
              onChange={(event) => onChange({ ...value, actualMinutes: event.target.value })}
              disabled={!value.canEdit}
              placeholder={String(value.plannedMinutes)}
            />
          </label>
          <label>
            Gesamt-RPE <strong>{value.overallRpe ?? "–"}</strong>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={value.overallRpe ?? 5}
              onChange={(event) => onChange({ ...value, overallRpe: Number(event.target.value) })}
              disabled={!value.canEdit}
            />
          </label>
        </div>
        <div className="training-doc-rating-field">
          <span>Gesamtbewertung</span>
          <div className="training-doc-rating-buttons" aria-label="Gesamtbewertung von 1 bis 5">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                type="button"
                className={value.overallRating === rating ? "active" : ""}
                onClick={() => onChange({ ...value, overallRating: rating })}
                disabled={!value.canEdit}
                aria-label={`${rating} von 5`}
                key={rating}
              ><Star aria-hidden="true" />{rating}</button>
            ))}
          </div>
        </div>
        <div className="training-doc-pain-field">
          <span>Beschwerden</span>
          <div className="training-doc-segmented ui-segmented">
            {PAIN_OPTIONS.map((option) => (
              <button
                type="button"
                className={`${value.painLevel === option.value ? "active" : ""} pain-${option.value}`}
                onClick={() => onChange({ ...value, painLevel: option.value, painComment: option.value === "none" ? "" : value.painComment })}
                disabled={!value.canEdit}
                key={option.value}
              >{option.label}</button>
            ))}
          </div>
        </div>
        {value.painLevel !== "none" && (
          <label className="training-doc-field ui-labeled-field">
            <span className="ui-field-label">Beschwerden beschreiben</span>
            <textarea className="ui-field-control"
              rows={2}
              value={value.painComment}
              onChange={(event) => onChange({ ...value, painComment: event.target.value })}
              disabled={!value.canEdit}
            />
          </label>
        )}
        <label className="training-doc-field ui-labeled-field">
          <span className="ui-field-label">Tageskommentar</span>
          <textarea className="ui-field-control"
            rows={3}
            value={value.overallComment}
            onChange={(event) => onChange({ ...value, overallComment: event.target.value })}
            disabled={!value.canEdit}
          />
        </label>
        {value.canReview ? (
          <label className="training-doc-field trainer-field ui-labeled-field">
            <span className="ui-field-label">Trainerrückmeldung zum Training</span>
            <textarea className="ui-field-control"
              rows={3}
              value={value.trainerFeedback}
              onChange={(event) => onChange({ ...value, trainerFeedback: event.target.value })}
              disabled={!value.canEdit}
              placeholder="Rückmeldung, nächste Schwerpunkte oder Freigabe"
            />
          </label>
        ) : value.trainerFeedback ? (
          <div className="training-doc-trainer-feedback"><MessageSquareText aria-hidden="true" /><div><strong>Trainerrückmeldung</strong><p>{value.trainerFeedback}</p></div></div>
        ) : null}
      </section>

      <footer className="training-doc-editor-actions">
        <button type="button" className="secondary-button" onClick={() => void onSave()} disabled={!value.canEdit || saveState === "saving"}>
          <Save aria-hidden="true" />Zwischenspeichern
        </button>
        {value.canEdit && (
          <button type="button" className="primary-button" onClick={() => setCompletionOpen(true)}>
            <CheckCircle2 aria-hidden="true" />Training abschließen
          </button>
        )}
      </footer>

      {infoItem && <ExerciseInfoDialog item={infoItem} onClose={() => setInfoItem(null)} />}

      {completionOpen && (
        <CompletionDialog
          value={value}
          onClose={() => setCompletionOpen(false)}
          onComplete={async (next) => {
            const completed = await onComplete(next);
            if (completed) setCompletionOpen(false);
            return completed;
          }}
        />
      )}
    </section>
  );
}
