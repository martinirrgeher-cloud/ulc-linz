import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";

type TrainingDateControlsProps = {
  selectedDateLabel: string;
  selectedDateIsRegular: boolean;
  sessionLoading: boolean;
  allowSpecialTraining: boolean;
  canEdit: boolean;
  canDeleteSpecialTraining: boolean;
  deletingSpecial: boolean;
  showTodayShortcut: boolean;
  onMoveDate: (direction: -1 | 1) => void;
  onOpenSpecialTraining: () => void;
  onDeleteSpecialTraining: () => void;
  onGoToToday: () => void;
};

export function TrainingDateControls({
  selectedDateLabel,
  selectedDateIsRegular,
  sessionLoading,
  allowSpecialTraining,
  canEdit,
  canDeleteSpecialTraining,
  deletingSpecial,
  showTodayShortcut,
  onMoveDate,
  onOpenSpecialTraining,
  onDeleteSpecialTraining,
  onGoToToday,
}: TrainingDateControlsProps) {
  return (
    <section className="training-control-card compact" aria-label="Trainingstag auswählen">
      <div className="training-date-control compact">
        <div className="training-date-buttons">
          <button
            type="button"
            className="icon-button"
            disabled={sessionLoading}
            onClick={() => onMoveDate(-1)}
            aria-label="Vorheriger Trainingstag"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <div className="training-date-display">
            <strong>{selectedDateLabel}</strong>
            {!selectedDateIsRegular && <span>Sondertraining</span>}
          </div>
          <button
            type="button"
            className="icon-button"
            disabled={sessionLoading}
            onClick={() => onMoveDate(1)}
            aria-label="Nächster Trainingstag"
          >
            <ChevronRight aria-hidden="true" />
          </button>
          {allowSpecialTraining && canEdit && (
            <button
              type="button"
              className="icon-button special-training-action"
              disabled={sessionLoading}
              onClick={onOpenSpecialTraining}
              aria-label="Sondertraining anlegen"
              title="Sondertraining anlegen"
            >
              <CalendarPlus aria-hidden="true" />
            </button>
          )}
          {canDeleteSpecialTraining && canEdit && (
            <button
              type="button"
              className="icon-button icon-button--danger special-training-action"
              disabled={sessionLoading || deletingSpecial}
              onClick={onDeleteSpecialTraining}
              aria-label="Sondertraining löschen"
              title="Sondertraining löschen"
            >
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>

        {showTodayShortcut && (
          <div className="training-date-shortcuts">
            <button
              type="button"
              className="text-button"
              disabled={sessionLoading}
              onClick={onGoToToday}
            >
              Heute
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
