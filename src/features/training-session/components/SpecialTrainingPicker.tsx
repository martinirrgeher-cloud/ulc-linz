import { Save, X } from "lucide-react";

type SpecialTrainingPickerProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function SpecialTrainingPicker({
  value,
  onChange,
  onSave,
  onCancel,
}: SpecialTrainingPickerProps) {
  return (
    <section className="special-training-picker" role="dialog" aria-modal="true">
      <strong>Sondertraining auswählen</strong>
      <div className="special-training-picker-row">
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-button special-training-save"
          onClick={onSave}
          aria-label="Sondertraining speichern"
          title="Sondertraining speichern"
        >
          <Save aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button special-training-cancel"
          onClick={onCancel}
          aria-label="Sondertraining abbrechen"
          title="Sondertraining abbrechen"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
