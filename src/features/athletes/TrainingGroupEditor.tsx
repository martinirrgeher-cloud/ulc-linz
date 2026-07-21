import { useState, type FormEvent } from "react";
import { CalendarClock, CalendarDays, Save, X } from "lucide-react";
import type {
  TrainingGroup,
  TrainingGroupInput,
} from "@/features/athletes/types";

export type TrainingGroupEditorMode =
  | { type: "create" }
  | { type: "edit"; group: TrainingGroup };

type TrainingGroupEditorProps = {
  mode: TrainingGroupEditorMode;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: TrainingGroupInput) => Promise<void>;
};

const WEEKDAYS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 7, label: "So" },
] as const;

function initialValues(mode: TrainingGroupEditorMode): TrainingGroupInput {
  if (mode.type === "create") {
    return {
      name: "",
      shortName: "",
      description: "",
      isActive: true,
      sortOrder: 100,
      moduleKey: null,
      regularWeekdays: [],
      allowSpecialTraining: true,
      isPerformanceGroup: false,
      registrationDeadlineWeekday: 7,
      registrationDeadlineTime: "18:00",
      performanceWeeksAhead: 4,
      allowLateRegistration: true,
    };
  }

  return {
    name: mode.group.name,
    shortName: mode.group.shortName ?? "",
    description: mode.group.description ?? "",
    isActive: mode.group.isActive,
    sortOrder: mode.group.sortOrder,
    moduleKey: mode.group.moduleKey,
    regularWeekdays: mode.group.regularWeekdays,
    allowSpecialTraining: mode.group.allowSpecialTraining,
    isPerformanceGroup: mode.group.isPerformanceGroup,
    registrationDeadlineWeekday: mode.group.registrationDeadlineWeekday,
    registrationDeadlineTime: mode.group.registrationDeadlineTime,
    performanceWeeksAhead: mode.group.performanceWeeksAhead,
    allowLateRegistration: mode.group.allowLateRegistration,
  };
}

export function TrainingGroupEditor({
  mode,
  busy,
  onCancel,
  onSubmit,
}: TrainingGroupEditorProps) {
  const [values, setValues] = useState<TrainingGroupInput>(() => initialValues(mode));
  const [error, setError] = useState<string | null>(null);
  const canSave =
    values.name.trim().length >= 2 &&
    values.sortOrder >= 0 &&
    ((values.moduleKey === null && !values.isPerformanceGroup) || values.regularWeekdays.length > 0);

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
          : "Die Trainingsgruppe konnte nicht gespeichert werden.",
      );
    }
  }

  function toggleWeekday(weekday: number): void {
    setValues((current) => ({
      ...current,
      regularWeekdays: current.regularWeekdays.includes(weekday)
        ? current.regularWeekdays.filter((item) => item !== weekday)
        : [...current.regularWeekdays, weekday].sort((left, right) => left - right),
    }));
  }

  return (
    <section className="management-editor" aria-labelledby="group-editor-title">
      <div className="management-editor-heading">
        <div>
          <p className="eyebrow">Trainingsgruppen</p>
          <h2 id="group-editor-title">
            {mode.type === "create" ? "Gruppe anlegen" : "Gruppe bearbeiten"}
          </h2>
          <p>Gruppenzuordnung und regelmäßige Trainingstage zentral verwalten.</p>
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
            Gruppenname
            <input
              type="text"
              value={values.name}
              onChange={(event) =>
                setValues((current) => ({ ...current, name: event.target.value }))
              }
              maxLength={100}
              placeholder="z. B. Kindertraining"
              required
            />
          </label>

          <label>
            Kurzbezeichnung
            <input
              type="text"
              value={values.shortName}
              onChange={(event) =>
                setValues((current) => ({ ...current, shortName: event.target.value }))
              }
              maxLength={20}
              placeholder="z. B. KT"
            />
          </label>

          <label>
            Reihenfolge
            <input
              type="number"
              min={0}
              max={10000}
              value={values.sortOrder}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value) || 0,
                }))
              }
            />
            <small>Kleinere Zahlen werden zuerst angezeigt.</small>
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
              <small>Deaktivieren erhält bestehende Zuordnungen und Historie.</small>
            </label>
          )}
        </div>

        <fieldset className="group-schedule-fieldset">
          <legend>
            <CalendarDays aria-hidden="true" /> Regelmäßige Trainingstage
          </legend>
          <p className="field-hint">
            Diese Wochentage steuern später die auswählbaren Trainingstermine.
          </p>
          <div className="weekday-selector" aria-label="Trainingstage auswählen">
            {WEEKDAYS.map((weekday) => {
              const selected = values.regularWeekdays.includes(weekday.value);
              return (
                <button
                  type="button"
                  className={selected ? "selected" : ""}
                  aria-pressed={selected}
                  onClick={() => toggleWeekday(weekday.value)}
                  key={weekday.value}
                >
                  {weekday.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="group-module-settings">
          <label>
            Trainingsmodul
            <select
              value={values.moduleKey ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  moduleKey:
                    event.target.value === "kindertraining" ||
                    event.target.value === "u12" ||
                    event.target.value === "u14"
                      ? event.target.value
                      : null,
                }))
              }
            >
              <option value="">Keinem Trainingsmodul zugeordnet</option>
              <option value="kindertraining">Kindertraining</option>
              <option value="u12">U12</option>
              <option value="u14">U14</option>
            </select>
            <small>Pro Trainingsmodul kann genau eine Gruppe fest zugeordnet werden.</small>
          </label>

          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={values.allowSpecialTraining}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  allowSpecialTraining: event.target.checked,
                }))
              }
            />
            <span>
              <strong>Sondertrainingstage erlauben</strong>
              <small>Erlaubt einzelne Termine außerhalb der gewählten Wochentage.</small>
            </span>
          </label>
        </div>

        <fieldset className="performance-group-fieldset performance-group-fieldset-v2">
          <legend>
            <CalendarClock aria-hidden="true" /> Leistungsgruppe
          </legend>

          <button
            type="button"
            className={`performance-feature-switch ${values.isPerformanceGroup ? "active" : ""}`}
            role="switch"
            aria-checked={values.isPerformanceGroup}
            onClick={() =>
              setValues((current) => ({
                ...current,
                isPerformanceGroup: !current.isPerformanceGroup,
              }))
            }
          >
            <span>
              <strong>Trainingsanmeldung</strong>
              <small>Wochenweise Zu- oder Absage der Athleten aktivieren.</small>
            </span>
            <span className="performance-switch-control" aria-hidden="true"><span /></span>
          </button>

          {values.isPerformanceGroup && (
            <div className="performance-settings-panel">
              <div className="performance-setting-row deadline-row">
                <div>
                  <strong>Anmeldeschluss</strong>
                  <small>Vor Beginn der jeweiligen Trainingswoche.</small>
                </div>
                <div className="performance-deadline-inputs">
                  <select
                    aria-label="Wochentag des Anmeldeschlusses"
                    value={values.registrationDeadlineWeekday}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        registrationDeadlineWeekday: Number(event.target.value),
                      }))
                    }
                  >
                    {WEEKDAYS.map((weekday) => (
                      <option value={weekday.value} key={weekday.value}>{weekday.label}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    aria-label="Uhrzeit des Anmeldeschlusses"
                    value={values.registrationDeadlineTime}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        registrationDeadlineTime: event.target.value || "18:00",
                      }))
                    }
                  />
                </div>
              </div>

              <div className="performance-setting-row">
                <div>
                  <strong>Wochen im Voraus</strong>
                  <small>Wie weit Athleten ihre Anmeldung sehen können.</small>
                </div>
                <input
                  className="performance-weeks-input"
                  type="number"
                  min={1}
                  max={12}
                  value={values.performanceWeeksAhead}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      performanceWeeksAhead: Math.min(12, Math.max(1, Number(event.target.value) || 1)),
                    }))
                  }
                />
              </div>

              <button
                type="button"
                className={`performance-setting-row performance-inline-switch ${values.allowLateRegistration ? "active" : ""}`}
                role="switch"
                aria-checked={values.allowLateRegistration}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    allowLateRegistration: !current.allowLateRegistration,
                  }))
                }
              >
                <span>
                  <strong>Nachmeldungen erlauben</strong>
                  <small>Späte Änderungen bleiben möglich und werden markiert.</small>
                </span>
                <span className="performance-switch-control" aria-hidden="true"><span /></span>
              </button>
            </div>
          )}
        </fieldset>

        {(values.moduleKey !== null || values.isPerformanceGroup) && values.regularWeekdays.length === 0 && (
          <div className="alert warning compact-alert">
            Für ein Trainingsmodul oder eine Leistungsgruppe muss mindestens ein Wochentag ausgewählt sein.
          </div>
        )}

        <label className="full-width-field">
          Beschreibung
          <textarea
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({ ...current, description: event.target.value }))
            }
            maxLength={1000}
            rows={3}
            placeholder="Optional"
          />
          <small>{values.description.length} / 1000 Zeichen</small>
        </label>

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
