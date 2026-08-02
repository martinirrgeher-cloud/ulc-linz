import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
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
type ActivityFilter = "active" | "inactive" | "all";
type VideoFilter = "all" | "yes" | "no";

const EXERCISE_REALTIME_TABLES = ["exercises"] as const;

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Der Übungskatalog konnte nicht geladen werden.", "exercise_catalog");
}

function hasVideo(exercise: Exercise): boolean {
  return exercise.videos.length > 0 || Boolean(exercise.videoUrl);
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
    void loadData(false);
  }, [busy, editorExercise?.id, loadData, remoteSyncBusy]);

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

  return (
    <section className="exercise-catalog-page">
      <div className="exercise-catalog-heading">
        <div>
          <p className="eyebrow">Trainingsplanung</p>
          <h1>Übungskatalog</h1>
          <p>Übungen strukturiert erfassen und für Trainingspläne vorbereiten.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={() => openEditor(null)}
            disabled={loading || busy || !data.categories.some((category) => category.isActive !== false)}
          >
            <Plus aria-hidden="true" />
            Übung
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

      <div className="exercise-catalog-toolbar exercise-catalog-toolbar-compact">
        <label className="exercise-search">
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
          className={`secondary-button exercise-filter-toggle ${filtersOpen ? "active" : ""}`}
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? "Filtermenü schließen" : "Filtermenü öffnen"}
          title={filtersOpen ? "Filtermenü schließen" : "Filtermenü öffnen"}
        >
          <Filter aria-hidden="true" />
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </div>

      {filtersOpen && (
        <section className="exercise-filter-panel" aria-label="Übungskatalog filtern">
          <div className="exercise-filter-grid">
            <label>
              <span>Kategorie</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Alle Kategorien</option>
                {data.categories.map((category) => (
                  <option value={category.key} key={category.key}>{category.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Unterkategorie</span>
              <select value={subcategoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)}>
                <option value="all">Alle Unterkategorien</option>
                {subcategoryOptions.map((subcategory) => (
                  <option value={subcategory} key={subcategory}>{subcategory}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Material</span>
              <select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}>
                <option value="all">Alle Materialien</option>
                {equipmentOptions.map((equipment) => (
                  <option value={equipment} key={equipment}>{equipment}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Schwierigkeitsgrad</span>
              <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
                <option value="all">Alle Schwierigkeitsgrade</option>
                {data.difficulties.map((difficulty) => (
                  <option value={difficulty.key} key={difficulty.key}>{difficulty.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Trainingsgruppe</span>
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                <option value="all">Alle Trainingsgruppen</option>
                <option value="club">Vereinsweit / alle Gruppen</option>
                {data.groups.map((group) => (
                  <option value={group.id} key={group.id}>{group.shortName || group.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Video vorhanden</span>
              <select value={videoFilter} onChange={(event) => setVideoFilter(event.target.value as VideoFilter)}>
                <option value="all">Alle</option>
                <option value="yes">Ja</option>
                <option value="no">Nein</option>
              </select>
            </label>
          </div>

          <div className="exercise-filter-panel-footer">
            <div className="status-filter" aria-label="Übungsstatus filtern">
              <button type="button" className={activityFilter === "active" ? "active" : ""} onClick={() => setActivityFilter("active")}>Aktiv <span>{counts.active}</span></button>
              <button type="button" className={activityFilter === "inactive" ? "active" : ""} onClick={() => setActivityFilter("inactive")}><Archive aria-hidden="true" /> Archiv <span>{counts.inactive}</span></button>
              <button type="button" className={activityFilter === "all" ? "active" : ""} onClick={() => setActivityFilter("all")}>Alle <span>{data.exercises.length}</span></button>
            </div>
            <button type="button" className={`favorite-filter ${favoritesOnly ? "active" : ""}`} onClick={() => setFavoritesOnly((current) => !current)}>
              <Star aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} />
              Favoriten <span>{counts.favorites}</span>
            </button>
            {activeFilterCount > 0 && (
              <button type="button" className="text-button exercise-filter-reset" onClick={resetFilters}>
                <X aria-hidden="true" /> Zurücksetzen
              </button>
            )}
          </div>
        </section>
      )}

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Übungen werden geladen …</div>
      ) : data.categories.length === 0 ? (
        <div className="empty-state"><BookOpen aria-hidden="true" /><h2>Kategorien fehlen</h2><p>Bitte zuerst die neue Datenbankmigration ausführen.</p></div>
      ) : filteredExercises.length === 0 ? (
        <div className="empty-state">
          <BookOpen aria-hidden="true" />
          <h2>Keine Übungen gefunden</h2>
          <p>{data.exercises.length === 0 ? "Lege die erste Übung für den Trainingskatalog an." : "Passe Suche oder Filter an."}</p>
          {canEdit && data.exercises.length === 0 && (
            <button type="button" className="primary-button" onClick={() => openEditor(null)}><Plus aria-hidden="true" />Erste Übung anlegen</button>
          )}
        </div>
      ) : (
        <div className="exercise-list">
          {filteredExercises.map((exercise) => (
            <article className={`exercise-card ${exercise.isActive ? "" : "inactive"}`} key={exercise.id}>
              <div className="exercise-card-main">
                <div className="exercise-card-title-row">
                  <span className="exercise-status-dot" title={exercise.isActive ? "Aktiv" : "Inaktiv"} />
                  <div>
                    <h2>{exercise.name}</h2>
                    <p>{exercise.categoryTitle}{exercise.subcategory ? ` · ${exercise.subcategory}` : ""}</p>
                  </div>
                </div>
                {exercise.goal && <p className="exercise-goal">{exercise.goal}</p>}
                <div className="exercise-card-meta">
                  {exercise.difficultyLabel && <span>Schwierigkeit: {exercise.difficultyLabel}</span>}
                  <span>{exercise.blockUsages.length} Block{exercise.blockUsages.length === 1 ? "" : "e"}</span>
                  <span>{exercise.planUsages.length} Plan{exercise.planUsages.length === 1 ? "" : "e"}</span>
                  {exercise.parameters.slice(0, 5).map((parameter) => (
                    <span key={parameter.key}>{parameter.label}{parameter.defaultValue ? `: ${parameter.defaultValue}${parameter.unit ? ` ${parameter.unit}` : ""}` : ""}</span>
                  ))}
                  {exercise.parameters.length > 5 && <span>+{exercise.parameters.length - 5}</span>}
                  {exercise.parameters.length === 0 && <span>Keine Parameter</span>}
                </div>
                {exercise.equipment.length > 0 && <small className="exercise-equipment">Material: {exercise.equipment.join(", ")}</small>}
              </div>

              <div className="exercise-card-actions">
                <button
                  type="button"
                  className="exercise-action-link"
                  onClick={() => setUsageExercise(exercise)}
                  aria-label={`Verwendung von ${exercise.name} anzeigen`}
                  title="Verwendung anzeigen"
                >
                  <ListTree aria-hidden="true" />
                  <span className="exercise-video-count">{exercise.blockUsages.length + exercise.planUsages.length}</span>
                </button>
                <button type="button" className={`exercise-favorite-button ${exercise.isFavorite ? "active" : ""}`} onClick={() => void handleFavorite(exercise)} aria-label={exercise.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"} title={exercise.isFavorite ? "Aus Favoriten entfernen" : "Favorit"}>
                  <Star aria-hidden="true" fill={exercise.isFavorite ? "currentColor" : "none"} />
                </button>
                {exercise.videos.length > 0 && (
                  <button type="button" className="exercise-action-link" onClick={() => openEditor(exercise, "videos")} aria-label={`Videos zu ${exercise.name} öffnen`} title={`${exercise.videos.length} Video${exercise.videos.length === 1 ? "" : "s"}`}>
                    <Video aria-hidden="true" /><span className="exercise-video-count">{exercise.videos.length}</span>
                  </button>
                )}
                {exercise.videoUrl && (
                  <a className="exercise-action-link" href={exercise.videoUrl} target="_blank" rel="noreferrer" aria-label={`Video oder Link zu ${exercise.name} öffnen`} title="Video oder Link öffnen">
                    <Video aria-hidden="true" /><ExternalLink aria-hidden="true" />
                  </a>
                )}
                <button type="button" className="exercise-edit-button" onClick={() => openEditor(exercise)} aria-label={`${exercise.name} ${canEdit ? "bearbeiten" : "anzeigen"}`} title={canEdit ? "Bearbeiten" : "Anzeigen"}>
                  {canEdit ? <Pencil aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {usageExercise && (
        <ExerciseUsageDialog exercise={usageExercise} onClose={() => setUsageExercise(null)} />
      )}

      {editorExercise !== undefined && (
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
          onCancel={closeEditor}
          onSubmit={handleSave}
          onDirtyChange={setEditorDirty}
          onVideosChanged={(videos) => {
            if (editorExercise?.id) handleVideosChanged(editorExercise.id, videos);
          }}
        />
      )}
    </section>
  );
}
