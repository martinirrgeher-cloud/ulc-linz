import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Filter,
  Pencil,
  Plus,
  Search,
  Star,
  Video,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  loadExerciseCatalog,
  saveExercise,
  setExerciseFavorite,
} from "@/features/exercise-catalog/api";
import {
  ExerciseEditor,
  type EditorSection,
} from "@/features/exercise-catalog/ExerciseEditor";
import type {
  Exercise,
  ExerciseCatalogData,
  ExerciseInput,
} from "@/features/exercise-catalog/types";

type ActivityFilter = "active" | "inactive" | "all";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Der Übungskatalog konnte nicht geladen werden.";
}

export function ExerciseCatalogPage() {
  const { appContext, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canEdit = canEditModule("exercise_catalog");

  const [data, setData] = useState<ExerciseCatalogData>({
    categories: [],
    groups: [],
    exercises: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("active");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [editorExercise, setEditorExercise] = useState<Exercise | null | undefined>(undefined);
  const [editorInitialSection, setEditorInitialSection] = useState<EditorSection>("basis");

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await loadExerciseCatalog(organizationId, true));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const counts = useMemo(() => ({
    active: data.exercises.filter((exercise) => exercise.isActive).length,
    inactive: data.exercises.filter((exercise) => !exercise.isActive).length,
    favorites: data.exercises.filter((exercise) => exercise.isFavorite).length,
  }), [data.exercises]);

  const equipmentOptions = useMemo(
    () => [...new Set(data.exercises.flatMap((exercise) => exercise.equipment))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, "de", { sensitivity: "base" })),
    [data.exercises],
  );

  const filteredExercises = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de");

    return data.exercises
      .filter((exercise) => {
        if (activityFilter === "active" && !exercise.isActive) return false;
        if (activityFilter === "inactive" && exercise.isActive) return false;
        if (favoritesOnly && !exercise.isFavorite) return false;
        if (categoryFilter !== "all" && exercise.categoryKey !== categoryFilter) return false;
        if (equipmentFilter !== "all" && !exercise.equipment.includes(equipmentFilter)) return false;
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
  }, [activityFilter, categoryFilter, data.exercises, equipmentFilter, favoritesOnly, searchTerm]);

  async function handleSave(values: ExerciseInput) {
    if (!organizationId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await saveExercise(organizationId, editorExercise?.id ?? null, values);
      setEditorExercise(undefined);
      setSuccess(editorExercise ? "Die Übung wurde gespeichert." : "Die Übung wurde angelegt.");
      await loadData();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function openEditor(exercise: Exercise | null, section: EditorSection = "basis") {
    setError(null);
    setSuccess(null);
    setEditorInitialSection(section);
    setEditorExercise(exercise);
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
            disabled={loading || busy || data.categories.length === 0}
          >
            <Plus aria-hidden="true" />
            Übung
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="exercise-catalog-toolbar">
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

        <label className="exercise-filter-select">
          <Filter aria-hidden="true" />
          <span className="exercise-filter-select-content">
            <small>Kategorie</small>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Kategorie filtern"
            >
              <option value="all">Alle Kategorien</option>
              {data.categories.map((category) => (
                <option value={category.key} key={category.key}>
                  {category.title}
                </option>
              ))}
            </select>
          </span>
          <ChevronDown className="exercise-filter-chevron" aria-hidden="true" />
        </label>

        <label className="exercise-filter-select exercise-material-filter">
          <Filter aria-hidden="true" />
          <span className="exercise-filter-select-content">
            <small>Material</small>
            <select
              value={equipmentFilter}
              onChange={(event) => setEquipmentFilter(event.target.value)}
              aria-label="Material filtern"
            >
              <option value="all">Alle Materialien</option>
              {equipmentOptions.map((equipment) => (
                <option value={equipment} key={equipment}>{equipment}</option>
              ))}
            </select>
          </span>
          <ChevronDown className="exercise-filter-chevron" aria-hidden="true" />
        </label>
      </div>

      <div className="exercise-filter-row">
        <div className="status-filter" aria-label="Übungsstatus filtern">
          <button
            type="button"
            className={activityFilter === "active" ? "active" : ""}
            onClick={() => setActivityFilter("active")}
          >
            Aktiv <span>{counts.active}</span>
          </button>
          <button
            type="button"
            className={activityFilter === "inactive" ? "active" : ""}
            onClick={() => setActivityFilter("inactive")}
          >
            Inaktiv <span>{counts.inactive}</span>
          </button>
          <button
            type="button"
            className={activityFilter === "all" ? "active" : ""}
            onClick={() => setActivityFilter("all")}
          >
            Alle <span>{data.exercises.length}</span>
          </button>
        </div>

        <button
          type="button"
          className={`favorite-filter ${favoritesOnly ? "active" : ""}`}
          onClick={() => setFavoritesOnly((current) => !current)}
        >
          <Star aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} />
          Favoriten <span>{counts.favorites}</span>
        </button>
      </div>

      {loading ? (
        <div className="management-loading">
          <div className="spinner" aria-hidden="true" />
          Übungen werden geladen …
        </div>
      ) : data.categories.length === 0 ? (
        <div className="empty-state">
          <BookOpen aria-hidden="true" />
          <h2>Kategorien fehlen</h2>
          <p>Bitte zuerst die neue Datenbankmigration für den Übungskatalog ausführen.</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="empty-state">
          <BookOpen aria-hidden="true" />
          <h2>Keine Übungen gefunden</h2>
          <p>
            {data.exercises.length === 0
              ? "Lege die erste Übung für den Trainingskatalog an."
              : "Passe Suche oder Filter an."}
          </p>
          {canEdit && data.exercises.length === 0 && (
            <button type="button" className="primary-button" onClick={() => openEditor(null)}>
              <Plus aria-hidden="true" />
              Erste Übung anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="exercise-list">
          {filteredExercises.map((exercise) => (
            <article
              className={`exercise-card ${exercise.isActive ? "" : "inactive"}`}
              key={exercise.id}
            >
              <div className="exercise-card-main">
                <div className="exercise-card-title-row">
                  <span className="exercise-status-dot" title={exercise.isActive ? "Aktiv" : "Inaktiv"} />
                  <div>
                    <h2>{exercise.name}</h2>
                    <p>
                      {exercise.categoryTitle}
                      {exercise.subcategory ? ` · ${exercise.subcategory}` : ""}
                    </p>
                  </div>
                </div>

                {exercise.goal && <p className="exercise-goal">{exercise.goal}</p>}

                <div className="exercise-card-meta">
                  {exercise.parameters.slice(0, 5).map((parameter) => (
                    <span key={parameter.key}>
                      {parameter.label}
                      {parameter.defaultValue ? `: ${parameter.defaultValue}${parameter.unit ? ` ${parameter.unit}` : ""}` : ""}
                    </span>
                  ))}
                  {exercise.parameters.length > 5 && (
                    <span>+{exercise.parameters.length - 5}</span>
                  )}
                  {exercise.parameters.length === 0 && <span>Keine Parameter</span>}
                </div>

                {exercise.equipment.length > 0 && (
                  <small className="exercise-equipment">
                    Material: {exercise.equipment.join(", ")}
                  </small>
                )}
              </div>

              <div className="exercise-card-actions">
                <button
                  type="button"
                  className={`exercise-favorite-button ${exercise.isFavorite ? "active" : ""}`}
                  onClick={() => void handleFavorite(exercise)}
                  aria-label={exercise.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                  title={exercise.isFavorite ? "Aus Favoriten entfernen" : "Favorit"}
                >
                  <Star aria-hidden="true" fill={exercise.isFavorite ? "currentColor" : "none"} />
                </button>
                {exercise.videos.length > 0 && (
                  <button
                    type="button"
                    className="exercise-action-link"
                    onClick={() => openEditor(exercise, "videos")}
                    aria-label={`Videos zu ${exercise.name} öffnen`}
                    title={`${exercise.videos.length} Video${exercise.videos.length === 1 ? "" : "s"}`}
                  >
                    <Video aria-hidden="true" />
                    <span className="exercise-video-count">{exercise.videos.length}</span>
                  </button>
                )}
                {exercise.videoUrl && (
                  <a
                    className="exercise-action-link"
                    href={exercise.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Video oder Link zu ${exercise.name} öffnen`}
                    title="Video oder Link öffnen"
                  >
                    <Video aria-hidden="true" />
                    <ExternalLink aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  className="exercise-edit-button"
                  onClick={() => openEditor(exercise)}
                  aria-label={`${exercise.name} ${canEdit ? "bearbeiten" : "anzeigen"}`}
                  title={canEdit ? "Bearbeiten" : "Anzeigen"}
                >
                  {canEdit ? <Pencil aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editorExercise !== undefined && (
        <ExerciseEditor
          key={editorExercise?.id ?? "new-exercise"}
          exercise={editorExercise}
          categories={data.categories}
          groups={data.groups}
          organizationId={organizationId ?? ""}
          initialSection={editorInitialSection}
          canEdit={canEdit}
          busy={busy}
          onCancel={() => setEditorExercise(undefined)}
          onSubmit={handleSave}
          onVideosChanged={(videos) => {
            if (editorExercise?.id) handleVideosChanged(editorExercise.id, videos);
          }}
        />
      )}
    </section>
  );
}
