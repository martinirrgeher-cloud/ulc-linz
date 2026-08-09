import { useEffect, useState } from "react";
import { ExternalLink, Video, X } from "lucide-react";
import type { ExerciseVideo } from "@/features/exercise-catalog/types";
import { loadTrainingBlockExerciseVideos } from "@/features/training-blocks/api";
import type { PlanningExercise, PlanningGroup } from "@/features/training-planning/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/exercise-info-dialog.css";
type TrainingPlanningExerciseInfoDialogProps = {
  organizationId: string;
  exercise: PlanningExercise;
  groups: PlanningGroup[];
  onClose: () => void;
};

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Videos konnten nicht geladen werden.", "training_plan.exercise_info");
}

export function TrainingPlanningExerciseInfoDialog({
  organizationId,
  exercise,
  groups,
  onClose,
}: TrainingPlanningExerciseInfoDialogProps) {
  const [videos, setVideos] = useState<ExerciseVideo[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    setVideos([]);
    setVideoError(null);
    if (!organizationId) return;

    let cancelled = false;
    setVideoLoading(true);
    void loadTrainingBlockExerciseVideos(organizationId, exercise.id)
      .then((loadedVideos) => {
        if (!cancelled) setVideos(loadedVideos);
      })
      .catch((error: unknown) => {
        if (!cancelled) setVideoError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setVideoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exercise.id, organizationId]);

  const hasAdditionalInformation = Boolean(
    exercise.goal
      || exercise.description
      || exercise.coachingCues
      || exercise.commonMistakes
      || exercise.parameters.length > 0
      || videos.length > 0
      || exercise.videoUrl
      || videoLoading
      || videoError
      || exercise.equipment.length > 0,
  );

  return (
    <div className="training-block-exercise-info-backdrop" role="presentation">
      <section
        className="training-block-exercise-info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-planning-exercise-info-title"
      >
        <header>
          <div>
            <p className="eyebrow">Übungsinformation</p>
            <h2 id="training-planning-exercise-info-title">{exercise.name}</h2>
            <small>
              {exercise.categoryTitle}
              {exercise.subcategory ? ` · ${exercise.subcategory}` : ""}
            </small>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Übungsinformationen schließen"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="training-block-exercise-info-body">
          <div className="training-block-exercise-info-chips">
            {exercise.equipment.map((item) => <span key={item}>{item}</span>)}
            {exercise.groupIds.map((groupId) => {
              const group = groups.find((item) => item.id === groupId);
              return group ? <span key={groupId}>{group.shortName || group.name}</span> : null;
            })}
            {exercise.groupIds.length === 0 && <span>Vereinsweit</span>}
          </div>

          {exercise.goal && (
            <section>
              <h3>Trainingsziel</h3>
              <p>{exercise.goal}</p>
            </section>
          )}
          {exercise.description && (
            <section>
              <h3>Beschreibung</h3>
              <p>{exercise.description}</p>
            </section>
          )}
          {exercise.coachingCues && (
            <section>
              <h3>Trainerhinweise</h3>
              <p>{exercise.coachingCues}</p>
            </section>
          )}
          {exercise.commonMistakes && (
            <section>
              <h3>Häufige Fehler</h3>
              <p>{exercise.commonMistakes}</p>
            </section>
          )}

          {exercise.parameters.length > 0 && (
            <section>
              <h3>Planungsparameter</h3>
              <div className="training-block-exercise-info-parameters">
                {exercise.parameters.map((parameter) => (
                  <span key={parameter.key}>
                    <strong>{parameter.label}</strong>
                    <small>
                      {parameter.defaultValue
                        ? `Standard ${parameter.defaultValue}${parameter.unit ? ` ${parameter.unit}` : ""}`
                        : "Kein Standardwert"}
                      {parameter.minValue !== null && parameter.maxValue !== null
                        ? ` · ${parameter.minValue}–${parameter.maxValue}${parameter.unit ? ` ${parameter.unit}` : ""}`
                        : ""}
                    </small>
                  </span>
                ))}
              </div>
            </section>
          )}

          {(videoLoading || videoError || videos.length > 0 || exercise.videoUrl) && (
            <section>
              <h3>Video</h3>
              <div className="training-block-exercise-info-videos">
                {videoLoading && <small>Videos werden geladen …</small>}
                {videoError && <small className="training-block-exercise-info-video-error">{videoError}</small>}
                {videos.map((video) => (
                  <div key={video.id}>
                    <strong><Video aria-hidden="true" />{video.title}</strong>
                    {video.signedUrl ? (
                      <video controls playsInline preload="metadata" src={video.signedUrl} />
                    ) : (
                      <small>Das Video konnte nicht geladen werden.</small>
                    )}
                  </div>
                ))}
                {exercise.videoUrl && (
                  <a href={exercise.videoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" />Externes Video öffnen
                  </a>
                )}
              </div>
            </section>
          )}

          {!hasAdditionalInformation && (
            <p className="training-block-exercise-info-empty">
              Für diese Übung sind noch keine weiteren Informationen hinterlegt.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
