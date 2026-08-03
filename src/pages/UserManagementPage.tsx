import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Link2,
  Link2Off,
  MailPlus,
  Pencil,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { EditLockNotice } from "@/components/collaboration/EditLockNotice";
import { RemoteChangeNotice } from "@/components/collaboration/RemoteChangeNotice";
import {
  collaborationVersionsDiffer,
  isCollaborationConflictError,
} from "@/features/collaboration/conflicts";
import { useEditLock } from "@/features/collaboration/useEditLock";
import { useOrganizationRealtime } from "@/features/collaboration/useOrganizationRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import {
  inviteMember,
  loadMemberAudit,
  loadUserManagement,
  resendInvitation,
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
  MemberAuditEntry,
  MemberLinkOptions,
  MemberWarningCode,
} from "@/features/user-management/types";
import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/user-management-e5c.css";

const USER_REALTIME_TABLES = [
  "organization_members",
  "audit_log",
  "athletes",
  "trainers",
] as const;

const roleNames = {
  admin: "Administrator",
  trainer: "Trainer",
  athlete: "Athlet",
  parent: "Elternteil",
} as const;

const statusNames = {
  active: "Aktiv",
  invited: "Eingeladen",
  disabled: "Deaktiviert",
} as const;

const invitationNames = {
  open: "Einladung offen",
  accepted: "Einladung angenommen",
  not_sent: "Noch nicht versendet",
  not_required: "Keine offene Einladung",
  disabled: "Konto deaktiviert",
} as const;

const warningNames: Record<MemberWarningCode, string> = {
  invitation_not_sent: "Einladung wurde noch nicht versendet",
  email_not_confirmed: "Aktives Konto ohne bestätigte E-Mail",
  athlete_link_missing: "Athletenkonto ohne Athletenverknüpfung",
  parent_link_missing: "Elternkonto ohne verknüpften Athleten",
  trainer_link_missing: "Trainerkonto ohne Trainerverknüpfung",
};

type RoleFilter = "all" | ManagedMember["role"];
type StatusFilter = "all" | "active" | "invitation_open" | "disabled";
type AccountFilter = "all" | "unlinked" | "incomplete";

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Daten konnten nicht geladen werden.", "user_management");
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

function isInvitationOpen(member: ManagedMember): boolean {
  return member.invitationStatus === "open" || member.invitationStatus === "not_sent";
}

function isUnlinked(member: ManagedMember): boolean {
  return member.linkedAthletes.length === 0 && !member.linkedTrainerId;
}

export function UserManagementPage() {
  const { appContext } = useAuth();
  const organizationId = appContext?.organization?.id;
  const currentUserId = appContext?.authUser.id;
  const isAdmin = appContext?.membership?.role === "admin";

  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [modules, setModules] = useState<ManagedModule[]>([]);
  const [linkOptions, setLinkOptions] = useState<MemberLinkOptions>({ athletes: [], trainers: [] });
  const [auditEntries, setAuditEntries] = useState<MemberAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [remoteSyncBusy, setRemoteSyncBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [editorMode, setEditorMode] = useState<MemberEditorMode | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorDirty, setEditorDirty] = useState(false);
  const [remoteChangePending, setRemoteChangePending] = useState(false);

  const editedMember = editorMode?.type === "edit" ? editorMode.member : null;
  const memberLock = useEditLock({
    organizationId,
    entityType: "organization_member",
    entityId: editedMember?.membershipId,
    expectedUpdatedAt: editedMember?.updatedAt ?? null,
    enabled: Boolean(editedMember),
  });

  useEffect(() => {
    if (collaborationVersionsDiffer(editedMember?.updatedAt, memberLock.recordVersion)) {
      setRemoteChangePending(true);
    }
  }, [editedMember?.updatedAt, memberLock.recordVersion]);

  const loadData = useCallback(async (showLoading = true) => {
    if (!organizationId || !isAdmin) return null;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await loadUserManagement(organizationId);
      setMembers(data.members);
      setModules(data.modules);
      setLinkOptions(data.linkOptions);
      return data;
    } catch (loadError) {
      setError(errorMessage(loadError));
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isAdmin, organizationId]);

  const loadAudit = useCallback(async (membershipId: string) => {
    if (!organizationId) return;
    setAuditLoading(true);
    try {
      setAuditEntries(await loadMemberAudit(organizationId, membershipId));
    } catch (auditError) {
      setError(errorMessage(auditError));
    } finally {
      setAuditLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (editedMember) void loadAudit(editedMember.membershipId);
    else setAuditEntries([]);
  }, [editedMember?.membershipId, loadAudit]);

  const handleRealtimeRefresh = useCallback((refresh: {
    reason: "database" | "reconnected";
    changes: Array<{ table: string; recordId: string | null }>;
  }) => {
    if (busy || remoteSyncBusy || resendBusyId) return;

    const memberChanged = Boolean(editedMember) && (
      refresh.reason === "reconnected"
      || refresh.changes.some((change) => (
        change.table === "organization_members" && change.recordId === editedMember?.membershipId
      ))
      || refresh.changes.some((change) => change.table === "athletes" || change.table === "trainers")
    );

    if (memberChanged) {
      setRemoteChangePending(true);
      if (!editorDirty) void loadData(false);
      return;
    }

    if (editedMember && refresh.changes.some((change) => change.table === "audit_log")) {
      void loadAudit(editedMember.membershipId);
    }
    void loadData(false);
  }, [busy, editedMember, editorDirty, loadAudit, loadData, remoteSyncBusy, resendBusyId]);

  useOrganizationRealtime({
    organizationId,
    tables: USER_REALTIME_TABLES,
    enabled: isAdmin,
    onRefresh: handleRealtimeRefresh,
  });

  const filteredMembers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return members.filter((member) => {
      if (statusFilter === "active" && member.status !== "active") return false;
      if (statusFilter === "disabled" && member.status !== "disabled") return false;
      if (statusFilter === "invitation_open" && !isInvitationOpen(member)) return false;
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (accountFilter === "unlinked" && !isUnlinked(member)) return false;
      if (accountFilter === "incomplete" && member.warnings.length === 0) return false;
      if (!search) return true;
      return (
        member.displayName.toLowerCase().includes(search)
        || member.email.toLowerCase().includes(search)
        || roleNames[member.role].toLowerCase().includes(search)
        || member.linkedAthletes.some((athlete) => athlete.name.toLowerCase().includes(search))
        || member.linkedTrainerName?.toLowerCase().includes(search)
      );
    });
  }, [accountFilter, members, roleFilter, searchTerm, statusFilter]);

  const counts = useMemo(() => ({
    all: members.length,
    active: members.filter((member) => member.status === "active").length,
    invitationOpen: members.filter(isInvitationOpen).length,
    disabled: members.filter((member) => member.status === "disabled").length,
    incomplete: members.filter((member) => member.warnings.length > 0).length,
  }), [members]);

  if (!isAdmin || !organizationId) return <Navigate to="/kein-zugriff" replace />;
  const activeOrganizationId = organizationId;

  function openEditor(member: ManagedMember) {
    setError(null);
    setSuccess(null);
    setEditorDirty(false);
    setRemoteChangePending(false);
    setEditorRevision((value) => value + 1);
    setEditorMode({
      type: "edit",
      member,
      isCurrentUser: member.userId === currentUserId,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeEditor() {
    setEditorMode(null);
    setEditorDirty(false);
    setRemoteChangePending(false);
    setAuditEntries([]);
  }

  async function applyRemoteServerState(keepDraft: boolean) {
    if (!editedMember) return;
    setRemoteSyncBusy(true);
    try {
      const data = await loadData(false);
      const latest = data?.members.find((member) => member.membershipId === editedMember.membershipId);
      if (!latest) {
        closeEditor();
        setError("Der Benutzer wurde zwischenzeitlich entfernt.");
        return;
      }

      memberLock.acceptRecordVersion(latest.updatedAt);
      setEditorMode({
        type: "edit",
        member: latest,
        isCurrentUser: latest.userId === currentUserId,
      });
      if (!keepDraft) {
        setEditorRevision((value) => value + 1);
        setEditorDirty(false);
      }
      await loadAudit(latest.membershipId);
      setRemoteChangePending(false);
    } finally {
      setRemoteSyncBusy(false);
    }
  }

  async function handleEditorSubmit(values: MemberEditorSubmit) {
    if (!editorMode) return;

    setBusy(true);
    setSuccess(null);
    setError(null);
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
        await memberLock.validateBeforeSave();
        const editLock = memberLock.getWriteGuard();
        if (!editLock) throw new Error("Die Bearbeitungsreservierung fehlt.");
        const updatedAt = await updateMember({
          organizationId: activeOrganizationId,
          membershipId: editorMode.member.membershipId,
          displayName: values.displayName,
          role: values.role,
          status: values.status,
          permissions: values.permissions,
          linkedAthleteIds: values.linkedAthleteIds,
          linkedTrainerId: values.linkedTrainerId,
          editLock,
        });
        memberLock.acceptRecordVersion(updatedAt);
        setSuccess("Die Benutzerdaten wurden gespeichert.");
      }

      closeEditor();
      await loadData(false);
    } catch (submitError) {
      if (isCollaborationConflictError(submitError)) setRemoteChangePending(true);
      throw submitError;
    } finally {
      setBusy(false);
    }
  }

  async function handleResend(member: ManagedMember) {
    setResendBusyId(member.membershipId);
    setSuccess(null);
    setError(null);
    try {
      const result = await resendInvitation({
        organizationId: activeOrganizationId,
        membershipId: member.membershipId,
      });
      setSuccess(result.message);
      await loadData(false);
      if (editedMember?.membershipId === member.membershipId) {
        await loadAudit(member.membershipId);
      }
    } catch (resendError) {
      setError(errorMessage(resendError));
    } finally {
      setResendBusyId(null);
    }
  }

  return (
    <section className="user-management-page">
      <div className="management-page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Benutzerverwaltung</h1>
          <p>Benutzer einladen, Konten prüfen, Verknüpfungen und individuelle Rechte verwalten.</p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setSuccess(null);
            setEditorDirty(false);
            setEditorRevision((value) => value + 1);
            setEditorMode({ type: "invite" });
          }}
          disabled={loading || busy}
        >
          <MailPlus aria-hidden="true" /> Benutzer einladen
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <RemoteChangeNotice
        visible={remoteChangePending && Boolean(editedMember)}
        busy={busy || remoteSyncBusy}
        onLoadServer={() => applyRemoteServerState(false)}
        onKeepDraft={() => applyRemoteServerState(true)}
      />
      {editedMember && <EditLockNotice lock={memberLock} />}

      {editorMode && (
        <MemberEditor
          key={`${editorMode.type}-${editorMode.type === "edit" ? editorMode.member.membershipId : "new"}-${editorRevision}`}
          mode={editorMode}
          modules={modules}
          linkOptions={linkOptions}
          auditEntries={auditEntries}
          auditLoading={auditLoading}
          busy={busy}
          canEdit={editorMode.type === "invite" || memberLock.isEditable}
          onDirtyChange={setEditorDirty}
          onCancel={closeEditor}
          onSubmit={handleEditorSubmit}
        />
      )}

      <div className="management-toolbar user-management-toolbar e5c-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Name, E-Mail oder Verknüpfung"
            aria-label="Benutzer suchen"
          />
        </label>
        <label className="management-filter-field">
          <span>Rolle</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} aria-label="Benutzer nach Rolle filtern">
            <option value="all">Alle Rollen</option>
            <option value="admin">Administratoren</option>
            <option value="trainer">Trainer</option>
            <option value="athlete">Athleten</option>
            <option value="parent">Elternteile</option>
          </select>
        </label>
        <label className="management-filter-field">
          <span>Konto</span>
          <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}>
            <option value="all">Alle Konten</option>
            <option value="unlinked">Ohne Verknüpfung</option>
            <option value="incomplete">Mit Warnung ({counts.incomplete})</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadData()}
          disabled={loading || busy}
          title="Daten neu laden"
        >
          <RefreshCw aria-hidden="true" /><span>Aktualisieren</span>
        </button>
      </div>

      <div className="status-filter" aria-label="Benutzerstatus filtern">
        {([
          ["all", "Alle", counts.all],
          ["active", "Aktiv", counts.active],
          ["invitation_open", "Einladung offen", counts.invitationOpen],
          ["disabled", "Deaktiviert", counts.disabled],
        ] as const).map(([value, label, count]) => (
          <button
            type="button"
            className={statusFilter === value ? "active" : ""}
            onClick={() => setStatusFilter(value)}
            key={value}
          >
            {label}<span>{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Benutzer werden geladen …</div>
      ) : filteredMembers.length === 0 ? (
        <div className="empty-state">
          <UsersRound aria-hidden="true" />
          <h2>Keine Benutzer gefunden</h2>
          <p>Passe Suche oder Filter an.</p>
        </div>
      ) : (
        <div className="member-list">
          {filteredMembers.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const openInvitation = isInvitationOpen(member);
            return (
              <article className={`member-card status-${member.status}`} key={member.membershipId}>
                <div className="member-primary">
                  <div className="member-avatar" aria-hidden="true">
                    {member.displayName.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="member-name">
                    <div><h2>{member.displayName}</h2>{isCurrentUser && <span className="self-badge">Du</span>}</div>
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
                  <span className="role-badge"><ShieldCheck aria-hidden="true" />{roleNames[member.role]}</span>
                </div>

                {member.warnings.length > 0 && (
                  <div className="e5c-warning-list" role="status">
                    {member.warnings.map((warning) => (
                      <span key={warning}><TriangleAlert aria-hidden="true" />{warningNames[warning]}</span>
                    ))}
                  </div>
                )}

                <dl className="member-details e5c-member-details">
                  <div><dt>Einladung</dt><dd>{invitationNames[member.invitationStatus]}</dd></div>
                  <div><dt>Letzter Versand</dt><dd>{formatDate(member.invitationLastSentAt)}</dd></div>
                  <div><dt>Versandanzahl</dt><dd>{member.invitationSendCount}</dd></div>
                  <div><dt>Modulrechte</dt><dd>{permissionSummary(member, modules)}</dd></div>
                  <div><dt>Letzte Anmeldung</dt><dd>{formatDate(member.lastSignInAt)}</dd></div>
                  <div><dt>E-Mail bestätigt</dt><dd>{member.emailConfirmedAt ? "Ja" : "Noch nicht"}</dd></div>
                </dl>

                <div className="e5c-links">
                  <span className={member.linkedAthletes.length > 0 ? "linked" : "unlinked"}>
                    {member.linkedAthletes.length > 0 ? <Link2 aria-hidden="true" /> : <Link2Off aria-hidden="true" />}
                    Athleten: {member.linkedAthletes.length > 0
                      ? member.linkedAthletes.map((athlete) => athlete.name).join(", ")
                      : member.role === "trainer"
                        ? "über Trainingsgruppen"
                        : "nicht verknüpft"}
                  </span>
                  <span className={member.linkedTrainerId ? "linked" : "unlinked"}>
                    {member.linkedTrainerId ? <Link2 aria-hidden="true" /> : <Link2Off aria-hidden="true" />}
                    Trainer: {member.linkedTrainerName ?? "nicht verknüpft"}
                  </span>
                </div>

                <div className="e5c-card-actions">
                  {openInvitation && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleResend(member)}
                      disabled={Boolean(resendBusyId) || busy}
                    >
                      <Send aria-hidden="true" />
                      {resendBusyId === member.membershipId ? "Wird gesendet …" : "Erneut senden"}
                    </button>
                  )}
                  <button type="button" className="secondary-button member-edit-button" onClick={() => openEditor(member)}>
                    <Pencil aria-hidden="true" /> Bearbeiten
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
