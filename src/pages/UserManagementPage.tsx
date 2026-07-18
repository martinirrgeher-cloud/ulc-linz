import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MailPlus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import {
  inviteMember,
  loadUserManagement,
  updateMember,
} from "@/features/user-management/api";
import {
  MemberEditor,
  type MemberEditorMode,
  type MemberEditorSubmit,
} from "@/features/user-management/MemberEditor";
import type {
  ManagedMember,
  ManagedModule,
  MembershipStatus,
} from "@/features/user-management/types";

const roleNames = {
  admin: "Administrator",
  trainer: "Trainer",
  athlete: "Athlet",
  parent: "Elternteil",
} as const;

const statusNames: Record<MembershipStatus, string> = {
  active: "Aktiv",
  invited: "Eingeladen",
  disabled: "Deaktiviert",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Die Daten konnten nicht geladen werden.";
}

function formatDate(value: string | null): string {
  if (!value) return "Noch nie";
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function permissionSummary(member: ManagedMember, modules: ManagedModule[]): string {
  if (member.role === "admin") return "Alle Module";
  const visible = member.permissions.filter((permission) => permission.canView).length;
  return `${visible} von ${modules.filter((module) => module.key !== "user_management").length} Modulen`;
}

export function UserManagementPage() {
  const { appContext } = useAuth();
  const organizationId = appContext?.organization?.id;
  const currentUserId = appContext?.authUser.id;
  const isAdmin = appContext?.membership?.role === "admin";

  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [modules, setModules] = useState<ManagedModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MembershipStatus>("all");
  const [editorMode, setEditorMode] = useState<MemberEditorMode | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId || !isAdmin) return;

    setLoading(true);
    setError(null);
    try {
      const data = await loadUserManagement(organizationId);
      setMembers(data.members);
      setModules(data.modules);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredMembers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter !== "all" && member.status !== statusFilter) return false;
      if (!search) return true;
      return (
        member.displayName.toLowerCase().includes(search) ||
        member.email.toLowerCase().includes(search) ||
        roleNames[member.role].toLowerCase().includes(search)
      );
    });
  }, [members, searchTerm, statusFilter]);

  const counts = useMemo(
    () => ({
      all: members.length,
      active: members.filter((member) => member.status === "active").length,
      invited: members.filter((member) => member.status === "invited").length,
      disabled: members.filter((member) => member.status === "disabled").length,
    }),
    [members],
  );

  if (!isAdmin || !organizationId) return <Navigate to="/kein-zugriff" replace />;

  const activeOrganizationId = organizationId;

  async function handleEditorSubmit(values: MemberEditorSubmit) {
    if (!editorMode) return;

    setBusy(true);
    setSuccess(null);
    try {
      if (editorMode.type === "invite") {
        const result = await inviteMember({
          organizationId: activeOrganizationId,
          email: values.email,
          displayName: values.displayName,
          role: values.role,
          permissions: values.permissions,
        });
        setSuccess(result.message);
      } else {
        await updateMember({
          organizationId: activeOrganizationId,
          membershipId: editorMode.member.membershipId,
          displayName: values.displayName,
          role: values.role,
          status: values.status,
          permissions: values.permissions,
        });
        setSuccess("Die Benutzerdaten wurden gespeichert.");
      }

      setEditorMode(null);
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="user-management-page">
      <div className="management-page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Benutzerverwaltung</h1>
          <p>
            Benutzer einladen, Rollen vergeben und den Zugriff auf einzelne Module steuern.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setSuccess(null);
            setEditorMode({ type: "invite" });
          }}
          disabled={loading || busy}
        >
          <MailPlus aria-hidden="true" />
          Benutzer einladen
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {editorMode && (
        <MemberEditor
          key={
            editorMode.type === "invite"
              ? "invite"
              : `edit-${editorMode.member.membershipId}`
          }
          mode={editorMode}
          modules={modules}
          busy={busy}
          onCancel={() => setEditorMode(null)}
          onSubmit={handleEditorSubmit}
        />
      )}

      <div className="management-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Name oder E-Mail suchen"
            aria-label="Benutzer suchen"
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadData()}
          disabled={loading || busy}
        >
          <RefreshCw aria-hidden="true" />
          Aktualisieren
        </button>
      </div>

      <div className="status-filter" aria-label="Benutzerstatus filtern">
        {(
          [
            ["all", "Alle", counts.all],
            ["active", "Aktiv", counts.active],
            ["invited", "Eingeladen", counts.invited],
            ["disabled", "Deaktiviert", counts.disabled],
          ] as const
        ).map(([value, label, count]) => (
          <button
            type="button"
            className={statusFilter === value ? "active" : ""}
            onClick={() => setStatusFilter(value)}
            key={value}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="management-loading">
          <div className="spinner" aria-hidden="true" />
          Benutzer werden geladen …
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="empty-state">
          <UsersRound aria-hidden="true" />
          <h2>Keine Benutzer gefunden</h2>
          <p>Passe die Suche oder den Statusfilter an.</p>
        </div>
      ) : (
        <div className="member-list">
          {filteredMembers.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            return (
              <article className={`member-card status-${member.status}`} key={member.membershipId}>
                <div className="member-primary">
                  <div className="member-avatar" aria-hidden="true">
                    {member.displayName.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="member-name">
                    <div>
                      <h2>{member.displayName}</h2>
                      {isCurrentUser && <span className="self-badge">Du</span>}
                    </div>
                    <a href={`mailto:${member.email}`}>{member.email}</a>
                  </div>
                </div>

                <div className="member-badges">
                  <span className={`status-badge ${member.status}`}>
                    {member.status === "active" && <CheckCircle2 aria-hidden="true" />}
                    {member.status === "invited" && <Clock3 aria-hidden="true" />}
                    {member.status === "disabled" && <UserRoundX aria-hidden="true" />}
                    {statusNames[member.status]}
                  </span>
                  <span className="role-badge">
                    <ShieldCheck aria-hidden="true" />
                    {roleNames[member.role]}
                  </span>
                </div>

                <dl className="member-details">
                  <div>
                    <dt>Modulrechte</dt>
                    <dd>{permissionSummary(member, modules)}</dd>
                  </div>
                  <div>
                    <dt>Letzte Anmeldung</dt>
                    <dd>{formatDate(member.lastSignInAt)}</dd>
                  </div>
                  <div>
                    <dt>E-Mail bestätigt</dt>
                    <dd>{member.emailConfirmedAt ? "Ja" : "Noch nicht"}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="secondary-button member-edit-button"
                  onClick={() => {
                    setSuccess(null);
                    setEditorMode({ type: "edit", member, isCurrentUser });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Pencil aria-hidden="true" />
                  Bearbeiten
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
