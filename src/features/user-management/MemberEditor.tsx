import { useMemo, useState, type FormEvent } from "react";
import { Search, WandSparkles } from "lucide-react";
import { EditorShell } from "@/components/ui/EditorShell";
import { useDraftDirtyState } from "@/features/collaboration/useDraftDirtyState";
import { MemberAuditLog } from "@/features/user-management/MemberAuditLog";
import { PermissionEditor } from "@/features/user-management/PermissionEditor";
import {
  PERMISSION_TEMPLATES,
  permissionTemplate,
  type PermissionTemplateKey,
} from "@/features/user-management/permission-templates";
import type {
  ManagedMember,
  ManagedModule,
  ManagedPermission,
  MemberAuditEntry,
  MemberLinkOptions,
  MembershipStatus,
} from "@/features/user-management/types";
import type { AppRole } from "@/types/auth";
import { diagnosticErrorMessage } from "@/lib/diagnostics";

export type MemberEditorMode =
  | { type: "invite" }
  | { type: "edit"; member: ManagedMember; isCurrentUser: boolean };

export type MemberEditorSubmit = {
  email: string;
  displayName: string;
  role: AppRole;
  status: MembershipStatus;
  permissions: ManagedPermission[];
  linkedAthleteIds: string[];
  linkedTrainerId: string | null;
};

export type MemberEditorProps = {
  mode: MemberEditorMode;
  modules: ManagedModule[];
  linkOptions: MemberLinkOptions;
  auditEntries: MemberAuditEntry[];
  auditLoading: boolean;
  busy: boolean;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onSubmit: (values: MemberEditorSubmit) => Promise<void>;
};

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "admin", label: "Administrator" },
  { value: "trainer", label: "Trainer" },
  { value: "athlete", label: "Athlet" },
  { value: "parent", label: "Elternteil" },
];

const statusOptions: Array<{ value: MembershipStatus; label: string }> = [
  { value: "active", label: "Aktiv" },
  { value: "invited", label: "Eingeladen" },
  { value: "disabled", label: "Deaktiviert" },
];

const MEMBER_FORM_ID = "user-member-editor-form";

function completePermissions(
  modules: ManagedModule[],
  permissions: ManagedPermission[],
): ManagedPermission[] {
  return modules.map((module) => {
    const permission = permissions.find((item) => item.moduleKey === module.key);
    return {
      moduleKey: module.key,
      canView: permission?.canView ?? false,
      canEdit: permission?.canEdit ?? false,
    };
  });
}

function nullableId(value: string): string | null {
  return value || null;
}

function roleSupportsAthleteLinks(role: AppRole): boolean {
  return role === "athlete" || role === "parent";
}

export function MemberEditor({
  mode,
  modules,
  linkOptions,
  auditEntries,
  auditLoading,
  busy,
  canEdit,
  onDirtyChange,
  onCancel,
  onSubmit,
}: MemberEditorProps) {
  const existingMember = mode.type === "edit" ? mode.member : null;
  const defaultTemplate = PERMISSION_TEMPLATES[0]!;
  const initialRole = existingMember?.role ?? defaultTemplate.role;
  const initialAthleteIds = roleSupportsAthleteLinks(initialRole)
    ? existingMember?.linkedAthletes.map((athlete) => athlete.id) ?? []
    : [];

  const [email, setEmail] = useState(existingMember?.email ?? "");
  const [displayName, setDisplayName] = useState(existingMember?.displayName ?? "");
  const [role, setRole] = useState<AppRole>(initialRole);
  const [status, setStatus] = useState<MembershipStatus>(existingMember?.status ?? "invited");
  const [permissions, setPermissions] = useState<ManagedPermission[]>(
    existingMember
      ? completePermissions(modules, existingMember.permissions)
      : permissionTemplate(defaultTemplate, modules),
  );
  const [linkedAthleteIds, setLinkedAthleteIds] = useState<string[]>(initialAthleteIds);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [linkedTrainerId, setLinkedTrainerId] = useState(existingMember?.linkedTrainerId ?? "");
  const [selectedTemplate, setSelectedTemplate] = useState<PermissionTemplateKey | "">(
    mode.type === "invite" ? defaultTemplate.key : "",
  );
  const [error, setError] = useState<string | null>(null);

  const draftValue = useMemo(() => ({
    email,
    displayName,
    role,
    status,
    permissions,
    linkedAthleteIds,
    linkedTrainerId,
  }), [displayName, email, linkedAthleteIds, linkedTrainerId, permissions, role, status]);
  useDraftDirtyState(draftValue, onDirtyChange);

  const hasVisibleModule = useMemo(
    () => role === "admin" || permissions.some((permission) => permission.canView),
    [permissions, role],
  );

  const selectedAthleteIds = useMemo(() => new Set(linkedAthleteIds), [linkedAthleteIds]);
  const athleteOptions = useMemo(() => {
    if (!roleSupportsAthleteLinks(role)) return [];

    const eligible = linkOptions.athletes.filter((option) => {
      if (selectedAthleteIds.has(option.id)) return true;
      if (!option.isActive) return false;
      if (role === "parent") return true;
      return !option.linkedUserId || option.linkedUserId === existingMember?.userId;
    });
    const search = athleteSearch.trim().toLowerCase();
    return search
      ? eligible.filter((option) => option.name.toLowerCase().includes(search))
      : eligible;
  }, [athleteSearch, existingMember?.userId, linkOptions.athletes, role, selectedAthleteIds]);

  const trainerOptions = useMemo(
    () => linkOptions.trainers.filter((option) => (
      !option.linkedUserId || option.linkedUserId === existingMember?.userId
    )),
    [existingMember?.userId, linkOptions.trainers],
  );

  function normalizeAthleteSelection(nextRole: AppRole, currentIds: string[]): string[] {
    if (nextRole === "parent") return currentIds;
    if (nextRole !== "athlete") return [];

    const eligibleIds = new Set(
      linkOptions.athletes
        .filter((option) => !option.linkedUserId || option.linkedUserId === existingMember?.userId)
        .map((option) => option.id),
    );
    const firstEligible = currentIds.find((id) => eligibleIds.has(id));
    return firstEligible ? [firstEligible] : [];
  }

  function changeRole(nextRole: AppRole) {
    setRole(nextRole);
    setLinkedAthleteIds((current) => normalizeAthleteSelection(nextRole, current));
    setAthleteSearch("");
    setSelectedTemplate("");
  }

  function applyTemplate(key: PermissionTemplateKey) {
    const template = PERMISSION_TEMPLATES.find((item) => item.key === key);
    if (!template) return;
    setSelectedTemplate(key);
    setRole(template.role);
    setLinkedAthleteIds((current) => normalizeAthleteSelection(template.role, current));
    setAthleteSearch("");
    setPermissions(permissionTemplate(template, modules));
  }

  function toggleAthlete(athleteId: string) {
    if (role === "athlete") {
      setLinkedAthleteIds([athleteId]);
      return;
    }

    setLinkedAthleteIds((current) => (
      current.includes(athleteId)
        ? current.filter((id) => id !== athleteId)
        : [...current, athleteId]
    ));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canEdit) {
      setError("Dieser Benutzer ist derzeit auf einem anderen Gerät zur Bearbeitung reserviert.");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Der Anzeigename muss mindestens zwei Zeichen lang sein.");
      return;
    }
    if (mode.type === "invite" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (!hasVisibleModule) {
      setError("Wähle mindestens ein Modul mit Leseberechtigung aus.");
      return;
    }
    if (role === "athlete" && linkedAthleteIds.length > 1) {
      setError("Ein Athletenkonto kann nur mit einem Athleten verknüpft werden.");
      return;
    }

    try {
      await onSubmit({
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        role,
        status,
        permissions,
        linkedAthleteIds: roleSupportsAthleteLinks(role) ? linkedAthleteIds : [],
        linkedTrainerId: nullableId(linkedTrainerId),
      });
    } catch (submitError) {
      setError(diagnosticErrorMessage(
        submitError,
        "Die Benutzerdaten konnten nicht gespeichert werden.",
        "member_editor.save",
      ));
    }
  }

  const isCurrentUser = mode.type === "edit" && mode.isCurrentUser;
  const fieldsDisabled = busy || !canEdit;

  const editorTitle = mode.type === "invite" ? "Benutzer einladen" : "Benutzer bearbeiten";
  const editorMeta = mode.type === "invite"
    ? "Die Person erhält eine E-Mail und vergibt über den Link ihr eigenes Passwort."
    : "Rolle, Rechte und Verknüpfungen werden mit Bearbeitungsschutz gespeichert.";

  return (
    <div data-testid="user-member-editor">
    <EditorShell
      eyebrow="Benutzerverwaltung"
      title={editorTitle}
      meta={editorMeta}
      canEdit={canEdit}
      busy={busy}
      saveFormId={MEMBER_FORM_ID}
      saveLabel={mode.type === "invite" ? "Einladung senden" : "Änderungen speichern"}
      saveTestId="user-member-editor-save"
      closeTestId="user-member-editor-close"
      className="user-member-editor-shell"
      onClose={onCancel}
    >
      {error && <div className="alert error">{error}</div>}

        <form id={MEMBER_FORM_ID} className="management-form user-member-editor-form" onSubmit={handleSubmit}>
        <fieldset disabled={fieldsDisabled} className="e5c-editor-fieldset">
          <div className="e5c-template-panel">
            <label className="ui-labeled-field">
              <span className="ui-field-label"><WandSparkles aria-hidden="true" /> Rechtevorlage</span>
              <select className="ui-field-control"
                value={selectedTemplate}
                onChange={(event) => {
                  const key = event.target.value;
                  if (!key) {
                    setSelectedTemplate("");
                    return;
                  }
                  applyTemplate(key as PermissionTemplateKey);
                }}
                disabled={fieldsDisabled || isCurrentUser}
              >
                <option value="">Individuelle Rechte</option>
                {PERMISSION_TEMPLATES.map((template) => (
                  <option value={template.key} key={template.key}>{template.label}</option>
                ))}
              </select>
            </label>
            <small>
              Die Vorlage setzt Rolle und Startrechte. Einzelne Rechte bleiben danach frei anpassbar.
            </small>
          </div>

          <div className="form-grid">
            <label className="ui-labeled-field">
              <span className="ui-field-label">Anzeigename</span>
              <input className="ui-field-control"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                minLength={2}
                maxLength={120}
                autoComplete="name"
                required
              />
            </label>

            <label className="ui-labeled-field">
              <span className="ui-field-label">E-Mail-Adresse</span>
              <input className="ui-field-control"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                readOnly={mode.type === "edit"}
              />
              {mode.type === "edit" && <small>Die E-Mail-Adresse wird in Supabase Auth verwaltet.</small>}
            </label>

            <label className="ui-labeled-field">
              <span className="ui-field-label">Rolle</span>
              <select className="ui-field-control"
                value={role}
                onChange={(event) => changeRole(event.target.value as AppRole)}
                disabled={fieldsDisabled || isCurrentUser}
              >
                {roleOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
              {isCurrentUser && <small>Die eigene Administratorrolle ist geschützt.</small>}
            </label>

            {mode.type === "edit" && (
              <label className="ui-labeled-field">
                <span className="ui-field-label">Status</span>
                <select className="ui-field-control"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as MembershipStatus)}
                  disabled={fieldsDisabled || isCurrentUser}
                >
                  {statusOptions.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
                {isCurrentUser && <small>Das eigene Administratorkonto bleibt aktiv.</small>}
              </label>
            )}
          </div>

          {mode.type === "edit" && (
            <div className="form-grid e5c-link-grid">
              {roleSupportsAthleteLinks(role) ? (
                <fieldset className="e5c-athlete-link-selector">
                  <legend>Verknüpfte Athleten</legend>
                  <p className="field-hint">
                    {role === "parent"
                      ? "Mehrere Kinder können gleichzeitig ausgewählt werden. Die Trainingsgruppe ersetzt diese persönliche Zuordnung nicht."
                      : "Das Athletenkonto kann genau einem eigenen Athletenprofil zugeordnet werden."}
                  </p>

                  {linkOptions.athletes.length > 6 && (
                    <label className="e5c-athlete-search">
                      <span>Athleten suchen</span>
                      <span className="ui-search-field">
                        <Search aria-hidden="true" />
                        <input
                          type="search"
                          value={athleteSearch}
                          onChange={(event) => setAthleteSearch(event.target.value)}
                          placeholder="Name suchen"
                        />
                      </span>
                    </label>
                  )}

                  <div className="e5c-athlete-selection-heading">
                    <strong>{linkedAthleteIds.length} ausgewählt</strong>
                    {linkedAthleteIds.length > 0 && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setLinkedAthleteIds([])}
                      >
                        Auswahl aufheben
                      </button>
                    )}
                  </div>

                  <div className="e5c-athlete-options" role="group" aria-label="Athletenverknüpfungen">
                    {athleteOptions.length === 0 ? (
                      <p className="field-hint">Keine passenden Athleten verfügbar.</p>
                    ) : athleteOptions.map((option) => {
                      const selected = selectedAthleteIds.has(option.id);
                      const inputType = role === "parent" ? "checkbox" : "radio";
                      return (
                        <label className={selected ? "selected" : ""} key={option.id}>
                          <input
                            type={inputType}
                            name={role === "athlete" ? "linked-athlete" : undefined}
                            checked={selected}
                            onChange={() => toggleAthlete(option.id)}
                          />
                          <span>{option.name}</span>
                          {!option.isActive && <small>inaktiv</small>}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <div className="e5c-athlete-link-info">
                  <strong>Athletenzuordnung</strong>
                  <p className="field-hint">
                    {role === "trainer"
                      ? "Trainer erhalten Athletenbezug über ihre Trainingsgruppen. Eine direkte Athletenverknüpfung ist nicht erforderlich."
                      : "Administratoren benötigen keine direkte Athletenverknüpfung."}
                  </p>
                  {(existingMember?.linkedAthletes.length ?? 0) > 0 && (
                    <p className="field-hint warning-text">
                      Beim Speichern werden bestehende direkte Athletenverknüpfungen dieses Kontos entfernt.
                    </p>
                  )}
                </div>
              )}

              <label className="ui-labeled-field">
                <span className="ui-field-label">Verknüpfter Trainer</span>
                <select className="ui-field-control" value={linkedTrainerId} onChange={(event) => setLinkedTrainerId(event.target.value)}>
                  <option value="">Keine Verknüpfung</option>
                  {trainerOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.name}{option.isActive ? "" : " (inaktiv)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <PermissionEditor
            modules={modules}
            permissions={permissions}
            role={role}
            disabled={fieldsDisabled}
            onChange={(next) => {
              setPermissions(next);
              setSelectedTemplate("");
            }}
          />
        </fieldset>

        {mode.type === "edit" && (
          <MemberAuditLog entries={auditEntries} loading={auditLoading} />
        )}

        </form>
    </EditorShell>
    </div>
  );
}
