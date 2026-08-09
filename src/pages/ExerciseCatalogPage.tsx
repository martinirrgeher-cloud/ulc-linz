import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Pencil,
  ListTree,
  Plus,
  Search,
  Star,
  Video,
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
  loadExerciseCatalog,
  saveExercise,
  setExerciseFavorite,
} from "@/features/exercise-catalog/api";
import { ExerciseUsageDialog } from "@/features/exercise-catalog/ExerciseUsageDialog";
import {
  ExerciseEditor,
  type EditorSection,
} from "@/features/exercise-catalog/ExerciseEditor";
import type {
  Exercise,
  ExerciseCatalogData,
  ExerciseInput,
} from "@/features/exercise-catalog/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/exercise-catalog.css";
import "@/styles/exercise-catalog-mobile.css";
type ActivityFilter = "active" | "inactive" | "all";
type VideoFilter = "all" | "yes" | "no";

const EXERCISE_REALTIME_TABLES = ["exercises"] as const;

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Der Übungskatalog konnte nicht geladen werden.", "exercise_catalog");
}

function hasVideo(exercise: Exercise): boolean {
  return exercise.videos.length > 0 || Boolean(exercise.videoUrl);
}

function parameterSummaryValue(parameter: Exercise["parameters"][number]): string {
  const standard = parameter.defaultValue.trim();
  if (standard) return `${standard}${parameter.unit ? ` ${parameter.unit}` : ""}`;
  if (parameter.minValue !== null || parameter.maxValue !== null) {
    const min = parameter.minValue ?? "…";
    const max = parameter.maxValue ?? "…";
    return `${min}–${max}${parameter.unit ? ` ${parameter.unit}` : ""}`;
  }
  return "–";
}

export function ExerciseCatalogPage() {
  const { appContext, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canEdit = canEditModule("exercise_catalog");

  const [data, setData] = useState<ExerciseCatalogData>({
    categories: [],
    subcategories: [],
    materials: [],
    difficulties: [],
    parameterOptions: [],
    groups: [],
    exercises: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("active");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [videoFilter, setVideoFilter] = useState<VideoFilter>("all");
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [usageExercise, setUsageExercise] = useState<Exercise | null>(null);
  const [editorExercise, setEditorExercise] = useState<Exercise | null | undefined>(undefined);
  const [editorInitialSection, setEditorInitialSection] = useState<EditorSection>("basis");
  const [editorDirty, setEditorDirty] = useState(false);
  const [remoteChangePending, setRemoteChangePending] = useState(false);
  const [remoteSyncBusy, setRemoteSyncBusy] = useState(false);

  const exerciseLock = useEditLock({
    organizationId,
    entityType: "exercise",
    entityId: editorExercise?.id,
    expectedUpdatedAt: editorExercise?.updatedAt ?? null,
    enabled: canEdit && Boolean(editorExercise?.id),
  });
  const editorCanEdit = canEdit && (!editorExercise?.id || exerciseLock.isEditable);

  useEffect(() => {
    if (collaborationVersionsDiffer(editorExercise?.updatedAt, exerciseLock.recordVersion)) {
      setRemoteChangePending(true);
    }
  }, [editorExercise?.updatedAt, exerciseLock.recordVersion]);

  const loadData = useCallback(async (showLoading = true): Promise<ExerciseCatalogData | null> => {
    if (!organizationId) return null;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const next = await loadExerciseCatalog(organizationId, true);
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
    if (busy || remoteSyncBusy) return;
    const currentChanged = Boolean(editorExercise?.id) && (
      refresh.reason === "reconnected"
      || refresh.changes.some((change) => (
        change.table === "exercises" && change.recordId === editorExercise?.id
      ))
    );
    if (currentChanged) {
      setRemoteChangePending(true);
      return;
    }
    scheduleRealtimeReload();
  }, [busy, editorExercise?.id, remoteSyncBusy, scheduleRealtimeReload]);

  useOrganizationRealtime({
    organizationId,
    tables: EXERCISE_REALTIME_TABLES,
    onRefresh: handleRealtimeRefresh,
  });

  const counts = useMemo(() => ({
    active: data.exercises.filter((exercise) => exercise.isActive).length,
    inactive: data.exercises.filter((exercise) => !exercise.isActive).length,
    favorites: data.exercises.filter((exercise) => exercise.isFavorite).length,
  }), [data.exercises]);

  const equipmentOptions = useMemo(
    () => [...new Set([
      ...data.materials.filter((option) => option.isActive).map((option) => option.label),
      ...data.exercises.flatMap((exercise) => exercise.equipment),
    ])].filter(Boolean).sort((left, right) => left.localeCompare(right, "de", { sensitivity: "base" })),
    [data.exercises, data.materials],
  );

  const subcategoryOptions = useMemo(
    () => [...new Set([
      ...data.subcategories.filter((option) => option.isActive).map((option) => option.label),
      ...data.exercises.flatMap((exercise) => exercise.subcategory ? [exercise.subcategory] : []),
    ])].sort((left, right) => left.localeCompare(right, "de", { sensitivity: "base" })),
    [data.exercises, data.subcategories],
  );

  const activeFilterCount = [
    categoryFilter !== "all",
    subcategoryFilter !== "all",
    equipmentFilter !== "all",
    difficultyFilter !== "all",
    groupFilter !== "all",
    videoFilter !== "all",
    activityFilter !== "active",
    favoritesOnly,
  ].filter(Boolean).length;

  const filteredExercises = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de");

    return data.exercises
      .filter((exercise) => {
        if (activityFilter === "active" && !exercise.isActive) return false;
        if (activityFilter === "inactive" && exercise.isActive) return false;
        if (favoritesOnly && !exercise.isFavorite) return false;
        if (categoryFilter !== "all" && exercise.categoryKey !== categoryFilter) return false;
        if (subcategoryFilter !== "all" && exercise.subcategory !== subcategoryFilter) return false;
        if (equipmentFilter !== "all" && !exercise.equipment.includes(equipmentFilter)) return false;
        if (difficultyFilter !== "all" && exercise.difficultyKey !== difficultyFilter) return false;
        if (groupFilter === "club" && exercise.groupIds.length > 0) return false;
        if (groupFilter !== "all" && groupFilter !== "club" && exercise.groupIds.length > 0 && !exercise.groupIds.includes(groupFilter)) return false;
        if (videoFilter === "yes" && !hasVideo(exercise)) return false;
        if (videoFilter === "no" && hasVideo(exercise)) return false;
        if (!search) return true;

        return [
          exercise.name,
          exercise.categoryTitle,
          exercise.subcategory ?? "",
          exercise.goal ?? "",
          exercise.description ?? "",
          exercise.equipment.join(" "),
        ].some((value) => value.toLocaleLowerCase("de").includes(search));
      })
      .sort((left, right) => {
        if (left.isFavorite !== right.isFavorite) return left.isFavorite ? -1 : 1;
        return left.name.localeCompare(right.name, "de", { sensitivity: "base" });
      });
  }, [
    activityFilter,
    categoryFilter,
    data.exercises,
    equipmentFilter,
    difficultyFilter,
    favoritesOnly,
    groupFilter,
    searchTerm,
    subcategoryFilter,
    videoFilter,
  ]);

  function resetFilters() {
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setEquipmentFilter("all");
    setDifficultyFilter("all");
    setGroupFilter("all");
    setVideoFilter("all");
    setActivityFilter("active");
    setFavoritesOnly(false);
  }

  async function handleSave(values: ExerciseInput) {
    if (!organizationId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const editLock = exerciseLock.getWriteGuard();
      await saveExercise(organizationId, editorExercise?.id ?? null, values, editLock);
      setEditorExercise(undefined);
      setEditorDirty(false);
      setRemoteChangePending(false);
      setSuccess(editorExercise ? "Die Übung wurde gespeichert." : "Die Übung wurde angelegt.");
      await loadData();
    } catch (saveError) {
      if (isCollaborationConflictError(saveError)) setRemoteChangePending(true);
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function openEditor(exercise: Exercise | null, section: EditorSection = "basis") {
    setError(null);
    setSuccess(null);
    setEditorDirty(false);
    setRemoteChangePending(false);
    setEditorInitialSection(section);
    setEditorExercise(exercise);
  }

  function closeEditor() {
    setEditorExercise(undefined);
    setEditorDirty(false);
    setRemoteChangePending(false);
  }

  async function applyRemoteServerState(keepDraft: boolean) {
    const exerciseId = editorExercise?.id;
    if (!exerciseId) {
      setRemoteChangePending(false);
      await loadData(false);
      return;
    }

    setRemoteSyncBusy(true);
    setError(null);
    if (!keepDraft) {
      setEditorExercise(undefined);
      setEditorDirty(false);
    }

    try {
      const latest = await loadData(false);
      const exercise = latest?.exercises.find((item) => item.id === exerciseId);
      if (!exercise) throw new Error("Die Übung wurde auf einem anderen Gerät gelöscht.");
      setEditorExercise(exercise);
      if (keepDraft) await exerciseLock.retry();
      exerciseLock.acceptRecordVersion(exercise.updatedAt);
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

  function handleVideosChanged(exerciseId: string, videos: Exercise["videos"]) {
    setData((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, videos } : exercise,
      ),
    }));
  }

  async function handleFavorite(exercise: Exercise) {
    if (!organizationId || busy) return;
    const nextFavorite = !exercise.isFavorite;
    setData((current) => ({
      ...current,
      exercises: current.exercises.map((item) =>
        item.id === exercise.id ? { ...item, isFavorite: nextFavorite } : item,
      ),
    }));

    try {
      await setExerciseFavorite(organizationId, exercise.id, nextFavorite);
    } catch (favoriteError) {
      setData((current) => ({
        ...current,
        exercises: current.exercises.map((item) =>
          item.id === exercise.id ? { ...item, isFavorite: exercise.isFavorite } : item,
        ),
      }));
      setError(errorMessage(favoriteError));
    }
  }

  if (editorExercise !== undefined) {
    return (
      <section className="exercise-catalog-page ui-page-shell exercise-catalog-editor-active">
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}
        <RemoteChangeNotice
          visible={remoteChangePending}
          busy={busy || remoteSyncBusy}
          onLoadServer={() => applyRemoteServerState(false)}
          onKeepDraft={() => applyRemoteServerState(true)}
        />
        <ExerciseEditor
          key={editorExercise?.id ?? "new-exercise"}
          exercise={editorExercise}
          catalogExercises={data.exercises}
          categories={data.categories}
          subcategories={data.subcategories}
          materials={data.materials}
          difficulties={data.difficulties}
          parameterOptions={data.parameterOptions}
          groups={data.groups}
          organizationId={organizationId ?? ""}
          initialSection={editorInitialSection}
          canEdit={editorCanEdit}
          busy={busy}
          lockNotice={editorExercise?.id ? <EditLockNotice lock={exerciseLock} /> : null}
          presentation="page"
          onCancel={closeEditor}
          onSubmit={handleSave}
          onDirtyChange={setEditorDirty}
          onVideosChanged={(videos) => {
            if (editorExercise?.id) handleVideosChanged(editorExercise.id, videos);
          }}
        />
      </section>
    );
  }

  return (
    <section className="exercise-catalog-page ui-page-shell">
      <div className="exercise-catalog-heading ui-page-heading">
        <div className="exercise-catalog-title">
          <h1>Übungskatalog</h1>
          <p>Übungen schnell finden, vergleichen und für die Planung vorbereiten.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="primary-button exercise-create-button"
            onClick={() => openEditor(null)}
            disabled={loading || busy || !data.categories.some((category) => category.isActive !== false)}
            aria-label="Übung anlegen"
            data-testid="exercise-create"
          >
            <Plus aria-hidden="true" />
            <span>Übung</span>
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

      <div className="exercise-catalog-commandbar ui-command-surface">
        <div className="exercise-catalog-toolbar exercise-catalog-toolbar-compact">
          <label className="exercise-search ui-search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Übung suchen"
              aria-label="Übung suchen"
            />
          </label>
          <button
            type="button"
            className={`secondary-button exercise-filter-toggle ui-icon-action ${filtersOpen ? "active" : ""}`}
            onClick={() => setFiltersOpen((current) => !current)}
            aria-expanded={filtersOpen}
            aria-label={filtersOpen ? "Filtermenü schließen" : "Filtermenü öffnen"}
            title={filtersOpen ? "Filtermenü schließen" : "Filtermenü öffnen"}
          >
            <Filter aria-hidden="true" />
            {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
        </div>

      </div>

      {filtersOpen && (
        <>
          <button type="button" className="exercise-filter-scrim" aria-label="Filtermenü schließen" onClick={() => setFiltersOpen(false)} />
          <section className="exercise-filter-panel ui-filter-sheet" aria-label="Übungskatalog filtern">
            <header className="exercise-filter-heading">
              <div><strong>Filtern & Sortieren</strong><small>{filteredExercises.length} Übungen sichtbar</small></div>
              <button type="button" className="text-button" onClick={resetFilters}>Zurücksetzen</button>
            </header>


            <div className="exercise-filter-grid">
              <label className="ui-labeled-field"><span className="ui-field-label">Kategorie</span><select className="ui-field-control" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Alle Kategorien</option>{data.categories.map((category) => <option value={category.key} key={category.key}>{category.title}</option>)}</select></label>
              <label className="ui-labeled-field"><span className="ui-field-label">Unterkategorie</span><select className="ui-field-control" value={subcategoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)}><option value="all">Alle Unterkategorien</option>{subcategoryOptions.map((subcategory) => <option value={subcategory} key={subcategory}>{subcategory}</option>)}</select></label>
              <label className="ui-labeled-field"><span className="ui-field-label">Schwierigkeitsgrad</span><select className="ui-field-control" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">Alle Schwierigkeitsgrade</option>{data.difficulties.map((difficulty) => <option value={difficulty.key} key={difficulty.key}>{difficulty.label}</option>)}</select></label>
              <label className="ui-labeled-field"><span className="ui-field-label">Material</span><select className="ui-field-control" value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}><option value="all">Alle Materialien</option>{equipmentOptions.map((equipment) => <option value={equipment} key={equipment}>{equipment}</option>)}</select></label>
              <label className="ui-labeled-field"><span className="ui-field-label">Trainingsgruppe</span><select className="ui-field-control" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">Alle Trainingsgruppen</option><option value="club">Vereinsweit / alle Gruppen</option>{data.groups.map((group) => <option value={group.id} key={group.id}>{group.shortName || group.name}</option>)}</select></label>
              <label className="ui-labeled-field"><span className="ui-field-label">Video</span><select className="ui-field-control" value={videoFilter} onChange={(event) => setVideoFilter(event.target.value as VideoFilter)}><option value="all">Alle</option><option value="yes">Vorhanden</option><option value="no">Ohne Video</option></select></label>
              <label className="ui-labeled-field"><span className="ui-field-label">Status</span><select className="ui-field-control" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}><option value="active">Aktiv</option><option value="inactive">Archiv</option><option value="all">Alle</option></select></label>
            </div>

            <div className="exercise-filter-panel-footer">
              <button type="button" className={`favorite-filter ${favoritesOnly ? "active" : ""}`} onClick={() => setFavoritesOnly((current) => !current)}>
                <Star aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} />Favoriten <span>{counts.favorites}</span>
              </button>
              <button type="button" className="primary-button exercise-filter-apply" onClick={() => setFiltersOpen(false)}>Anwenden</button>
            </div>
          </section>
        </>
      )}

      <div className="exercise-result-summary">
        <span><strong>{filteredExercises.length}</strong> von {data.exercises.length} Übungen</span>
        {activeFilterCount > 0 && <button type="button" className="text-button" onClick={resetFilters}><X aria-hidden="true" />Filter löschen</button>}
      </div>

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Übungen werden geladen …</div>
      ) : data.categories.length === 0 ? (
        <div className="empty-state"><BookOpen aria-hidden="true" /><h2>Kategorien fehlen</h2><p>Bitte zuerst die neue Datenbankmigration ausführen.</p></div>
      ) : filteredExercises.length === 0 ? (
        <div className="empty-state">
          <BookOpen aria-hidden="true" />
          <h2>Keine Übungen gefunden</h2>
          <p>{data.exercises.length === 0 ? "Lege die erste Übung für den Trainingskatalog an." : "Passe Suche oder Filter an."}</p>
          {canEdit && data.exercises.length === 0 && <button type="button" className="primary-button" onClick={() => openEditor(null)}><Plus aria-hidden="true" />Erste Übung anlegen</button>}
        </div>
      ) : (
        <div className="exercise-list exercise-list-compact">
          {filteredExercises.map((exercise) => {
            const expanded = expandedExerciseId === exercise.id;
            const visibleParameters = [...exercise.parameters].sort((left, right) => left.sortOrder - right.sortOrder).slice(0, 4);
            return (
              <article className={`exercise-card exercise-list-item ${exercise.isActive ? "" : "inactive"} ${expanded ? "expanded" : ""}`} key={exercise.id} data-testid="exercise-card" data-exercise-id={exercise.id}>
                <div className="exercise-list-summary">
                  <button type="button" className="exercise-list-primary" data-testid="exercise-primary" onClick={() => setExpandedExerciseId(expanded ? null : exercise.id)} aria-expanded={expanded}>
                    <span className="exercise-list-title">
                      <strong>{exercise.name}</strong>
                      <small>{exercise.categoryTitle}{exercise.subcategory ? ` · ${exercise.subcategory}` : ""}{exercise.difficultyLabel ? ` · ${exercise.difficultyLabel}` : ""}{exercise.isActive ? "" : " · Archiv"}</small>
                    </span>
                  </button>

                  <div className="exercise-card-actions" data-testid="exercise-actions">
                    <button type="button" className={`icon-button exercise-favorite-button ${exercise.isFavorite ? "active" : ""}`} onClick={() => void handleFavorite(exercise)} aria-label={exercise.isFavorite ? `${exercise.name} aus Favoriten entfernen` : `${exercise.name} zu Favoriten hinzufügen`} title={exercise.isFavorite ? "Aus Favoriten entfernen" : "Favorit"}>
                      <Star aria-hidden="true" fill={exercise.isFavorite ? "currentColor" : "none"} />
                    </button>
                    <button type="button" className="icon-button exercise-edit-button" data-testid="exercise-edit" onClick={() => openEditor(exercise)} aria-label={`${exercise.name} ${canEdit ? "bearbeiten" : "anzeigen"}`} title={canEdit ? "Bearbeiten" : "Anzeigen"}>{canEdit ? <Pencil aria-hidden="true" /> : <BookOpen aria-hidden="true" />}</button>
                    <button type="button" className="icon-button exercise-expand-button" data-testid="exercise-expand" onClick={() => setExpandedExerciseId(expanded ? null : exercise.id)} aria-label={expanded ? `${exercise.name} einklappen` : `${exercise.name} Schnellinfos anzeigen`} title={expanded ? "Einklappen" : "Schnellinfos"}>{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>
                  </div>
                </div>


                {expanded && (
                  <div className="exercise-quick-info">
                    {exercise.goal && <p className="exercise-quick-goal">{exercise.goal}</p>}
                    {exercise.equipment.length > 0 && (
                      <div className="exercise-quick-materials">
                        <small>Material</small>
                        <div>{exercise.equipment.map((item) => <span className="ui-meta-chip" key={item}>{item}</span>)}</div>
                      </div>
                    )}
                    {hasVideo(exercise) && (
                      <div className="exercise-quick-videos">
                        <small>Video</small>
                        {exercise.videos.length > 0 ? (
                          <button type="button" className="secondary-button compact-button" onClick={() => openEditor(exercise, "videos")} aria-label={`Videos zu ${exercise.name} öffnen`}>
                            <Video aria-hidden="true" />{exercise.videos.length} Video{exercise.videos.length === 1 ? "" : "s"}
                          </button>
                        ) : (
                          <a href={exercise.videoUrl ?? undefined} target="_blank" rel="noreferrer" aria-label={`Video oder Link zu ${exercise.name} öffnen`}>
                            <Video aria-hidden="true" />Video oder Link öffnen<ExternalLink aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    )}
                    <div className="exercise-quick-parameters">
                      {visibleParameters.length > 0 ? visibleParameters.map((parameter) => (
                        <div className="exercise-quick-parameter" key={parameter.key}>
                          <small>{parameter.label}</small>
                          <strong>{parameterSummaryValue(parameter)}</strong>
                        </div>
                      )) : <span className="exercise-quick-empty">Keine Planungsparameter hinterlegt.</span>}
                      {exercise.parameters.length > 4 && <span className="exercise-quick-more">+{exercise.parameters.length - 4} weitere</span>}
                    </div>
                    <button type="button" className="exercise-usage-summary" onClick={() => setUsageExercise(exercise)} aria-label={`Verwendung von ${exercise.name} anzeigen`} data-testid="exercise-usage">
                      <ListTree aria-hidden="true" />
                      <span><strong>Verwendung</strong><small>{exercise.blockUsageCount} Block{exercise.blockUsageCount === 1 ? "" : "e"} · {exercise.planUsageCount} Plan{exercise.planUsageCount === 1 ? "" : "e"}</small></span>
                      <ChevronDown aria-hidden="true" />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {usageExercise && <ExerciseUsageDialog organizationId={organizationId ?? ""} exercise={usageExercise} onClose={() => setUsageExercise(null)} />}

    </section>
  );
}
