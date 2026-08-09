import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Layers3,
  Mail,
  Pencil,
  Phone,
  UserRound,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { EditLockNotice } from "@/components/collaboration/EditLockNotice";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import { RemoteChangeNotice } from "@/components/collaboration/RemoteChangeNotice";
import {
  collaborationVersionsDiffer,
  isCollaborationConflictError,
} from "@/features/collaboration/conflicts";
import { useEditLock } from "@/features/collaboration/useEditLock";
import { useOrganizationRealtime } from "@/features/collaboration/useOrganizationRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import {
  createAthlete,
  createTrainer,
  createTrainingGroup,
  loadAthleteManagement,
  updateAthlete,
  updateTrainer,
  updateTrainingGroup,
} from "@/features/athletes/api";
import {
  AthleteEditor,
  type AthleteEditorMode,
} from "@/features/athletes/AthleteEditor";
import {
  TrainerEditor,
  type TrainerEditorMode,
} from "@/features/athletes/TrainerEditor";
import {
  TrainingGroupEditor,
  type TrainingGroupEditorMode,
} from "@/features/athletes/TrainingGroupEditor";
import { ManagementCreateMenu } from "@/features/athletes/ManagementCreateMenu";
import { ManagementFilterPanel } from "@/features/athletes/ManagementFilterPanel";
import { useMobileFieldReveal } from "@/features/athletes/useMobileFieldReveal";
import { useSwipeTabs } from "@/features/athletes/useSwipeTabs";
import type {
  Athlete,
  AthleteInput,
  LinkableUser,
  Trainer,
  TrainerInput,
  TrainingGroup,
  TrainingGroupInput,
} from "@/features/athletes/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/masterdata-foundation.css";
import "@/styles/management.css";
type ActiveFilter = "active" | "inactive" | "all";
type AthleteSort = "lastName" | "firstName" | "birthYearAsc" | "birthYearDesc";
type TrainerSort = "lastName" | "firstName";
type GroupSort = "name" | "shortName";
type GroupModuleFilter = "all" | "none" | "kindertraining" | "u12" | "u14";
type GroupTypeFilter = "all" | "standard" | "performance";
type ViewTab = "athletes" | "trainers" | "groups";

const VIEW_TABS = ["athletes", "trainers", "groups"] as const;

const ATHLETE_REALTIME_TABLES = ["athletes", "training_groups", "trainers"] as const;

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Stammdaten konnten nicht geladen werden.", "athlete_management");
}

function athleteName(athlete: Athlete): string {
  return `${athlete.firstName} ${athlete.lastName}`.trim();
}

function trainerName(trainer: Trainer): string {
  return `${trainer.firstName} ${trainer.lastName}`.trim();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "de-AT", { sensitivity: "base" });
}

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
  7: "So",
};

function formatWeekdays(weekdays: number[]): string {
  if (weekdays.length === 0) return "Keine Tage";
  return weekdays.map((weekday) => WEEKDAY_LABELS[weekday] ?? "?").join(", ");
}

function sortAthletes(items: Athlete[], mode: AthleteSort): Athlete[] {
  return [...items].sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;

    if (mode === "firstName") {
      return compareText(left.firstName, right.firstName) || compareText(left.lastName, right.lastName);
    }

    if (mode === "birthYearAsc" || mode === "birthYearDesc") {
      const leftYear = left.birthYear ?? (mode === "birthYearAsc" ? 9999 : -1);
      const rightYear = right.birthYear ?? (mode === "birthYearAsc" ? 9999 : -1);
      const difference = leftYear - rightYear;
      if (difference !== 0) return mode === "birthYearAsc" ? difference : -difference;
    }

    return compareText(left.lastName, right.lastName) || compareText(left.firstName, right.firstName);
  });
}

function parseInitialTab(value: string | null): ViewTab {
  return value === "groups" || value === "trainers" ? value : "athletes";
}

export function AthleteManagementPage() {
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule("athletes");
  const canEdit = canEditModule("athletes");
  const [searchParams, setSearchParams] = useSearchParams();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [linkableUsers, setLinkableUsers] = useState<LinkableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>(() => parseInitialTab(searchParams.get("tab")));
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<AthleteSort>("lastName");
  const [trainerSortMode, setTrainerSortMode] = useState<TrainerSort>("lastName");
  const [groupSortMode, setGroupSortMode] = useState<GroupSort>("name");
  const [groupModuleFilter, setGroupModuleFilter] = useState<GroupModuleFilter>("all");
  const [groupTypeFilter, setGroupTypeFilter] = useState<GroupTypeFilter>("all");
  const [athleteEditor, setAthleteEditor] = useState<AthleteEditorMode | null>(null);
  const [groupEditor, setGroupEditor] = useState<TrainingGroupEditorMode | null>(null);
  const [trainerEditor, setTrainerEditor] = useState<TrainerEditorMode | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [remoteChangePending, setRemoteChangePending] = useState(false);
  const [remoteSyncBusy, setRemoteSyncBusy] = useState(false);
  const editorOpen = Boolean(athleteEditor || groupEditor || trainerEditor);
  const revealFocusedField = useMobileFieldReveal();

  const editedAthlete = athleteEditor?.type === "edit" ? athleteEditor.athlete : null;
  const editedGroup = groupEditor?.type === "edit" ? groupEditor.group : null;
  const editedTrainer = trainerEditor?.type === "edit" ? trainerEditor.trainer : null;

  const athleteLock = useEditLock({
    organizationId,
    entityType: "athlete",
    entityId: editedAthlete?.id,
    expectedUpdatedAt: editedAthlete?.updatedAt ?? null,
    enabled: canEdit && Boolean(editedAthlete?.id),
  });
  const groupLock = useEditLock({
    organizationId,
    entityType: "training_group",
    entityId: editedGroup?.id,
    expectedUpdatedAt: editedGroup?.updatedAt ?? null,
    enabled: canEdit && Boolean(editedGroup?.id),
  });
  const trainerLock = useEditLock({
    organizationId,
    entityType: "trainer",
    entityId: editedTrainer?.id,
    expectedUpdatedAt: editedTrainer?.updatedAt ?? null,
    enabled: canEdit && Boolean(editedTrainer?.id),
  });

  useNavigationGuard(editorOpen && editorDirty
    ? () => window.confirm("Ungespeicherte Änderungen verwerfen?")
    : null);

  useEffect(() => {
    document.body.classList.toggle("management-editor-active", editorOpen);
    return () => document.body.classList.remove("management-editor-active");
  }, [editorOpen]);

  useEffect(() => {
    if (!editorOpen || !editorDirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [editorDirty, editorOpen]);

  useEffect(() => {
    const versionMismatch =
      collaborationVersionsDiffer(editedAthlete?.updatedAt, athleteLock.recordVersion)
      || collaborationVersionsDiffer(editedGroup?.updatedAt, groupLock.recordVersion)
      || collaborationVersionsDiffer(editedTrainer?.updatedAt, trainerLock.recordVersion);
    if (versionMismatch) setRemoteChangePending(true);
  }, [
    athleteLock.recordVersion,
    editedAthlete?.updatedAt,
    editedGroup?.updatedAt,
    editedTrainer?.updatedAt,
    groupLock.recordVersion,
    trainerLock.recordVersion,
  ]);

  const athleteEditorCanEdit = canEdit && (!editedAthlete || athleteLock.isEditable);
  const groupEditorCanEdit = canEdit && (!editedGroup || groupLock.isEditable);
  const trainerEditorCanEdit = canEdit && (!editedTrainer || trainerLock.isEditable);

  const loadData = useCallback(async (showLoading = true) => {
    if (!organizationId || !canView) return null;

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await loadAthleteManagement(organizationId, canEdit);
      setAthletes(data.athletes);
      setGroups(data.groups);
      setTrainers(data.trainers);
      setLinkableUsers(data.linkableUsers);
      return data;
    } catch (loadError) {
      setError(errorMessage(loadError));
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [canEdit, canView, organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRealtimeRefresh = useCallback((refresh: {
    reason: "database" | "reconnected";
    changes: Array<{ table: string; recordId: string | null }>;
  }) => {
    if (busy || remoteSyncBusy) return;
    const currentChanged = refresh.reason === "reconnected" || refresh.changes.some((change) => (
      (editedAthlete && change.table === "athletes" && change.recordId === editedAthlete.id)
      || (editedGroup && change.table === "training_groups" && change.recordId === editedGroup.id)
      || (editedTrainer && change.table === "trainers" && change.recordId === editedTrainer.id)
    ));
    if (currentChanged && (editedAthlete || editedGroup || editedTrainer)) {
      setRemoteChangePending(true);
      return;
    }
    void loadData(false);
  }, [busy, editedAthlete, editedGroup, editedTrainer, loadData, remoteSyncBusy]);

  const realtimeStatus = useOrganizationRealtime({
    organizationId,
    tables: ATHLETE_REALTIME_TABLES,
    enabled: canView,
    onRefresh: handleRealtimeRefresh,
  });

  const filteredAthletes = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de-AT");
    const filtered = athletes.filter((athlete) => {
      if (activeFilter === "active" && !athlete.isActive) return false;
      if (activeFilter === "inactive" && athlete.isActive) return false;
      if (groupFilter !== "all" && !athlete.groups.some((group) => group.id === groupFilter)) {
        return false;
      }
      if (!search) return true;

      const searchable = [
        athlete.firstName,
        athlete.lastName,
        athlete.birthYear?.toString() ?? "",
        athlete.notes ?? "",
        ...athlete.groups.flatMap((group) => [group.name, group.shortName ?? ""]),
        ...athlete.contacts.flatMap((contact) => [
          contact.contactName,
          contact.relationship,
          contact.phone,
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase("de-AT");

      return searchable.includes(search);
    });

    return sortAthletes(filtered, sortMode);
  }, [activeFilter, athletes, groupFilter, searchTerm, sortMode]);

  const filteredGroups = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de-AT");
    return groups
      .filter((group) => {
        if (activeFilter === "active" && !group.isActive) return false;
        if (activeFilter === "inactive" && group.isActive) return false;
        if (groupModuleFilter === "none" && group.moduleKey !== null) return false;
        if (
          groupModuleFilter !== "all"
          && groupModuleFilter !== "none"
          && group.moduleKey !== groupModuleFilter
        ) return false;
        if (groupTypeFilter === "performance" && !group.isPerformanceGroup) return false;
        if (groupTypeFilter === "standard" && group.isPerformanceGroup) return false;
        if (!search) return true;
        return [
          group.name,
          group.shortName ?? "",
          group.description ?? "",
          group.moduleKey ?? "",
          formatWeekdays(group.regularWeekdays),
        ]
          .join(" ")
          .toLocaleLowerCase("de-AT")
          .includes(search);
      })
      .sort((left, right) => (
        groupSortMode === "shortName"
          ? compareText(left.shortName ?? left.name, right.shortName ?? right.name)
          : compareText(left.name, right.name)
      ));
  }, [activeFilter, groupModuleFilter, groupSortMode, groupTypeFilter, groups, searchTerm]);

  const filteredTrainers = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de-AT");
    return trainers
      .filter((trainer) => {
        if (activeFilter === "active" && !trainer.isActive) return false;
        if (activeFilter === "inactive" && trainer.isActive) return false;
        if (groupFilter !== "all" && !trainer.groupIds.includes(groupFilter)) return false;
        if (!search) return true;
        return [
          trainer.firstName,
          trainer.lastName,
          trainer.phone ?? "",
          trainer.email ?? "",
          trainer.notes ?? "",
          ...trainer.groupIds.map((groupId) => groups.find((group) => group.id === groupId)?.name ?? ""),
        ]
          .join(" ")
          .toLocaleLowerCase("de-AT")
          .includes(search);
      })
      .sort((left, right) => (
        trainerSortMode === "firstName"
          ? compareText(left.firstName, right.firstName) || compareText(left.lastName, right.lastName)
          : compareText(left.lastName, right.lastName) || compareText(left.firstName, right.firstName)
      ));
  }, [activeFilter, groupFilter, groups, searchTerm, trainerSortMode, trainers]);



  if (!canView || !organizationId) return <Navigate to="/kein-zugriff" replace />;
  const activeOrganizationId = organizationId;

  function closeEditors() {
    setAthleteEditor(null);
    setGroupEditor(null);
    setTrainerEditor(null);
    setEditorDirty(false);
    setRemoteChangePending(false);
  }

  function requestCloseEditors() {
    if (editorDirty && !window.confirm("Ungespeicherte Änderungen verwerfen?")) return;
    closeEditors();
  }

  async function applyRemoteServerState(keepDraft: boolean) {
    const athleteId = editedAthlete?.id ?? null;
    const groupId = editedGroup?.id ?? null;
    const trainerId = editedTrainer?.id ?? null;
    if (!athleteId && !groupId && !trainerId) {
      setRemoteChangePending(false);
      await loadData(false);
      return;
    }

    setRemoteSyncBusy(true);
    setError(null);
    if (!keepDraft) {
      setAthleteEditor(null);
      setGroupEditor(null);
      setTrainerEditor(null);
      setEditorDirty(false);
    }

    try {
      const latest = await loadData(false);
      if (!latest) return;

      if (athleteId) {
        const athlete = latest.athletes.find((item) => item.id === athleteId);
        if (!athlete) throw new Error("Der Athlet wurde auf einem anderen Gerät gelöscht.");
        setAthleteEditor({ type: "edit", athlete });
        if (keepDraft) await athleteLock.retry();
        athleteLock.acceptRecordVersion(athlete.updatedAt);
      } else if (groupId) {
        const group = latest.groups.find((item) => item.id === groupId);
        if (!group) throw new Error("Die Trainingsgruppe wurde auf einem anderen Gerät gelöscht.");
        setGroupEditor({ type: "edit", group });
        if (keepDraft) await groupLock.retry();
        groupLock.acceptRecordVersion(group.updatedAt);
      } else if (trainerId) {
        const trainer = latest.trainers.find((item) => item.id === trainerId);
        if (!trainer) throw new Error("Der Trainer wurde auf einem anderen Gerät gelöscht.");
        setTrainerEditor({ type: "edit", trainer });
        if (keepDraft) await trainerLock.retry();
        trainerLock.acceptRecordVersion(trainer.updatedAt);
      }

      setRemoteChangePending(false);
      if (keepDraft && editorDirty) {
        setSuccess("Die aktuelle Serverversion wurde übernommen. Deine Eingaben bleiben im Formular erhalten.");
      }
    } catch (remoteError) {
      closeEditors();
      setError(errorMessage(remoteError));
    } finally {
      setRemoteSyncBusy(false);
    }
  }

  function resetFilters(targetTab: ViewTab = tab) {
    setActiveFilter("active");
    setGroupFilter("all");
    setSortMode("lastName");
    setTrainerSortMode("lastName");
    setGroupSortMode("name");
    setGroupModuleFilter("all");
    setGroupTypeFilter("all");
    if (targetTab !== tab) setSearchTerm("");
  }

  function switchTab(nextTab: ViewTab) {
    if (nextTab === tab) return;
    setTab(nextTab);
    setSearchTerm("");
    setFiltersOpen(false);
    resetFilters(nextTab);
    closeEditors();
    setSearchParams(nextTab === "athletes" ? {} : { tab: nextTab }, { replace: true });
  }

  function openCreateEditor(targetTab: ViewTab) {
    setSuccess(null);
    setTab(targetTab);
    setSearchTerm("");
    setFiltersOpen(false);
    resetFilters(targetTab);
    setSearchParams(targetTab === "athletes" ? {} : { tab: targetTab }, { replace: true });
    closeEditors();
    if (targetTab === "athletes") setAthleteEditor({ type: "create" });
    if (targetTab === "groups") setGroupEditor({ type: "create" });
    if (targetTab === "trainers") setTrainerEditor({ type: "create" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleAthleteSubmit(values: AthleteInput) {
    if (!athleteEditor) return;

    setBusy(true);
    setSuccess(null);
    try {
      if (athleteEditor.type === "create") {
        await createAthlete(activeOrganizationId, values);
        setSuccess("Der Athlet wurde angelegt.");
      } else {
        const editLock = athleteLock.getWriteGuard();
        await updateAthlete(activeOrganizationId, athleteEditor.athlete.id, values, editLock);
        setSuccess("Die Athletendaten wurden gespeichert.");
      }
      setAthleteEditor(null);
      setEditorDirty(false);
      setRemoteChangePending(false);
      await loadData();
    } catch (saveError) {
      if (isCollaborationConflictError(saveError)) setRemoteChangePending(true);
      throw saveError;
    } finally {
      setBusy(false);
    }
  }

  async function handleGroupSubmit(values: TrainingGroupInput) {
    if (!groupEditor) return;

    setBusy(true);
    setSuccess(null);
    try {
      if (groupEditor.type === "create") {
        await createTrainingGroup(activeOrganizationId, values);
        setSuccess("Die Trainingsgruppe wurde angelegt.");
      } else {
        const editLock = groupLock.getWriteGuard();
        await updateTrainingGroup(activeOrganizationId, groupEditor.group.id, values, editLock);
        setSuccess("Die Trainingsgruppe wurde gespeichert.");
      }
      setGroupEditor(null);
      setEditorDirty(false);
      setRemoteChangePending(false);
      await loadData();
    } catch (saveError) {
      if (isCollaborationConflictError(saveError)) setRemoteChangePending(true);
      throw saveError;
    } finally {
      setBusy(false);
    }
  }

  async function handleTrainerSubmit(values: TrainerInput) {
    if (!trainerEditor) return;

    setBusy(true);
    setSuccess(null);
    try {
      if (trainerEditor.type === "create") {
        await createTrainer(activeOrganizationId, values);
        setSuccess("Der Trainer wurde angelegt.");
      } else {
        const editLock = trainerLock.getWriteGuard();
        await updateTrainer(activeOrganizationId, trainerEditor.trainer.id, values, editLock);
        setSuccess("Die Trainerdaten wurden gespeichert.");
      }
      setTrainerEditor(null);
      setEditorDirty(false);
      setRemoteChangePending(false);
      await loadData();
    } catch (saveError) {
      if (isCollaborationConflictError(saveError)) setRemoteChangePending(true);
      throw saveError;
    } finally {
      setBusy(false);
    }
  }

  const searchLabel = tab === "athletes"
    ? "Athlet suchen"
    : tab === "groups"
      ? "Gruppe suchen"
      : "Trainer suchen";

  const activeFilterCount = tab === "athletes"
    ? Number(activeFilter !== "active") + Number(groupFilter !== "all") + Number(sortMode !== "lastName")
    : tab === "groups"
      ? Number(activeFilter !== "active")
        + Number(groupModuleFilter !== "all")
        + Number(groupTypeFilter !== "all")
        + Number(groupSortMode !== "name")
      : Number(activeFilter !== "active")
        + Number(groupFilter !== "all")
        + Number(trainerSortMode !== "lastName");

  const swipeTabs = useSwipeTabs({
    tabs: VIEW_TABS,
    activeTab: tab,
    onChange: switchTab,
    enabled: !editorOpen,
  });

  return (
    <section className="athlete-management-page" data-realtime-status={realtimeStatus} onFocusCapture={revealFocusedField}>
      {!canEdit && (
        <div className="read-only-notice">
          Du besitzt für dieses Modul Leserechte. Änderungen sind nur mit Bearbeitungsrecht möglich.
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <RemoteChangeNotice
        visible={remoteChangePending}
        busy={busy || remoteSyncBusy}
        onLoadServer={() => applyRemoteServerState(false)}
        onKeepDraft={() => applyRemoteServerState(true)}
      />

      {athleteEditor && (
        <AthleteEditor
          key={athleteEditor.type === "create" ? "new-athlete" : `athlete-${athleteEditor.athlete.id}`}
          mode={athleteEditor}
          groups={groups}
          linkableUsers={linkableUsers}
          busy={busy}
          canEdit={athleteEditorCanEdit}
          lockNotice={editedAthlete ? <EditLockNotice lock={athleteLock} /> : null}
          onCancel={requestCloseEditors}
          onSubmit={handleAthleteSubmit}
          onDirtyChange={setEditorDirty}
        />
      )}

      {groupEditor && (
        <TrainingGroupEditor
          key={groupEditor.type === "create" ? "new-group" : `group-${groupEditor.group.id}`}
          mode={groupEditor}
          busy={busy}
          canEdit={groupEditorCanEdit}
          lockNotice={editedGroup ? <EditLockNotice lock={groupLock} /> : null}
          onCancel={requestCloseEditors}
          onSubmit={handleGroupSubmit}
          onDirtyChange={setEditorDirty}
        />
      )}

      {trainerEditor && (
        <TrainerEditor
          key={trainerEditor.type === "create" ? "new-trainer" : `trainer-${trainerEditor.trainer.id}`}
          mode={trainerEditor}
          groups={groups}
          linkableUsers={linkableUsers}
          busy={busy}
          canEdit={trainerEditorCanEdit}
          lockNotice={editedTrainer ? <EditLockNotice lock={trainerLock} /> : null}
          onCancel={requestCloseEditors}
          onSubmit={handleTrainerSubmit}
          onDirtyChange={setEditorDirty}
        />
      )}

      {!editorOpen && (
        <div className="masterdata-tab-surface" data-testid="masterdata-tab-surface" {...swipeTabs}>
          <div className="masterdata-sticky-zone">
            <div className="management-page-heading compact-management-heading">
              <div>
                <p className="eyebrow">Gemeinsame Stammdaten</p>
                <h1>Athleten, Trainer &amp; Gruppen</h1>
              </div>
              {canEdit && (
                <ManagementCreateMenu
                  disabled={loading || busy}
                  onCreate={openCreateEditor}
                />
              )}
            </div>

            <div className="management-tabs three-tabs ui-tabs" role="tablist" aria-label="Stammdatenbereich">
              <button type="button" role="tab" aria-selected={tab === "athletes"} className={tab === "athletes" ? "active" : ""} onClick={() => switchTab("athletes")}>
                <UserRound aria-hidden="true" /> Athleten <span>{athletes.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === "trainers"} className={tab === "trainers" ? "active" : ""} onClick={() => switchTab("trainers")}>
                <UserRoundCog aria-hidden="true" /> Trainer <span>{trainers.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === "groups"} className={tab === "groups" ? "active" : ""} onClick={() => switchTab("groups")}>
                <Layers3 aria-hidden="true" /> Gruppen <span>{groups.length}</span>
              </button>
            </div>

            <ManagementFilterPanel
            searchLabel={searchLabel}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            open={filtersOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFiltersOpen((current) => !current)}
            onRefresh={() => void loadData()}
            refreshDisabled={loading || busy}
            onReset={() => resetFilters()}
          >
            <div className="masterdata-filter-grid">
              {tab === "athletes" && (
                <>
                  <label className="masterdata-filter-field ui-labeled-field">
                    <span className="ui-field-label">Gruppe</span>
                    <select className="ui-field-control" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} aria-label="Athleten nach Trainingsgruppe filtern">
                      <option value="all">Alle Gruppen</option>
                      {groups.map((group) => (
                        <option value={group.id} key={group.id}>{group.name}{group.isActive ? "" : " (inaktiv)"}</option>
                      ))}
                    </select>
                  </label>
                  <label className="masterdata-filter-field ui-labeled-field">
                    <span className="ui-field-label">Sortierung</span>
                    <select className="ui-field-control" value={sortMode} onChange={(event) => setSortMode(event.target.value as AthleteSort)} aria-label="Athleten sortieren">
                      <option value="lastName">Nachname A–Z</option>
                      <option value="firstName">Vorname A–Z</option>
                      <option value="birthYearAsc">Jahrgang ↑</option>
                      <option value="birthYearDesc">Jahrgang ↓</option>
                    </select>
                  </label>
                </>
              )}

              {tab === "groups" && (
                <>
                  <label className="masterdata-filter-field ui-labeled-field">
                    <span className="ui-field-label">Trainingsmodul</span>
                    <select className="ui-field-control" value={groupModuleFilter} onChange={(event) => setGroupModuleFilter(event.target.value as GroupModuleFilter)} aria-label="Gruppen nach Trainingsmodul filtern">
                      <option value="all">Alle Module</option>
                      <option value="none">Ohne Modul</option>
                      <option value="kindertraining">Kindertraining</option>
                      <option value="u12">U12</option>
                      <option value="u14">U14</option>
                    </select>
                  </label>
                  <label className="masterdata-filter-field ui-labeled-field">
                    <span className="ui-field-label">Gruppentyp</span>
                    <select className="ui-field-control" value={groupTypeFilter} onChange={(event) => setGroupTypeFilter(event.target.value as GroupTypeFilter)} aria-label="Gruppen nach Typ filtern">
                      <option value="all">Alle Gruppen</option>
                      <option value="standard">Standardgruppen</option>
                      <option value="performance">Leistungsgruppen</option>
                    </select>
                  </label>
                  <label className="masterdata-filter-field ui-labeled-field">
                    <span className="ui-field-label">Sortierung</span>
                    <select className="ui-field-control" value={groupSortMode} onChange={(event) => setGroupSortMode(event.target.value as GroupSort)} aria-label="Gruppen sortieren">
                      <option value="name">Name A–Z</option>
                      <option value="shortName">Kurzname A–Z</option>
                    </select>
                  </label>
                </>
              )}

              {tab === "trainers" && (
                <>
                  <label className="masterdata-filter-field ui-labeled-field">
                    <span className="ui-field-label">Gruppe</span>
                    <select className="ui-field-control" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} aria-label="Trainer nach Trainingsgruppe filtern">
                      <option value="all">Alle Gruppen</option>
                      {groups.map((group) => (
                        <option value={group.id} key={group.id}>{group.name}{group.isActive ? "" : " (inaktiv)"}</option>
                      ))}
                    </select>
                  </label>
                  <label className="masterdata-filter-field ui-labeled-field">
                    <span className="ui-field-label">Sortierung</span>
                    <select className="ui-field-control" value={trainerSortMode} onChange={(event) => setTrainerSortMode(event.target.value as TrainerSort)} aria-label="Trainer sortieren">
                      <option value="lastName">Nachname A–Z</option>
                      <option value="firstName">Vorname A–Z</option>
                    </select>
                  </label>
                </>
              )}
            </div>

            <div className="status-filter masterdata-status-filter" aria-label="Status filtern">
              {([['active', 'Aktiv'], ['inactive', 'Inaktiv'], ['all', 'Alle']] as const).map(([value, label]) => (
                <button type="button" className={activeFilter === value ? "active" : ""} onClick={() => setActiveFilter(value)} key={value}>{label}</button>
              ))}
            </div>
            </ManagementFilterPanel>
          </div>

          {loading ? (
            <div className="management-loading"><div className="spinner" aria-hidden="true" /> Stammdaten werden geladen …</div>
          ) : tab === "athletes" ? (
            filteredAthletes.length === 0 ? (
              <div className="empty-state"><UserRound aria-hidden="true" /><h2>Keine Athleten gefunden</h2><p>Passe Suche oder Filter an oder lege den ersten Athleten an.</p></div>
            ) : (
              <div className="athlete-list">
                {filteredAthletes.map((athlete) => (
                  <article className={`athlete-card ${athlete.isActive ? "" : "inactive"}`} key={athlete.id} data-testid="masterdata-athlete-card">
                    <div className="athlete-identity">
                      <div className="athlete-avatar" aria-hidden="true">{athlete.firstName.charAt(0).toUpperCase()}{athlete.lastName.charAt(0).toUpperCase()}</div>
                      <div><h2>{athleteName(athlete)}</h2><p>{athlete.birthYear ? `Jahrgang ${athlete.birthYear}` : "Kein Geburtsjahr"}</p></div>
                    </div>

                    <div className="athlete-groups">
                      {athlete.groups.length > 0 ? athlete.groups.map((group) => (
                        <span className={group.isActive ? "" : "inactive"} key={group.id}>{group.shortName || group.name}</span>
                      )) : <span className="unassigned">Keine Gruppe</span>}
                      {athlete.contacts.some((contact) => contact.isEmergency) && (
                        <span className="emergency-contact-badge"><Phone aria-hidden="true" /> Notfallkontakt</span>
                      )}
                    </div>

                    {athlete.notes && <div className="athlete-notes">{athlete.notes}</div>}

                    <div className="athlete-card-top-actions">
                      <span className={`athlete-status-dot ${athlete.isActive ? "active" : "inactive"}`} role="status" aria-label={athlete.isActive ? "Athlet aktiv" : "Athlet inaktiv"} title={athlete.isActive ? "Aktiv" : "Inaktiv"} />
                      {canEdit && (
                        <button type="button" className="icon-button athlete-edit-button" onClick={() => { setSuccess(null); closeEditors(); setAthleteEditor({ type: "edit", athlete }); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`${athleteName(athlete)} bearbeiten`} title="Bearbeiten" data-testid="masterdata-athlete-edit">
                          <Pencil aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : tab === "groups" ? (
            filteredGroups.length === 0 ? (
              <div className="empty-state"><Layers3 aria-hidden="true" /><h2>Keine Trainingsgruppen gefunden</h2><p>Lege die erste Gruppe an oder passe den Statusfilter an.</p></div>
            ) : (
              <div className="training-group-grid">
                {filteredGroups.map((group) => (
                  <article className={`training-group-card compact-group-card ${group.isActive ? "" : "inactive"}`} key={group.id} data-testid="masterdata-group-card">
                    <div className="training-group-card-heading">
                      <div className="group-icon" aria-hidden="true"><UsersRound /></div>
                      <div>
                        <h2>{group.name}</h2>
                        <p>
                          {[
                            group.shortName,
                            group.moduleKey === "kindertraining"
                              ? "Kindertraining"
                              : group.moduleKey === "u12"
                                ? "U12"
                                : group.moduleKey === "u14"
                                  ? "U14"
                                  : null,
                            group.isPerformanceGroup ? "Leistungsgruppe" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    {group.description && <p className="training-group-description">{group.description}</p>}
                    <dl className="training-group-details">
                      <div><dt>Athleten</dt><dd>{group.athleteCount}</dd></div>
                      <div><dt>Trainingstage</dt><dd>{formatWeekdays(group.regularWeekdays)}</dd></div>
                      <div><dt>Status</dt><dd>{group.isActive ? "Aktiv" : "Inaktiv"}</dd></div>
                      {group.isPerformanceGroup && (
                        <div>
                          <dt>Anmeldeschluss</dt>
                          <dd>{WEEKDAY_LABELS[group.registrationDeadlineWeekday]} {group.registrationDeadlineTime}</dd>
                        </div>
                      )}
                      {group.moduleKey !== null && (
                        <div>
                          <dt>Sondertraining</dt>
                          <dd>{group.allowSpecialTraining ? "Erlaubt" : "Deaktiviert"}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="training-group-card-top-actions">
                      <span className={`athlete-status-dot ${group.isActive ? "active" : "inactive"}`} role="status" aria-label={group.isActive ? "Gruppe aktiv" : "Gruppe inaktiv"} title={group.isActive ? "Aktiv" : "Inaktiv"} />
                      {canEdit && (
                        <button type="button" className="icon-button" onClick={() => { setSuccess(null); closeEditors(); setGroupEditor({ type: "edit", group }); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`${group.name} bearbeiten`} title="Bearbeiten" data-testid="masterdata-group-edit">
                          <Pencil aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : filteredTrainers.length === 0 ? (
            <div className="empty-state"><UserRoundCog aria-hidden="true" /><h2>Keine Trainer gefunden</h2><p>Lege Trainer an, damit sie bei den Trainings ausgewählt werden können.</p></div>
          ) : (
            <div className="trainer-grid">
              {filteredTrainers.map((trainer) => (
                <article className={`trainer-card ${trainer.isActive ? "" : "inactive"}`} key={trainer.id} data-testid="masterdata-trainer-card">
                  <div className="trainer-card-heading">
                    <div className="trainer-avatar" aria-hidden="true">{trainer.firstName.charAt(0).toUpperCase()}{trainer.lastName.charAt(0).toUpperCase()}</div>
                    <div><h2>{trainerName(trainer)}</h2><p>{trainer.isActive ? "Aktiv" : "Inaktiv"}</p></div>
                  </div>
                  <div className="trainer-contact-lines">
                    {trainer.phone && <a href={`tel:${trainer.phone}`}><Phone aria-hidden="true" />{trainer.phone}</a>}
                    {trainer.email && <a href={`mailto:${trainer.email}`}><Mail aria-hidden="true" />{trainer.email}</a>}
                    {!trainer.phone && !trainer.email && <span>Keine Kontaktdaten</span>}
                  </div>
                  <div className="trainer-group-chips">
                    {trainer.groupIds.length > 0 ? trainer.groupIds.map((groupId) => {
                      const group = groups.find((item) => item.id === groupId);
                      return group ? <span className={group.isActive ? "" : "inactive"} key={groupId}>{group.shortName || group.name}</span> : null;
                    }) : <span className="unassigned">Keine Trainingsgruppe</span>}
                  </div>
                  {trainer.notes && <p className="trainer-notes">{trainer.notes}</p>}
                  {canEdit && (
                    <button type="button" className="icon-button trainer-edit-button" onClick={() => { setSuccess(null); closeEditors(); setTrainerEditor({ type: "edit", trainer }); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`${trainerName(trainer)} bearbeiten`} title="Bearbeiten" data-testid="masterdata-trainer-edit">
                      <Pencil aria-hidden="true" />
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
