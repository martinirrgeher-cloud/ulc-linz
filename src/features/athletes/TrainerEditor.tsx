import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Layers3, NotebookText, UserRound } from "lucide-react";
import { StickyEditorActions } from "@/features/athletes/StickyEditorActions";
import { useSwipeTabs } from "@/features/athletes/useSwipeTabs";
import { useDraftDirtyState } from "@/features/collaboration/useDraftDirtyState";
import type { LinkableUser, Trainer, TrainerInput, TrainingGroup } from "@/features/athletes/types";
import { diagnosticErrorMessage } from "@/lib/diagnostics";

export type TrainerEditorMode =
  | { type: "create" }
  | { type: "edit"; trainer: Trainer };

type TrainerEditorProps = {
  mode: TrainerEditorMode;
  groups: TrainingGroup[];
  linkableUsers: LinkableUser[];
  busy: boolean;
  canEdit: boolean;
  lockNotice?: ReactNode;
  onCancel: () => void;
  onSubmit: (values: TrainerInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

type TrainerSection = "master" | "groups" | "notes";

const TRAINER_SECTIONS = ["master", "groups", "notes"] as const;
const TRAINER_FORM_ID = "trainer-editor-form";

function initialValues(mode: TrainerEditorMode): TrainerInput {
  if (mode.type === "create") {
    return {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      notes: "",
      isActive: true,
      linkedUserId: null,
      groupIds: [],
    };
  }

  return {
    firstName: mode.trainer.firstName,
    lastName: mode.trainer.lastName,
    phone: mode.trainer.phone ?? "",
    email: mode.trainer.email ?? "",
    notes: mode.trainer.notes ?? "",
    isActive: mode.trainer.isActive,
    linkedUserId: mode.trainer.linkedUserId,
    groupIds: mode.trainer.groupIds,
  };
}

export function TrainerEditor({
  mode,
  groups,
  linkableUsers,
  busy,
  canEdit,
  lockNotice,
  onCancel,
  onSubmit,
  onDirtyChange,
}: TrainerEditorProps) {
  const [values, setValues] = useState<TrainerInput>(() => initialValues(mode));
  const [section, setSection] = useState<TrainerSection>("master");
  const [error, setError] = useState<string | null>(null);
  useDraftDirtyState(values, onDirtyChange);

  const hasRequiredName = values.firstName.trim().length > 0 && values.lastName.trim().length > 0;
  const emailValid = values.email.trim().length === 0
    || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim());
  const canSave = hasRequiredName && emailValid;
  const saveDisabledReason = !hasRequiredName
    ? "Vor- und Nachname sind erforderlich"
    : !emailValid
      ? "Bitte gib eine gültige E-Mail-Adresse ein"
      : undefined;

  const availableUsers = useMemo(() => linkableUsers.filter((user) => (
    !user.trainerId
    || user.userId === values.linkedUserId
    || (mode.type === "edit" && user.trainerId === mode.trainer.id)
  )), [linkableUsers, mode, values.linkedUserId]);

  const selectableGroups = useMemo(
    () => groups.filter((group) => group.isActive || values.groupIds.includes(group.id)),
    [groups, values.groupIds],
  );

  const swipeSections = useSwipeTabs({
    tabs: TRAINER_SECTIONS,
    activeTab: section,
    onChange: setSection,
  });

  function toggleGroup(groupId: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      groupIds: checked
        ? [...new Set([...current.groupIds, groupId])]
        : current.groupIds.filter((id) => id !== groupId),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !canSave || busy) return;

    setError(null);
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(
        diagnosticErrorMessage(submitError, "Der Trainer konnte nicht gespeichert werden.", "trainer_editor.save"),
      );
    }
  }

  return (
    <section className="management-editor trainer-editor compact-editor" aria-label={mode.type === "create" ? "Trainer anlegen" : "Trainer bearbeiten"}>
      <StickyEditorActions
        eyebrow="Trainerstammdaten"
        title={mode.type === "create" ? "Trainer anlegen" : "Trainer bearbeiten"}
        description="Kontaktdaten, Gruppenzuordnung und interne Hinweise verwalten."
        formId={TRAINER_FORM_ID}
        busy={busy}
        canEdit={canEdit}
        canSave={canSave}
        saveDisabledReason={saveDisabledReason}
        onClose={onCancel}
      />

      {lockNotice}
      {error && <div className="alert error">{error}</div>}

      <form
        id={TRAINER_FORM_ID}
        className="management-form compact-editor-form"
        onSubmit={handleSubmit}
        {...swipeSections}
      >
        <div className="editor-section-tabs" role="tablist" aria-label="Trainerbereiche">
          <button type="button" role="tab" aria-selected={section === "master"} className={section === "master" ? "active" : ""} onClick={() => setSection("master")}>
            <UserRound aria-hidden="true" /> Stammdaten
          </button>
          <button type="button" role="tab" aria-selected={section === "groups"} className={section === "groups" ? "active" : ""} onClick={() => setSection("groups")}>
            <Layers3 aria-hidden="true" /> Gruppen <span>{values.groupIds.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={section === "notes"} className={section === "notes" ? "active" : ""} onClick={() => setSection("notes")}>
            <NotebookText aria-hidden="true" /> Notiz
          </button>
        </div>

        <fieldset className="athlete-editor-lock-fieldset" disabled={!canEdit || busy}>
          {section === "master" && (
            <div className="editor-section-panel editor-section-card" role="tabpanel">
              <div className="form-grid">
                <label>
                  Vorname
                  <input
                    type="text"
                    value={values.firstName}
                    onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))}
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Nachname
                  <input
                    type="text"
                    value={values.lastName}
                    onChange={(event) => setValues((current) => ({ ...current, lastName: event.target.value }))}
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  Telefonnummer
                  <input
                    type="tel"
                    value={values.phone}
                    onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
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
                    onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                    maxLength={254}
                    autoComplete="email"
                    placeholder="Optional"
                    aria-invalid={!emailValid}
                    aria-describedby={!emailValid ? "trainer-email-error" : undefined}
                  />
                  {!emailValid && (
                    <small id="trainer-email-error" className="management-field-error" role="alert">
                      Bitte gib eine gültige E-Mail-Adresse ein.
                    </small>
                  )}
                </label>
                <label>
                  App-Benutzerkonto
                  <select
                    value={values.linkedUserId ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, linkedUserId: event.target.value || null }))}
                  >
                    <option value="">Nicht verknüpft</option>
                    {availableUsers.map((user) => (
                      <option value={user.userId} key={user.userId}>
                        {user.displayName} · {user.email}{user.status === "invited" ? " (eingeladen)" : ""}
                      </option>
                    ))}
                  </select>
                  <small>Erforderlich für die eigene Traineranwesenheit.</small>
                </label>
                {mode.type === "edit" && (
                  <label>
                    Status
                    <select
                      value={values.isActive ? "active" : "inactive"}
                      onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.value === "active" }))}
                    >
                      <option value="active">Aktiv</option>
                      <option value="inactive">Inaktiv</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}

          {section === "groups" && (
            <fieldset className="trainer-group-field editor-section-panel editor-section-card" role="tabpanel">
              <legend>Trainingsgruppen</legend>
              <p className="field-hint">Trainer können mehreren aktiven Gruppen zugeordnet sein.</p>
              {selectableGroups.length === 0 ? (
                <p className="form-help">Noch keine Trainingsgruppen angelegt.</p>
              ) : (
                <div className="trainer-group-options">
                  {selectableGroups.map((group) => (
                    <label key={group.id} className={group.isActive ? "" : "inactive"}>
                      <input
                        type="checkbox"
                        checked={values.groupIds.includes(group.id)}
                        onChange={(event) => toggleGroup(group.id, event.target.checked)}
                      />
                      <span>
                        <strong>{group.name}</strong>
                        <small>{[group.shortName, !group.isActive ? "Inaktiv" : null].filter(Boolean).join(" · ")}</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {section === "notes" && (
            <div className="editor-section-panel editor-section-card" role="tabpanel">
              <label className="full-width-field">
                Interne Notiz
                <textarea
                  value={values.notes}
                  onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
                  maxLength={2000}
                  rows={7}
                  placeholder="Optional"
                />
                <small>{values.notes.length} / 2000 Zeichen</small>
              </label>
            </div>
          )}
        </fieldset>
      </form>
    </section>
  );
}
