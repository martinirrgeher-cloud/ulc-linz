import { useMemo, useState, type FormEvent } from "react";
import { Save, X } from "lucide-react";
import type {
  Athlete,
  AthleteInput,
  TrainingGroup,
} from "@/features/athletes/types";

export type AthleteEditorMode =
  | { type: "create" }
  | { type: "edit"; athlete: Athlete };

type AthleteEditorProps = {
  mode: AthleteEditorMode;
  groups: TrainingGroup[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: AthleteInput) => Promise<void>;
};

function initialValues(mode: AthleteEditorMode): AthleteInput {
  if (mode.type === "create") {
    return {
      firstName: "",
      lastName: "",
      birthYear: null,
      notes: "",
      isActive: true,
      groupIds: [],
    };
  }

  return {
    firstName: mode.athlete.firstName,
    lastName: mode.athlete.lastName,
    birthYear: mode.athlete.birthYear,
    notes: mode.athlete.notes ?? "",
    isActive: mode.athlete.isActive,
    groupIds: mode.athlete.groups.map((group) => group.id),
  };
}

function parseBirthYear(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function AthleteEditor({
  mode,
  groups,
  busy,
  onCancel,
  onSubmit,
}: AthleteEditorProps) {
  const [values, setValues] = useState<AthleteInput>(() => initialValues(mode));
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  const selectableGroups = useMemo(
    () =>
      groups.filter(
        (group) => group.isActive || values.groupIds.includes(group.id),
      ),
    [groups, values.groupIds],
  );

  const canSave =
    values.firstName.trim().length > 0 &&
    values.lastName.trim().length > 0 &&
    (values.birthYear === null ||
      (values.birthYear >= 1900 && values.birthYear <= currentYear));

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
          : "Der Athlet konnte nicht gespeichert werden.",
      );
    }
  }

  function toggleGroup(groupId: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      groupIds: checked
        ? [...new Set([...current.groupIds, groupId])]
        : current.groupIds.filter((id) => id !== groupId),
    }));
  }

  return (
    <section className="management-editor athlete-editor" aria-labelledby="athlete-editor-title">
      <div className="management-editor-heading">
        <div>
          <p className="eyebrow">Athletenstammdaten</p>
          <h2 id="athlete-editor-title">
            {mode.type === "create" ? "Athlet anlegen" : "Athlet bearbeiten"}
          </h2>
          <p>Stammdaten und aktuelle Gruppenzuordnungen zentral verwalten.</p>
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
              autoComplete="off"
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
              autoComplete="off"
              required
            />
          </label>

          <label>
            Geburtsjahr
            <input
              type="number"
              min={1900}
              max={currentYear}
              inputMode="numeric"
              value={values.birthYear ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  birthYear: parseBirthYear(event.target.value),
                }))
              }
              placeholder="z. B. 2014"
            />
            <small>Das Geburtsjahr genügt für Altersklassen und reduziert sensible Daten.</small>
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
              <small>Inaktive Athleten bleiben für spätere Auswertungen erhalten.</small>
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
            maxLength={3000}
            rows={4}
            placeholder="Optional, nur für berechtigte Vereinsmitglieder"
          />
          <small>{values.notes.length} / 3000 Zeichen</small>
        </label>

        <fieldset className="group-selection">
          <legend>Aktuelle Trainingsgruppen</legend>
          <p className="field-hint">
            Ein Athlet kann mehreren Gruppen gleichzeitig zugeordnet sein. Änderungen werden
            historisch nachvollziehbar gespeichert.
          </p>

          {selectableGroups.length === 0 ? (
            <div className="inline-empty-state">
              Noch keine aktive Trainingsgruppe vorhanden. Lege zuerst eine Gruppe an.
            </div>
          ) : (
            <div className="group-checkbox-grid">
              {selectableGroups.map((group) => (
                <label className="group-checkbox" key={group.id}>
                  <input
                    type="checkbox"
                    checked={values.groupIds.includes(group.id)}
                    onChange={(event) => toggleGroup(group.id, event.target.checked)}
                  />
                  <span>
                    <strong>{group.name}</strong>
                    <small>
                      {[group.shortName, group.isActive ? null : "Inaktiv"]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="management-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
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
