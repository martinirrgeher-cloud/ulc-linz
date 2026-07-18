import { useState, type FormEvent } from "react";
import { Save, X } from "lucide-react";
import type { Trainer, TrainerInput } from "@/features/athletes/types";

export type TrainerEditorMode =
  | { type: "create" }
  | { type: "edit"; trainer: Trainer };

type TrainerEditorProps = {
  mode: TrainerEditorMode;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: TrainerInput) => Promise<void>;
};

function initialValues(mode: TrainerEditorMode): TrainerInput {
  if (mode.type === "create") {
    return {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      notes: "",
      isActive: true,
    };
  }

  return {
    firstName: mode.trainer.firstName,
    lastName: mode.trainer.lastName,
    phone: mode.trainer.phone ?? "",
    email: mode.trainer.email ?? "",
    notes: mode.trainer.notes ?? "",
    isActive: mode.trainer.isActive,
  };
}

export function TrainerEditor({ mode, busy, onCancel, onSubmit }: TrainerEditorProps) {
  const [values, setValues] = useState<TrainerInput>(() => initialValues(mode));
  const [error, setError] = useState<string | null>(null);

  const canSave = values.firstName.trim().length > 0 && values.lastName.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || busy) return;

    setError(null);
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Der Trainer konnte nicht gespeichert werden.",
      );
    }
  }

  return (
    <section className="management-editor trainer-editor" aria-labelledby="trainer-editor-title">
      <div className="management-editor-heading">
        <div>
          <p className="eyebrow">Trainerstammdaten</p>
          <h2 id="trainer-editor-title">
            {mode.type === "create" ? "Trainer anlegen" : "Trainer bearbeiten"}
          </h2>
          <p>Trainer werden unabhängig von einem App-Login verwaltet.</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Bearbeitung schließen"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <form className="management-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Vorname
            <input
              type="text"
              value={values.firstName}
              onChange={(event) =>
                setValues((current) => ({ ...current, firstName: event.target.value }))
              }
              maxLength={80}
              required
            />
          </label>
          <label>
            Nachname
            <input
              type="text"
              value={values.lastName}
              onChange={(event) =>
                setValues((current) => ({ ...current, lastName: event.target.value }))
              }
              maxLength={80}
              required
            />
          </label>
          <label>
            Telefonnummer
            <input
              type="tel"
              value={values.phone}
              onChange={(event) =>
                setValues((current) => ({ ...current, phone: event.target.value }))
              }
              maxLength={40}
              autoComplete="tel"
              placeholder="Optional"
            />
          </label>
          <label>
            E-Mail-Adresse
            <input
              type="email"
              value={values.email}
              onChange={(event) =>
                setValues((current) => ({ ...current, email: event.target.value }))
              }
              maxLength={254}
              autoComplete="email"
              placeholder="Optional"
            />
          </label>
          {mode.type === "edit" && (
            <label>
              Status
              <select
                value={values.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    isActive: event.target.value === "active",
                  }))
                }
              >
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </label>
          )}
        </div>

        <label className="full-width-field">
          Interne Notiz
          <textarea
            value={values.notes}
            onChange={(event) =>
              setValues((current) => ({ ...current, notes: event.target.value }))
            }
            maxLength={2000}
            rows={3}
            placeholder="Optional"
          />
        </label>

        <div className="management-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button" disabled={!canSave || busy}>
            <Save aria-hidden="true" />
            {busy ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}
