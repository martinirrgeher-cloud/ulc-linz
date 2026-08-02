import { useMemo, useState, type FormEvent } from "react";
import { Save, Send, WandSparkles, X } from "lucide-react";
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
  linkedAthleteId: string | null;
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
  const [email, setEmail] = useState(existingMember?.email ?? "");
  const [displayName, setDisplayName] = useState(existingMember?.displayName ?? "");
  const [role, setRole] = useState<AppRole>(existingMember?.role ?? defaultTemplate.role);
  const [status, setStatus] = useState<MembershipStatus>(existingMember?.status ?? "invited");
  const [permissions, setPermissions] = useState<ManagedPermission[]>(
    existingMember
      ? completePermissions(modules, existingMember.permissions)
      : permissionTemplate(defaultTemplate, modules),
  );
  const [linkedAthleteId, setLinkedAthleteId] = useState(existingMember?.linkedAthleteId ?? "");
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
    linkedAthleteId,
    linkedTrainerId,
  }), [displayName, email, linkedAthleteId, linkedTrainerId, permissions, role, status]);
  useDraftDirtyState(draftValue, onDirtyChange);

  const hasVisibleModule = useMemo(
    () => role === "admin" || permissions.some((permission) => permission.canView),
    [permissions, role],
  );

  const athleteOptions = useMemo(
    () => linkOptions.athletes.filter((option) => (
      !option.linkedUserId || option.linkedUserId === existingMember?.userId
    )),
    [existingMember?.userId, linkOptions.athletes],
  );
  const trainerOptions = useMemo(
    () => linkOptions.trainers.filter((option) => (
      !option.linkedUserId || option.linkedUserId === existingMember?.userId
    )),
    [existingMember?.userId, linkOptions.trainers],
  );

  function applyTemplate(key: PermissionTemplateKey) {
    const template = PERMISSION_TEMPLATES.find((item) => item.key === key);
    if (!template) return;
    setSelectedTemplate(key);
    setRole(template.role);
    setPermissions(permissionTemplate(template, modules));
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

    try {
      await onSubmit({
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        role,
        status,
        permissions,
        linkedAthleteId: nullableId(linkedAthleteId),
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

  return (
    <section className="management-editor" aria-labelledby="member-editor-title">
      <div className="management-editor-heading">
        <div>
          <p className="eyebrow">Benutzerverwaltung</p>
          <h2 id="member-editor-title">
            {mode.type === "invite" ? "Benutzer einladen" : "Benutzer bearbeiten"}
          </h2>
          <p>
            {mode.type === "invite"
              ? "Die Person erhält eine E-Mail und vergibt über den Link ihr eigenes Passwort."
              : "Rolle, Rechte und Verknüpfungen werden mit Bearbeitungsschutz gespeichert."}
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onCancel}
          aria-label="Bearbeitung schließen"
          title="Schließen"
          disabled={busy}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <form className="management-form" onSubmit={handleSubmit}>
        <fieldset disabled={fieldsDisabled} className="e5c-editor-fieldset">
          <div className="e5c-template-panel">
            <label>
              <span><WandSparkles aria-hidden="true" /> Rechtevorlage</span>
              <select
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
            <label>
              Anzeigename
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                minLength={2}
                maxLength={120}
                autoComplete="name"
                required
              />
            </label>

            <label>
              E-Mail-Adresse
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                readOnly={mode.type === "edit"}
              />
              {mode.type === "edit" && <small>Die E-Mail-Adresse wird in Supabase Auth verwaltet.</small>}
            </label>

            <label>
              Rolle
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as AppRole);
                  setSelectedTemplate("");
                }}
                disabled={fieldsDisabled || isCurrentUser}
              >
                {roleOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
              {isCurrentUser && <small>Die eigene Administratorrolle ist geschützt.</small>}
            </label>

            {mode.type === "edit" && (
              <label>
                Status
                <select
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
              <label>
                Verknüpfter Athlet
                <select value={linkedAthleteId} onChange={(event) => setLinkedAthleteId(event.target.value)}>
                  <option value="">Keine Verknüpfung</option>
                  {athleteOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.name}{option.isActive ? "" : " (inaktiv)"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Verknüpfter Trainer
                <select value={linkedTrainerId} onChange={(event) => setLinkedTrainerId(event.target.value)}>
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

        <div className="management-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button" disabled={busy || !canEdit}>
            {mode.type === "invite" ? <Send aria-hidden="true" /> : <Save aria-hidden="true" />}
            {busy
              ? "Wird gespeichert …"
              : mode.type === "invite"
                ? "Einladung senden"
                : "Änderungen speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}
