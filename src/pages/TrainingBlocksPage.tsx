import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  GitBranchPlus,
  GitCompareArrows,
  History,
  Filter,
  Info,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { EditLockNotice } from "@/components/collaboration/EditLockNotice";
import { RemoteChangeNotice } from "@/components/collaboration/RemoteChangeNotice";
import {
  collaborationVersionsDiffer,
  isCollaborationConflictError,
} from "@/features/collaboration/conflicts";
import { useCoalescedAsyncRefresh } from "@/features/collaboration/useCoalescedAsyncRefresh";
import { useEditLock } from "@/features/collaboration/useEditLock";
import { useOrganizationRealtime } from "@/features/collaboration/useOrganizationRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import {
  createTrainingBlockVariant,
  deleteTrainingBlock,
  loadTrainingBlocks,
  saveTrainingBlock,
  setTrainingBlockFavorite,
} from "@/features/training-blocks/api";
import { TrainingBlockCompareDialog } from "@/features/training-blocks/TrainingBlockCompareDialog";
import { TrainingBlockEditor } from "@/features/training-blocks/TrainingBlockEditor";
import { TrainingBlockExerciseInfoDialog } from "@/features/training-blocks/TrainingBlockExerciseInfoDialog";
import { TrainingBlockVersionHistory } from "@/features/training-blocks/TrainingBlockVersionHistory";
import type {
  TrainingBlock,
  TrainingBlockData,
  TrainingBlockExercise,
  TrainingBlockInput,
} from "@/features/training-blocks/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/training-blocks.css";
import "@/styles/training-blocks-mobile.css";
type ActivityFilter = "active" | "inactive" | "all";
type SortMode = "name" | "usage" | "updated" | "last_used";
type UsageFilter = "all" | "unused" | "used";
type DurationFilter = "all" | "none" | "short" | "medium" | "long" | "very_long";

const TRAINING_BLOCK_REALTIME_TABLES = ["training_blocks", "training_block_user_favorites"] as const;

function formatItemValues(item: TrainingBlock["items"][number]): string {
  return item.parameters.map((parameter) => {
    const value = item.parameterValues[parameter.key]?.trim() || parameter.defaultValue.trim();
    const formattedValue = value
      ? `${value}${parameter.unit ? ` ${parameter.unit}` : ""}`
      : "–";
    return `${parameter.label}: ${formattedValue}`;
  }).join(" · ");
}

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Trainingsblöcke konnten nicht geladen werden.", "training_blocks");
}

function durationMatches(minutes: number | null, filter: DurationFilter): boolean {
  if (filter === "all") return true;
  if (filter === "none") return minutes === null;
  if (minutes === null) return false;
  if (filter === "short") return minutes <= 15;
  if (filter === "medium") return minutes >= 16 && minutes <= 30;
  if (filter === "long") return minutes >= 31 && minutes <= 60;
  return minutes > 60;
}

function formatUsageDate(value: string | null): string {
  if (!value) return "Noch nie";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

export function TrainingBlocksPage() {
  const { appContext, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canEdit = canEditModule("training_blocks");

  const [data, setData] = useState<TrainingBlockData>({ groups: [], exercises: [], blocks: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupFilter, setGroupFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [exerciseFilter, setExerciseFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("active");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [compareBlockIds, setCompareBlockIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandedBlockIds, setExpandedBlockIds] = useState<Set<string>>(() => new Set());
  const [editorBlock, setEditorBlock] = useState<TrainingBlock | null | undefined>(undefined);
  const [infoExercise, setInfoExercise] = useState<TrainingBlockExercise | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [remoteChangePending, setRemoteChangePending] = useState(false);
  const [remoteSyncBusy, setRemoteSyncBusy] = useState(false);

  const blockLock = useEditLock({
    organizationId,
    entityType: "training_block",
    entityId: editorBlock?.id,
    expectedUpdatedAt: editorBlock?.updatedAt ?? null,
    enabled: canEdit && Boolean(editorBlock?.id),
  });
  const editorCanEdit = canEdit && (!editorBlock?.id || blockLock.isEditable);

  useEffect(() => {
    if (collaborationVersionsDiffer(editorBlock?.updatedAt, blockLock.recordVersion)) {
      setRemoteChangePending(true);
    }
  }, [blockLock.recordVersion, editorBlock?.updatedAt]);

  const loadData = useCallback(async (showLoading = true): Promise<TrainingBlockData | null> => {
    if (!organizationId) return null;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const next = await loadTrainingBlocks(organizationId, true);
      setData(next);
      return next;
    } catch (loadError) {
      setError(errorMessage(loadError));
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const scheduleRealtimeReload = useCoalescedAsyncRefresh(
    () => loadData(false),
    400,
  );

  const handleRealtimeRefresh = useCallback((refresh: {
    reason: "database" | "reconnected";
    changes: Array<{ table: string; recordId: string | null }>;
  }) => {
    if (busy || busyBlockId || remoteSyncBusy) return;
    const currentChanged = Boolean(editorBlock?.id) && (
      refresh.reason === "reconnected"
      || refresh.changes.some((change) => (
        change.table === "training_blocks" && change.recordId === editorBlock?.id
      ))
    );
    if (currentChanged) {
      setRemoteChangePending(true);
      return;
    }
    scheduleRealtimeReload();
  }, [busy, busyBlockId, editorBlock?.id, remoteSyncBusy, scheduleRealtimeReload]);

  useOrganizationRealtime({
    organizationId,
    tables: TRAINING_BLOCK_REALTIME_TABLES,
    onRefresh: handleRealtimeRefresh,
  });

  const groupById = useMemo(() => new Map(data.groups.map((group) => [group.id, group])), [data.groups]);
  const exerciseById = useMemo(() => new Map(data.exercises.map((exercise) => [exercise.id, exercise])), [data.exercises]);

  const categories = useMemo(() => [...new Map(data.exercises.map((exercise) => [exercise.categoryKey, exercise.categoryTitle])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], "de")), [data.exercises]);
  const subcategories = useMemo(() => [...new Set(data.exercises.flatMap((exercise) => exercise.subcategory ? [exercise.subcategory] : []))]
    .sort((left, right) => left.localeCompare(right, "de")), [data.exercises]);
  const materials = useMemo(() => [...new Set(data.exercises.flatMap((exercise) => exercise.equipment))]
    .sort((left, right) => left.localeCompare(right, "de")), [data.exercises]);

  const counts = useMemo(() => ({
    active: data.blocks.filter((block) => block.isActive).length,
    inactive: data.blocks.filter((block) => !block.isActive).length,
    favorites: data.blocks.filter((block) => block.isFavorite).length,
  }), [data.blocks]);

  const activeFilterCount = [
    groupFilter !== "all",
    categoryFilter !== "all",
    subcategoryFilter !== "all",
    materialFilter !== "all",
    exerciseFilter !== "all",
    usageFilter !== "all",
    durationFilter !== "all",
    activityFilter !== "active",
    sortMode !== "name",
    favoritesOnly,
  ].filter(Boolean).length;

  const filteredBlocks = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de");
    return data.blocks
      .filter((block) => {
        const exercises = block.items.flatMap((item) => {
          const exercise = exerciseById.get(item.exerciseId);
          return exercise ? [exercise] : [];
        });

        if (activityFilter === "active" && !block.isActive) return false;
        if (activityFilter === "inactive" && block.isActive) return false;
        if (favoritesOnly && !block.isFavorite) return false;
        if (groupFilter === "club" && block.groupIds.length > 0) return false;
        if (groupFilter !== "all" && groupFilter !== "club" && block.groupIds.length > 0 && !block.groupIds.includes(groupFilter)) return false;
        if (categoryFilter !== "all" && !exercises.some((exercise) => exercise.categoryKey === categoryFilter)) return false;
        if (subcategoryFilter !== "all" && !exercises.some((exercise) => exercise.subcategory === subcategoryFilter)) return false;
        if (materialFilter !== "all" && !exercises.some((exercise) => exercise.equipment.includes(materialFilter))) return false;
        if (exerciseFilter !== "all" && !block.items.some((item) => item.exerciseId === exerciseFilter)) return false;
        if (usageFilter === "unused" && block.usageCount !== 0) return false;
        if (usageFilter === "used" && block.usageCount === 0) return false;
        if (!durationMatches(block.estimatedMinutes, durationFilter)) return false;
        if (!search) return true;

        return [
          block.name,
          block.goal ?? "",
          block.description ?? "",
          ...block.items.map((item) => item.exerciseName),
          ...exercises.flatMap((exercise) => [exercise.categoryTitle, exercise.subcategory ?? "", ...exercise.equipment]),
        ].some((value) => value.toLocaleLowerCase("de").includes(search));
      })
      .sort((left, right) => {
        if (left.isFavorite !== right.isFavorite) return left.isFavorite ? -1 : 1;
        if (sortMode === "usage") return right.usageCount - left.usageCount || left.name.localeCompare(right.name, "de");
        if (sortMode === "updated") return right.updatedAt.localeCompare(left.updatedAt);
        if (sortMode === "last_used") return (right.lastUsedAt ?? "").localeCompare(left.lastUsedAt ?? "") || left.name.localeCompare(right.name, "de");
        return left.name.localeCompare(right.name, "de", { sensitivity: "base" });
      });
  }, [
    activityFilter,
    categoryFilter,
    data.blocks,
    durationFilter,
    exerciseById,
    exerciseFilter,
    favoritesOnly,
    groupFilter,
    materialFilter,
    searchTerm,
    sortMode,
    subcategoryFilter,
    usageFilter,
  ]);

  function resetFilters() {
    setGroupFilter("all");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setMaterialFilter("all");
    setExerciseFilter("all");
    setUsageFilter("all");
    setDurationFilter("all");
    setActivityFilter("active");
    setSortMode("name");
    setFavoritesOnly(false);
  }

  function openEditor(block: TrainingBlock | null) {
    setEditorBlock(block);
    setEditorDirty(false);
    setRemoteChangePending(false);
    setError(null);
    setSuccess(null);
  }

  function closeEditor() {
    setEditorBlock(undefined);
    setEditorDirty(false);
    setRemoteChangePending(false);
  }

  async function applyRemoteServerState(keepDraft: boolean) {
    const blockId = editorBlock?.id;
    if (!blockId) {
      setRemoteChangePending(false);
      await loadData(false);
      return;
    }

    setRemoteSyncBusy(true);
    setError(null);
    if (!keepDraft) {
      setEditorBlock(undefined);
      setEditorDirty(false);
    }

    try {
      const latest = await loadData(false);
      const block = latest?.blocks.find((item) => item.id === blockId);
      if (!block) throw new Error("Der Trainingsblock wurde auf einem anderen Gerät gelöscht.");
      setEditorBlock(block);
      if (keepDraft) await blockLock.retry();
      blockLock.acceptRecordVersion(block.updatedAt);
      setRemoteChangePending(false);
      if (keepDraft && editorDirty) {
        setSuccess("Die aktuelle Serverversion wurde übernommen. Deine Eingaben bleiben im Formular erhalten.");
      }
    } catch (remoteError) {
      closeEditor();
      setError(errorMessage(remoteError));
    } finally {
      setRemoteSyncBusy(false);
    }
  }

  async function handleSave(values: TrainingBlockInput) {
    if (!organizationId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const editLock = blockLock.getWriteGuard();
      await saveTrainingBlock(organizationId, editorBlock?.id ?? null, values, editLock);
      setEditorBlock(undefined);
      setEditorDirty(false);
      setRemoteChangePending(false);
      setSuccess(editorBlock ? "Der Trainingsblock wurde gespeichert." : "Der Trainingsblock wurde angelegt.");
      await loadData();
    } catch (saveError) {
      if (isCollaborationConflictError(saveError)) setRemoteChangePending(true);
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function toggleExpanded(blockId: string) {
    setExpandedBlockIds((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  async function handleDelete(block: TrainingBlock) {
    if (!organizationId || block.usageCount > 0 || busyBlockId) return;
    if (!window.confirm(`Trainingsblock „${block.name}“ endgültig löschen?`)) return;
    setBusyBlockId(block.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteTrainingBlock(organizationId, block.id);
      setSuccess("Der unbenutzte Trainingsblock wurde gelöscht.");
      await loadData();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setBusyBlockId(null);
    }
  }

  async function handleVariant(block: TrainingBlock) {
    if (!organizationId || busyBlockId) return;
    setBusyBlockId(block.id);
    setError(null);
    setSuccess(null);
    try {
      const variantId = await createTrainingBlockVariant(organizationId, block.id);
      const next = await loadData();
      setSuccess("Eine neue Blockvariante wurde angelegt.");
      const variant = next?.blocks.find((item) => item.id === variantId);
      if (variant) openEditor(variant);
    } catch (variantError) {
      setError(errorMessage(variantError));
    } finally {
      setBusyBlockId(null);
    }
  }

  async function handleFavorite(block: TrainingBlock) {
    if (!organizationId || busyBlockId) return;
    const nextFavorite = !block.isFavorite;
    setData((current) => ({
      ...current,
      blocks: current.blocks.map((item) => item.id === block.id ? { ...item, isFavorite: nextFavorite } : item),
    }));
    try {
      await setTrainingBlockFavorite(organizationId, block.id, nextFavorite);
    } catch (favoriteError) {
      setData((current) => ({
        ...current,
        blocks: current.blocks.map((item) => item.id === block.id ? { ...item, isFavorite: block.isFavorite } : item),
      }));
      setError(errorMessage(favoriteError));
    }
  }

  function toggleCompare(blockId: string) {
    setCompareBlockIds((current) => {
      if (current.includes(blockId)) return current.filter((id) => id !== blockId);
      const next = [...current, blockId].slice(-2);
      if (next.length === 2) setCompareOpen(true);
      return next;
    });
  }

  const compareBlocks = compareBlockIds
    .map((blockId) => data.blocks.find((block) => block.id === blockId))
    .filter((block): block is TrainingBlock => Boolean(block));


  return (
    <section className="training-blocks-page ui-page-shell">
      <div className="training-blocks-heading ui-page-heading">
        <div>
          <p className="eyebrow">Übungen</p>
          <h1>Trainingsblöcke</h1>
          <p>Wiederverwendbare Übungsfolgen erstellen und Leistungsgruppen zuordnen.</p>
        </div>
        {canEdit && (
          <button type="button" className="primary-button" onClick={() => openEditor(null)} disabled={loading || busy || data.exercises.filter((exercise) => exercise.isActive).length === 0}>
            <Plus aria-hidden="true" />Block
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <RemoteChangeNotice
        visible={remoteChangePending}
        busy={busy || remoteSyncBusy}
        onLoadServer={() => applyRemoteServerState(false)}
        onKeepDraft={() => applyRemoteServerState(true)}
      />

      <div className="training-blocks-toolbar training-blocks-toolbar-compact ui-command-surface">
        <label className="training-block-search ui-search-field">
          <Search aria-hidden="true" />
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Block oder Übung suchen" aria-label="Trainingsblock suchen" />
        </label>
        <button
          type="button"
          className={`secondary-button training-block-filter-toggle ui-icon-action ${filtersOpen ? "active" : ""}`}
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? "Filtermenü schließen" : "Filtermenü öffnen"}
          title={filtersOpen ? "Filtermenü schließen" : "Filtermenü öffnen"}
        >
          <Filter aria-hidden="true" />
          <span className="filter-toggle-label">Filter</span>
          {activeFilterCount > 0 && <span className="filter-toggle-count">{activeFilterCount}</span>}
          <ChevronDown className="filter-toggle-chevron" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`secondary-button training-block-compare-button ${compareBlockIds.length > 0 ? "active" : ""}`}
          onClick={() => {
            if (compareBlocks.length === 2) setCompareOpen(true);
            else setSuccess("Wähle bei zwei Blöcken das Vergleichssymbol aus.");
          }}
          aria-label="Trainingsblöcke vergleichen"
          title="Trainingsblöcke vergleichen"
        >
          <GitCompareArrows aria-hidden="true" />
          Vergleich {compareBlockIds.length}/2
        </button>
      </div>

      {filtersOpen && (
        <section className="training-block-filter-panel ui-filter-sheet" aria-label="Trainingsblöcke filtern">
          <div className="training-block-filter-grid">
            <label><span>Leistungsgruppe</span><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">Alle Gruppen</option><option value="club">Vereinsweit</option>{data.groups.map((group) => <option value={group.id} key={group.id}>{group.shortName || group.name}</option>)}</select></label>
            <label><span>Kategorie</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Alle Kategorien</option>{categories.map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></label>
            <label><span>Unterkategorie</span><select value={subcategoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)}><option value="all">Alle Unterkategorien</option>{subcategories.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
            <label><span>Material</span><select value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)}><option value="all">Alle Materialien</option>{materials.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
            <label><span>Übung</span><select value={exerciseFilter} onChange={(event) => setExerciseFilter(event.target.value)}><option value="all">Alle Übungen</option>{data.exercises.map((exercise) => <option value={exercise.id} key={exercise.id}>{exercise.name}</option>)}</select></label>
            <label><span>Verwendung</span><select value={usageFilter} onChange={(event) => setUsageFilter(event.target.value as UsageFilter)}><option value="all">Alle</option><option value="unused">Noch nie verwendet</option><option value="used">Bereits verwendet</option></select></label>
            <label><span>Dauer</span><select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value as DurationFilter)}><option value="all">Alle Dauern</option><option value="none">Ohne Dauer</option><option value="short">Bis 15 min</option><option value="medium">16–30 min</option><option value="long">31–60 min</option><option value="very_long">Über 60 min</option></select></label>
            <label><span>Sortierung</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="name">Alphabetisch</option><option value="usage">Am häufigsten verwendet</option><option value="updated">Zuletzt bearbeitet</option><option value="last_used">Zuletzt verwendet</option></select></label>
          </div>
          <div className="training-block-filter-footer">
            <div className="status-filter" aria-label="Status der Trainingsblöcke filtern">
              <button type="button" className={activityFilter === "active" ? "active" : ""} onClick={() => setActivityFilter("active")}>Aktiv <span>{counts.active}</span></button>
              <button type="button" className={activityFilter === "inactive" ? "active" : ""} onClick={() => setActivityFilter("inactive")}>Inaktiv <span>{counts.inactive}</span></button>
              <button type="button" className={activityFilter === "all" ? "active" : ""} onClick={() => setActivityFilter("all")}>Alle <span>{data.blocks.length}</span></button>
            </div>
            <button type="button" className={`favorite-filter ${favoritesOnly ? "active" : ""}`} onClick={() => setFavoritesOnly((current) => !current)}>
              <Star aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} />
              Favoriten <span>{counts.favorites}</span>
            </button>
            {activeFilterCount > 0 && <button type="button" className="text-button" onClick={resetFilters}><X aria-hidden="true" /> Zurücksetzen</button>}
          </div>
        </section>
      )}

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Trainingsblöcke werden geladen …</div>
      ) : data.exercises.length === 0 ? (
        <div className="empty-state"><ClipboardCheck aria-hidden="true" /><h2>Keine Übungen vorhanden</h2><p>Lege zuerst Übungen im Übungskatalog an.</p></div>
      ) : filteredBlocks.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck aria-hidden="true" /><h2>Keine Trainingsblöcke gefunden</h2><p>{data.blocks.length === 0 ? "Lege den ersten wiederverwendbaren Trainingsblock an." : "Passe Suche oder Filter an."}</p>
          {canEdit && data.blocks.length === 0 && <button type="button" className="primary-button" onClick={() => openEditor(null)}><Plus aria-hidden="true" />Ersten Block anlegen</button>}
        </div>
      ) : (
        <div className="training-block-list">
          {filteredBlocks.map((block) => {
            const assignedGroups = block.groupIds.map((groupId) => groupById.get(groupId)).filter((group): group is NonNullable<typeof group> => Boolean(group));
            return (
              <article className={`training-block-card ${block.isActive ? "" : "inactive"}`} key={block.id}>
                <button type="button" className="training-block-card-summary" onClick={() => toggleExpanded(block.id)} aria-expanded={expandedBlockIds.has(block.id)}>
                  <span className="training-block-status-dot" title={block.isActive ? "Aktiv" : "Inaktiv"} />
                  {block.isFavorite && <Star aria-hidden="true" fill="currentColor" />}
                  <strong>{block.name}</strong>
                  <span>{block.items.length} Übung{block.items.length === 1 ? "" : "en"}</span>
                  <span className="training-block-summary-duration"><Clock3 aria-hidden="true" />{block.estimatedMinutes ? `${block.estimatedMinutes} min` : "–"}</span>
                  {expandedBlockIds.has(block.id) ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </button>

                {expandedBlockIds.has(block.id) && (
                  <div className="training-block-card-details">
                    {block.goal && <p className="training-block-card-goal">{block.goal}</p>}
                    {block.inactiveExerciseCount > 0 && (
                      <div className="alert warning">
                        <AlertTriangle aria-hidden="true" />
                        {block.inactiveExerciseCount} inaktive Übung{block.inactiveExerciseCount === 1 ? "" : "en"} im Block. Bitte vor neuer Verwendung prüfen.
                      </div>
                    )}
                    {block.variantParentName && (
                      <p><GitBranchPlus aria-hidden="true" /> Variante {block.variantNumber} von „{block.variantParentName}“</p>
                    )}
                    <div className="training-block-card-detail-head">
                      <div className="training-block-card-meta">
                        <span><BarChart3 aria-hidden="true" /> {block.usageCount}-mal verwendet</span>
                        <span><CalendarDays aria-hidden="true" /> Letzte Nutzung: {formatUsageDate(block.lastUsedAt)}</span>
                        <span><History aria-hidden="true" /> {block.versionCount} Version{block.versionCount === 1 ? "" : "en"}</span>
                      </div>
                      <div className="training-block-card-actions">
                        <button
                          type="button"
                          className={block.isFavorite ? "active" : ""}
                          onClick={() => void handleFavorite(block)}
                          aria-label={block.isFavorite ? `${block.name} aus Favoriten entfernen` : `${block.name} zu Favoriten hinzufügen`}
                          title={block.isFavorite ? "Aus Favoriten entfernen" : "Favorit"}
                        >
                          <Star aria-hidden="true" fill={block.isFavorite ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          className={compareBlockIds.includes(block.id) ? "active" : ""}
                          onClick={() => toggleCompare(block.id)}
                          aria-label={`${block.name} für Vergleich ${compareBlockIds.includes(block.id) ? "abwählen" : "auswählen"}`}
                          title="Für Vergleich auswählen"
                        >
                          <GitCompareArrows aria-hidden="true" />
                        </button>
                        {canEdit && <>
                          <button type="button" onClick={() => void handleVariant(block)} disabled={busyBlockId === block.id} aria-label={`Neue Variante von ${block.name} erstellen`} title="Neue Variante erstellen"><GitBranchPlus aria-hidden="true" /></button>
                          {block.usageCount === 0 && <button type="button" className="danger" onClick={() => void handleDelete(block)} disabled={busyBlockId === block.id} aria-label={`${block.name} löschen`} title="Endgültig löschen"><Trash2 aria-hidden="true" /></button>}
                        </>}
                        <button type="button" onClick={() => openEditor(block)} aria-label={`${block.name} ${canEdit ? "bearbeiten" : "anzeigen"}`} title={canEdit ? "Bearbeiten" : "Anzeigen"}>{canEdit ? <Pencil aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}</button>
                      </div>
                    </div>
                    <div className="training-block-card-groups">
                      <strong>Geeignet für:</strong>
                      {assignedGroups.length === 0 ? <span>Vereinsweit</span> : assignedGroups.map((group) => <span key={group.id}>{group.shortName || group.name}</span>)}
                    </div>
                    <div className="training-block-card-groups">
                      <strong>Tatsächlich verwendet von:</strong>
                      {block.usedGroupIds.length === 0
                        ? <span>Noch keine Trainingsgruppe</span>
                        : block.usedGroupIds.map((groupId) => {
                          const group = groupById.get(groupId);
                          return <span key={groupId}>{group?.shortName || group?.name || "Unbekannte Gruppe"}</span>;
                        })}
                    </div>
                    <TrainingBlockVersionHistory
                      key={`${block.id}:${block.versionCount}:${block.updatedAt}`}
                      organizationId={organizationId ?? ""}
                      block={block}
                    />
                    <ol className="training-block-card-exercises">
                      {block.items.map((item) => {
                        const values = formatItemValues(item);
                        const exercise = exerciseById.get(item.exerciseId);
                        return (
                          <li key={item.id}>
                            <div className="training-block-card-exercise-heading">
                              <strong>{item.exerciseName}{!item.exerciseIsActive ? " · inaktiv" : ""}</strong>
                              {exercise && (
                                <button
                                  type="button"
                                  className="training-block-item-info-button training-block-overview-info-button"
                                  onClick={() => setInfoExercise(exercise)}
                                  aria-label={`Informationen zu ${item.exerciseName} anzeigen`}
                                  title="Übungsinformationen"
                                >
                                  <Info aria-hidden="true" />
                                </button>
                              )}
                            </div>
                            {values && <small>{values}</small>}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {compareOpen && compareBlocks.length === 2 && (
        <TrainingBlockCompareDialog
          left={compareBlocks[0]!}
          right={compareBlocks[1]!}
          groups={data.groups}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {editorBlock !== undefined && (
        <TrainingBlockEditor key={editorBlock?.id ?? "new-training-block"} block={editorBlock} organizationId={organizationId ?? ""} groups={data.groups} exercises={data.exercises} canEdit={editorCanEdit} busy={busy} lockNotice={editorBlock?.id ? <EditLockNotice lock={blockLock} /> : null} onCancel={() => setEditorBlock(undefined)} onSubmit={handleSave} />
      )}

      {infoExercise && (
        <TrainingBlockExerciseInfoDialog
          organizationId={organizationId ?? ""}
          exercise={infoExercise}
          groups={data.groups}
          onClose={() => setInfoExercise(null)}
        />
      )}
    </section>
  );
}
