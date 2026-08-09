import { MapPin, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import type {
  TrainingDraft,
  TrainingEnvironment,
  TrainingTrainer,
} from "@/features/training-session/types";

type TrainingDetailsPanelProps = {
  draft: TrainingDraft;
  canEdit: boolean;
  availableTrainers: TrainingTrainer[];
  visibleTrainers: TrainingTrainer[];
  groupTrainerIds: string[];
  showAllTrainers: boolean;
  hiddenTrainerCount: number;
  usesDefaults: boolean;
  hasPersistedSession: boolean;
  noGroupTrainerMessage: string;
  onEnvironmentChange: (value: TrainingEnvironment) => void;
  onToggleShowAllTrainers: () => void;
  onShowAllTrainers: () => void;
  onToggleTrainer: (trainerId: string, checked: boolean) => void;
  onCancelledChange: (cancelled: boolean) => void;
  onNoteChange: (note: string) => void;
};

export function TrainingDetailsPanel({
  draft,
  canEdit,
  availableTrainers,
  visibleTrainers,
  groupTrainerIds,
  showAllTrainers,
  hiddenTrainerCount,
  usesDefaults,
  hasPersistedSession,
  noGroupTrainerMessage,
  onEnvironmentChange,
  onToggleShowAllTrainers,
  onShowAllTrainers,
  onToggleTrainer,
  onCancelledChange,
  onNoteChange,
}: TrainingDetailsPanelProps) {
  return (
    <section className="training-details-panel">
      <div className="training-details-header">Notiz</div>
      <div className="training-details-content">
        <fieldset className="training-environment-field">
          <legend><MapPin aria-hidden="true" /> Trainingsort</legend>
          <div className="segmented-control three-options">
            {([
              [null, "Offen"],
              ["indoor", "Indoor"],
              ["outdoor", "Outdoor"],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                className={draft.environment === value ? "active" : ""}
                onClick={() => onEnvironmentChange(value)}
                disabled={!canEdit}
                key={label}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="training-trainer-field">
          <div className="trainer-field-heading">
            <legend><UsersRound aria-hidden="true" /> Trainer</legend>
            {availableTrainers.length > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={onToggleShowAllTrainers}
              >
                {showAllTrainers ? "Nur Gruppentrainer" : `Alle Trainer anzeigen${hiddenTrainerCount > 0 ? ` (${hiddenTrainerCount})` : ""}`}
              </button>
            )}
          </div>
          {availableTrainers.length === 0 ? (
            <div className="inline-empty-state compact-empty-state">
              Noch keine Trainer angelegt.
              <Link to="/module/athletes?tab=trainers">Trainer verwalten</Link>
            </div>
          ) : visibleTrainers.length === 0 ? (
            <div className="inline-empty-state compact-empty-state">
              {noGroupTrainerMessage}
              <button type="button" className="text-button" onClick={onShowAllTrainers}>Alle Trainer anzeigen</button>
            </div>
          ) : (
            <div className="trainer-checkbox-grid">
              {visibleTrainers.map((trainer) => {
                const isGroupTrainer = groupTrainerIds.includes(trainer.id);
                return (
                  <label className="trainer-checkbox" key={trainer.id}>
                    <input
                      type="checkbox"
                      checked={draft.trainerIds.includes(trainer.id)}
                      onChange={(event) => onToggleTrainer(trainer.id, event.target.checked)}
                      disabled={!canEdit}
                    />
                    <span>
                      <strong>{trainer.firstName} {trainer.lastName}</strong>
                      <small>{!trainer.isActive ? "Inaktiv" : isGroupTrainer ? "Gruppentrainer" : "Aushilfe"}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {usesDefaults && !hasPersistedSession && draft.trainerIds.length > 0 && (
            <small>Gruppentrainer aus dem letzten Training vorgeschlagen.</small>
          )}
        </fieldset>

        <label className="cancel-training-toggle">
          <input
            type="checkbox"
            checked={draft.state === "cancelled"}
            disabled={!canEdit}
            onChange={(event) => onCancelledChange(event.target.checked)}
          />
          <span>
            <strong>Training absagen</strong>
            <small>Die Teilnehmerstände bleiben gespeichert.</small>
          </span>
        </label>

        <label className="training-note-field">
          Tagesnotiz
          <textarea
            value={draft.note}
            disabled={!canEdit}
            onChange={(event) => onNoteChange(event.target.value)}
            maxLength={3000}
            rows={3}
            placeholder="Optional"
          />
          <small>{draft.note.length} / 3000 Zeichen</small>
        </label>
      </div>
    </section>
  );
}
