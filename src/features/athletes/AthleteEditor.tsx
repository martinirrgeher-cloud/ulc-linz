import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useDraftDirtyState } from "@/features/collaboration/useDraftDirtyState";
import {
  Layers3,
  Phone,
  Plus,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { StickyEditorActions } from "@/components/ui/StickyEditorActions";
import { useSwipeTabs } from "@/features/athletes/useSwipeTabs";
import type {
  Athlete,
  AthleteContact,
  AthleteInput,
  LinkableUser,
  TrainingGroup,
} from "@/features/athletes/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
export type AthleteEditorMode =
  | { type: "create" }
  | { type: "edit"; athlete: Athlete };

type AthleteEditorProps = {
  mode: AthleteEditorMode;
  groups: TrainingGroup[];
  linkableUsers: LinkableUser[];
  busy: boolean;
  canEdit: boolean;
  lockNotice?: ReactNode;
  onCancel: () => void;
  onSubmit: (values: AthleteInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

type EditorSection = "master" | "groups" | "contacts";

const EDITOR_SECTIONS = ["master", "groups", "contacts"] as const;
const ATHLETE_FORM_ID = "athlete-editor-form";

function emptyContact(): AthleteContact {
  return {
    id: null,
    contactName: "",
    relationship: "",
    phone: "",
    isEmergency: true,
    priority: 1,
    notes: "",
  };
}

function initialValues(mode: AthleteEditorMode): AthleteInput {
  if (mode.type === "create") {
    return {
      firstName: "",
      lastName: "",
      birthYear: null,
      notes: "",
      isActive: true,
      linkedUserId: null,
      groupIds: [],
      contacts: [],
    };
  }

  return {
    firstName: mode.athlete.firstName,
    lastName: mode.athlete.lastName,
    birthYear: mode.athlete.birthYear,
    notes: mode.athlete.notes ?? "",
    isActive: mode.athlete.isActive,
    linkedUserId: mode.athlete.linkedUserId,
    groupIds: mode.athlete.groups.map((group) => group.id),
    contacts: mode.athlete.contacts.map((contact) => ({ ...contact })),
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
  linkableUsers,
  busy,
  canEdit,
  lockNotice,
  onCancel,
  onSubmit,
  onDirtyChange,
}: AthleteEditorProps) {
  const [values, setValues] = useState<AthleteInput>(() => initialValues(mode));
  const [section, setSection] = useState<EditorSection>("master");
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  useDraftDirtyState(values, onDirtyChange);

  const availableUsers = useMemo(
    () => linkableUsers.filter((user) => (
      !user.athleteId ||
      user.userId === values.linkedUserId ||
      (mode.type === "edit" && user.athleteId === mode.athlete.id)
    )),
    [linkableUsers, mode, values.linkedUserId],
  );

  const selectableGroups = useMemo(
    () => groups.filter((group) => group.isActive || values.groupIds.includes(group.id)),
    [groups, values.groupIds],
  );

  const contactsValid = values.contacts.every(
    (contact) => contact.contactName.trim().length > 0 && contact.phone.trim().length >= 3,
  );

  const canSave =
    values.firstName.trim().length > 0 &&
    values.lastName.trim().length > 0 &&
    contactsValid &&
    (values.birthYear === null ||
      (values.birthYear >= 1900 && values.birthYear <= currentYear));

  const swipeSections = useSwipeTabs({
    tabs: EDITOR_SECTIONS,
    activeTab: section,
    onChange: setSection,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !canSave || busy) return;

    setError(null);
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(
        diagnosticErrorMessage(submitError, "Der Athlet konnte nicht gespeichert werden.", "athlete_editor.save"),
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

  function addContact() {
    setValues((current) => ({
      ...current,
      contacts: [...current.contacts, { ...emptyContact(), priority: current.contacts.length + 1 }],
    }));
  }

  function updateContact(index: number, changes: Partial<AthleteContact>) {
    setValues((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, ...changes } : contact,
      ),
    }));
  }

  function removeContact(index: number) {
    setValues((current) => ({
      ...current,
      contacts: current.contacts
        .filter((_, contactIndex) => contactIndex !== index)
        .map((contact, contactIndex) => ({ ...contact, priority: contactIndex + 1 })),
    }));
  }

  return (
    <section className="management-editor athlete-editor compact-editor" aria-label={mode.type === "create" ? "Athlet anlegen" : "Athlet bearbeiten"} data-testid="masterdata-athlete-editor">
      <StickyEditorActions
        title={mode.type === "create" ? "Athlet anlegen" : "Athlet bearbeiten"}
        formId={ATHLETE_FORM_ID}
        busy={busy}
        canEdit={canEdit}
        canSave={canSave}
        onClose={onCancel}
      />

      {lockNotice}
      {error && <div className="alert error">{error}</div>}

      <form
        id={ATHLETE_FORM_ID}
        className="management-form compact-athlete-form"
        onSubmit={handleSubmit}
        {...swipeSections}
      >
        <div className="editor-section-tabs" role="tablist" aria-label="Athletenbereiche">
          <button
            type="button"
            role="tab"
            aria-selected={section === "master"}
            className={section === "master" ? "active" : ""}
            onClick={() => setSection("master")}
          >
            <UserRound aria-hidden="true" />
            Stammdaten
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "groups"}
            className={section === "groups" ? "active" : ""}
            onClick={() => setSection("groups")}
          >
            <Layers3 aria-hidden="true" />
            Gruppen
            <span>{values.groupIds.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "contacts"}
            className={section === "contacts" ? "active" : ""}
            onClick={() => setSection("contacts")}
          >
            <Phone aria-hidden="true" />
            Kontakte
            <span>{values.contacts.length}</span>
          </button>
        </div>

        <fieldset className="athlete-editor-lock-fieldset" disabled={!canEdit || busy}>
        {section === "master" && (
          <div className="editor-section-panel" role="tabpanel">
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
              </label>

              <label>
                App-Benutzerkonto
                <select
                  value={values.linkedUserId ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      linkedUserId: event.target.value || null,
                    }))
                  }
                >
                  <option value="">Nicht verknüpft</option>
                  {availableUsers.map((user) => (
                    <option value={user.userId} key={user.userId}>
                      {user.displayName} · {user.email}
                      {user.status === "invited" ? " (eingeladen)" : ""}
                    </option>
                  ))}
                </select>
                <small>Erforderlich, damit der Athlet seine Trainingswoche selbst eintragen kann.</small>
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
                  <small>Vergangene Trainings und Statistiken bleiben erhalten.</small>
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
                rows={3}
                placeholder="Optional"
              />
              <small>{values.notes.length} / 3000 Zeichen</small>
            </label>
          </div>
        )}

        {section === "groups" && (
          <fieldset className="group-selection editor-section-panel" role="tabpanel">
            <legend>Aktuelle Trainingsgruppen</legend>
            <p className="field-hint">
              Ein Athlet kann mehreren Gruppen gleichzeitig zugeordnet sein.
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
        )}

        {section === "contacts" && (
          <fieldset className="contact-selection editor-section-panel" role="tabpanel">
            <div className="fieldset-heading">
              <div>
                <legend>Kontakte und Notfallkontakte</legend>
                <p className="field-hint">Im Training direkt beim Kind abrufbar.</p>
              </div>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={addContact}
                disabled={values.contacts.length >= 10}
              >
                <Plus aria-hidden="true" /> Kontakt
              </button>
            </div>

            {values.contacts.length === 0 ? (
              <div className="inline-empty-state compact-empty-state">
                <Phone aria-hidden="true" /> Noch kein Kontakt hinterlegt.
              </div>
            ) : (
              <div className="contact-editor-list">
                {values.contacts.map((contact, index) => (
                  <article className="contact-editor-card" key={contact.id ?? `new-${index}`}>
                    <div className="contact-editor-card-heading">
                      <strong>Kontakt {index + 1}</strong>
                      <button
                        type="button"
                        className="icon-button danger-icon-button"
                        onClick={() => removeContact(index)}
                        aria-label={`Kontakt ${index + 1} entfernen`}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                    <div className="form-grid contact-grid">
                      <label>
                        Name
                        <input
                          type="text"
                          value={contact.contactName}
                          onChange={(event) => updateContact(index, { contactName: event.target.value })}
                          maxLength={120}
                          placeholder="z. B. Maria Mustermann"
                          required
                        />
                      </label>
                      <label>
                        Beziehung
                        <input
                          type="text"
                          value={contact.relationship}
                          onChange={(event) => updateContact(index, { relationship: event.target.value })}
                          maxLength={80}
                          placeholder="z. B. Mutter"
                        />
                      </label>
                      <label>
                        Telefonnummer
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(event) => updateContact(index, { phone: event.target.value })}
                          maxLength={40}
                          autoComplete="tel"
                          placeholder="+43 …"
                          required
                        />
                      </label>
                      <label className="contact-emergency-toggle">
                        <input
                          type="checkbox"
                          checked={contact.isEmergency}
                          onChange={(event) => updateContact(index, { isEmergency: event.target.checked })}
                        />
                        <span>
                          <ShieldAlert aria-hidden="true" />
                          <strong>Notfallkontakt</strong>
                        </span>
                      </label>
                    </div>
                    <label className="full-width-field">
                      Kurze Notiz
                      <input
                        type="text"
                        value={contact.notes}
                        onChange={(event) => updateContact(index, { notes: event.target.value })}
                        maxLength={500}
                        placeholder="Optional"
                      />
                    </label>
                  </article>
                ))}
              </div>
            )}
          </fieldset>
        )}

        </fieldset>

      </form>
    </section>
  );
}
