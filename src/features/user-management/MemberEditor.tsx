import { useMemo, useState, type FormEvent } from "react";
import { Save, Send, X } from "lucide-react";
import { PermissionEditor } from "@/features/user-management/PermissionEditor";
import type {
  ManagedMember,
  ManagedModule,
  ManagedPermission,
  MembershipStatus,
} from "@/features/user-management/types";
import type { AppRole } from "@/types/auth";

export type MemberEditorMode =
  | { type: "invite" }
  | { type: "edit"; member: ManagedMember; isCurrentUser: boolean };

export type MemberEditorSubmit = {
  email: string;
  displayName: string;
  role: AppRole;
  status: MembershipStatus;
  permissions: ManagedPermission[];
};

export type MemberEditorProps = {
  mode: MemberEditorMode;
  modules: ManagedModule[];
  busy: boolean;
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

export function MemberEditor({
  mode,
  modules,
  busy,
  onCancel,
  onSubmit,
}: MemberEditorProps) {
  const existingMember = mode.type === "edit" ? mode.member : null;
  const [email, setEmail] = useState(existingMember?.email ?? "");
  const [displayName, setDisplayName] = useState(existingMember?.displayName ?? "");
  const [role, setRole] = useState<AppRole>(existingMember?.role ?? "trainer");
  const [status, setStatus] = useState<MembershipStatus>(existingMember?.status ?? "invited");
  const [permissions, setPermissions] = useState<ManagedPermission[]>(
    completePermissions(modules, existingMember?.permissions ?? []),
  );
  const [error, setError] = useState<string | null>(null);

  const hasVisibleModule = useMemo(
    () => role === "admin" || permissions.some((permission) => permission.canView),
    [permissions, role],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Die Benutzerdaten konnten nicht gespeichert werden.",
      );
    }
  }

  const isCurrentUser = mode.type === "edit" && mode.isCurrentUser;

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
              : "Rolle, Status und Modulrechte werden direkt in der Datenbank abgesichert."}
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
              disabled={busy}
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
              disabled={busy}
            />
            {mode.type === "edit" && (
              <small>Die E-Mail-Adresse wird in Supabase Auth verwaltet.</small>
            )}
          </label>

          <label>
            Rolle
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AppRole)}
              disabled={busy || isCurrentUser}
            >
              {roleOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isCurrentUser && <small>Die eigene Administratorrolle ist geschützt.</small>}
          </label>

          {mode.type === "edit" && (
            <label>
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as MembershipStatus)
                }
                disabled={busy || isCurrentUser}
              >
                {statusOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {isCurrentUser && <small>Das eigene Administratorkonto bleibt aktiv.</small>}
            </label>
          )}
        </div>

        <PermissionEditor
          modules={modules}
          permissions={permissions}
          role={role}
          disabled={busy}
          onChange={setPermissions}
        />

        <div className="management-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
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
