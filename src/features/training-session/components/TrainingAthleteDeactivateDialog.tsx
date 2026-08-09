import { UserMinus, X } from "lucide-react";
import { athleteDisplayName } from "@/features/training-session/core";
import type {
  AthleteNameSort,
  TrainingParticipant,
} from "@/features/training-session/types";

type TrainingAthleteDeactivateDialogProps = {
  participant: TrainingParticipant;
  sortMode: AthleteNameSort;
  confirmed: boolean;
  deactivating: boolean;
  onClose: () => void;
  onConfirmedChange: (confirmed: boolean) => void;
  onDeactivate: () => void;
};

export function TrainingAthleteDeactivateDialog({
  participant,
  sortMode,
  confirmed,
  deactivating,
  onClose,
  onConfirmedChange,
  onDeactivate,
}: TrainingAthleteDeactivateDialogProps) {
  return (
    <div
      className="contact-dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!deactivating) onClose();
      }}
    >
      <section
        className="contact-dialog athlete-deactivate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="athlete-deactivate-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="contact-dialog-heading">
          <div>
            <p className="eyebrow">Athlet verwalten</p>
            <h2 id="athlete-deactivate-title">
              {athleteDisplayName(participant, sortMode)}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={deactivating}
            aria-label="Dialog schließen"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="alert warning compact-alert">
          Das Kind wird ab sofort inaktiv und aus allen aktiven Gruppen entfernt.
          Vergangene Trainings und Statistiken bleiben erhalten.
        </div>

        <label className="deactivation-confirmation">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
            disabled={deactivating}
          />
          <span>
            <strong>Wirklich inaktiv setzen</strong>
            <small>Diese zusätzliche Bestätigung verhindert versehentliche Änderungen.</small>
          </span>
        </label>

        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={deactivating}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={onDeactivate}
            disabled={!confirmed || deactivating}
          >
            <UserMinus aria-hidden="true" />
            {deactivating ? "Wird deaktiviert …" : "Athlet inaktiv setzen"}
          </button>
        </div>
      </section>
    </div>
  );
}
