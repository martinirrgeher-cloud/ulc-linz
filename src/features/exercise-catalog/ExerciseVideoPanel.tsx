import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import {
  CheckCircle2,
  Film,
  PauseCircle,
  Play,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteExerciseVideo,
  loadExerciseVideosForExercise,
  setPrimaryExerciseVideo,
  uploadExerciseVideo,
} from "@/features/exercise-catalog/api";
import {
  EXERCISE_VIDEO_MAX_BYTES,
  validateExerciseVideoFile,
  type ExerciseVideoUploadProgress,
} from "@/features/exercise-catalog/video-upload";
import type { ExerciseVideo } from "@/features/exercise-catalog/types";
import { isResumableUploadPausedError } from "@/lib/resumable-upload";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
type ExerciseVideoPanelProps = {
  organizationId: string;
  exerciseId: string | null;
  initialVideos: ExerciseVideo[];
  canEdit: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onVideosChanged: (videos: ExerciseVideo[]) => void;
  onVideoCountChange: (count: number) => void;
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Das Video konnte nicht verarbeitet werden.", "exercise_video");
}

function defaultTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120);
}

export function ExerciseVideoPanel({
  organizationId,
  exerciseId,
  initialVideos,
  canEdit,
  disabled,
  onBusyChange,
  onVideosChanged,
  onVideoCountChange,
}: ExerciseVideoPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState(initialVideos);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<ExerciseVideoUploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    uploadAbortRef.current?.abort();
  }, []);

  async function refreshVideos() {
    if (!exerciseId) return;
    const nextVideos = await loadExerciseVideosForExercise(organizationId, exerciseId);
    setVideos(nextVideos);
    onVideoCountChange(nextVideos.length);
    onVideosChanged(nextVideos);
  }

  function setOperationBusy(nextBusy: boolean) {
    setBusy(nextBusy);
    onBusyChange(nextBusy);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setSuccess(null);
    setProgress(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    try {
      validateExerciseVideoFile(file);
      setSelectedFile(file);
      setTitle(defaultTitle(file.name));
    } catch (selectionError) {
      setSelectedFile(null);
      event.target.value = "";
      setError(errorMessage(selectionError));
    }
  }

  async function handleUpload(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!exerciseId || !selectedFile || busy) return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setOperationBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await uploadExerciseVideo(
        organizationId,
        exerciseId,
        selectedFile,
        title.trim() || defaultTitle(selectedFile.name),
        setProgress,
        controller.signal,
      );
      setSelectedFile(null);
      setTitle("");
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
      await refreshVideos();
      setSuccess("Das Video wurde hochgeladen.");
    } catch (uploadError) {
      if (isResumableUploadPausedError(uploadError, controller.signal)) {
        setSuccess("Der Upload ist pausiert. Mit „Fortsetzen“ wird an derselben Stelle weitergemacht.");
      } else {
        setError(errorMessage(uploadError));
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setOperationBusy(false);
    }
  }

  function handlePauseUpload(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    uploadAbortRef.current?.abort();
  }

  async function handlePrimary(video: ExerciseVideo) {
    if (!exerciseId || busy || video.isPrimary) return;
    setOperationBusy(true);
    setError(null);
    try {
      await setPrimaryExerciseVideo(organizationId, exerciseId, video.id);
      await refreshVideos();
    } catch (primaryError) {
      setError(errorMessage(primaryError));
    } finally {
      setOperationBusy(false);
    }
  }

  async function handleDelete(video: ExerciseVideo) {
    if (!exerciseId || busy) return;
    const confirmed = window.confirm(`Video „${video.title}“ wirklich löschen?`);
    if (!confirmed) return;

    setOperationBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteExerciseVideo(organizationId, exerciseId, video);
      await refreshVideos();
      setSuccess("Das Video wurde gelöscht.");
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setOperationBusy(false);
    }
  }

  if (!exerciseId) {
    return (
      <div className="exercise-video-empty">
        <Film aria-hidden="true" />
        <h3>Übung zuerst speichern</h3>
        <p>Danach kannst du Videos direkt aus der Handy-Galerie hinzufügen.</p>
      </div>
    );
  }

  return (
    <div className="exercise-video-panel">
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {canEdit && (
        <section className="exercise-video-upload-card">
          <div className="exercise-video-upload-heading">
            <div>
              <h3>Video aus der Galerie</h3>
              <p>Maximal 50 MB. Größere Handyvideos bitte vorher kürzen.</p>
            </div>
            <span>{Math.round(EXERCISE_VIDEO_MAX_BYTES / (1024 * 1024))} MB</span>
          </div>

          <input
            ref={inputRef}
            className="exercise-video-file-input"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={disabled || busy}
          />

          <button
            type="button"
            className="secondary-button exercise-video-select-button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            <Film aria-hidden="true" />
            {selectedFile ? "Anderes Video wählen" : "Video auswählen"}
          </button>

          {selectedFile && (
            <div className="exercise-video-selected">
              <div>
                <strong>{selectedFile.name}</strong>
                <small>{formatBytes(selectedFile.size)}</small>
              </div>
              <label className="exercise-field">
                <span>Bezeichnung</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  disabled={disabled || busy}
                />
              </label>
              {progress && (
                <div className="exercise-video-progress" aria-live="polite">
                  <div>
                    <span style={{ width: `${progress.percent}%` }} />
                  </div>
                  <small>{progress.percent} % · {formatBytes(progress.uploadedBytes)} von {formatBytes(progress.totalBytes)}</small>
                </div>
              )}
              {busy ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handlePauseUpload}
                  disabled={disabled}
                >
                  <PauseCircle aria-hidden="true" />
                  Upload pausieren
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={(event) => void handleUpload(event)}
                  disabled={disabled}
                >
                  <Upload aria-hidden="true" />
                  {progress && progress.uploadedBytes > 0 ? "Fortsetzen" : "Hochladen"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="exercise-video-list-section">
        <div className="exercise-video-list-heading">
          <h3>Gespeicherte Videos</h3>
          <span>{videos.length}</span>
        </div>

        {videos.length === 0 ? (
          <div className="exercise-video-empty compact">
            <Film aria-hidden="true" />
            <p>Noch kein Video hinterlegt.</p>
          </div>
        ) : (
          <div className="exercise-video-list">
            {videos.map((video) => (
              <article className="exercise-video-card" key={video.id}>
                <div className="exercise-video-card-main">
                  <Film aria-hidden="true" />
                  <div>
                    <strong>{video.title}</strong>
                    <small>{formatBytes(video.fileSize)} · {video.mimeType}</small>
                    {video.isPrimary && (
                      <span className="exercise-video-primary-label">
                        <CheckCircle2 aria-hidden="true" /> Hauptvideo
                      </span>
                    )}
                  </div>
                </div>
                <div className="exercise-video-card-actions">
                  {video.signedUrl && (
                    <a
                      className="icon-button"
                      href={video.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${video.title} abspielen`}
                      title="Abspielen"
                    >
                      <Play aria-hidden="true" />
                    </a>
                  )}
                  {canEdit && !video.isPrimary && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void handlePrimary(video)}
                      disabled={disabled || busy}
                      aria-label={`${video.title} als Hauptvideo festlegen`}
                      title="Als Hauptvideo"
                    >
                      <Star aria-hidden="true" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="icon-button danger-icon-button"
                      onClick={() => void handleDelete(video)}
                      disabled={disabled || busy}
                      aria-label={`${video.title} löschen`}
                      title="Löschen"
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
