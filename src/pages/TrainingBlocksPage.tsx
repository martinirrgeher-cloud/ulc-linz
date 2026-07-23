import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Clock3,
  Copy,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  duplicateTrainingBlock,
  loadTrainingBlocks,
  saveTrainingBlock,
} from "@/features/training-blocks/api";
import { TrainingBlockEditor } from "@/features/training-blocks/TrainingBlockEditor";
import type {
  TrainingBlock,
  TrainingBlockData,
  TrainingBlockInput,
} from "@/features/training-blocks/types";

type ActivityFilter = "active" | "inactive" | "all";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Die Trainingsblöcke konnten nicht geladen werden.";
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
  const [groupFilter, setGroupFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("active");
  const [editorBlock, setEditorBlock] = useState<TrainingBlock | null | undefined>(undefined);

  const loadData = useCallback(async (): Promise<TrainingBlockData | null> => {
    if (!organizationId) return null;
    setLoading(true);
    setError(null);
    try {
      const next = await loadTrainingBlocks(organizationId, true);
      setData(next);
      return next;
    } catch (loadError) {
      setError(errorMessage(loadError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const groupById = useMemo(
    () => new Map(data.groups.map((group) => [group.id, group])),
    [data.groups],
  );

  const counts = useMemo(() => ({
    active: data.blocks.filter((block) => block.isActive).length,
    inactive: data.blocks.filter((block) => !block.isActive).length,
  }), [data.blocks]);

  const filteredBlocks = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de");
    return data.blocks
      .filter((block) => {
        if (activityFilter === "active" && !block.isActive) return false;
        if (activityFilter === "inactive" && block.isActive) return false;
        if (groupFilter === "club" && block.groupIds.length > 0) return false;
        if (groupFilter !== "all" && groupFilter !== "club" && !block.groupIds.includes(groupFilter)) return false;
        if (!search) return true;

        return [
          block.name,
          block.goal ?? "",
          block.description ?? "",
          ...block.items.map((item) => item.exerciseName),
        ].some((value) => value.toLocaleLowerCase("de").includes(search));
      })
      .sort((left, right) => left.name.localeCompare(right.name, "de", { sensitivity: "base" }));
  }, [activityFilter, data.blocks, groupFilter, searchTerm]);

  async function handleSave(values: TrainingBlockInput) {
    if (!organizationId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await saveTrainingBlock(organizationId, editorBlock?.id ?? null, values);
      setEditorBlock(undefined);
      setSuccess(editorBlock ? "Der Trainingsblock wurde gespeichert." : "Der Trainingsblock wurde angelegt.");
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(block: TrainingBlock) {
    if (!organizationId || busyBlockId) return;
    setBusyBlockId(block.id);
    setError(null);
    setSuccess(null);
    try {
      const duplicatedId = await duplicateTrainingBlock(organizationId, block.id);
      const next = await loadData();
      setSuccess("Der Trainingsblock wurde dupliziert.");
      const duplicatedBlock = next?.blocks.find((item) => item.id === duplicatedId);
      if (duplicatedBlock) setEditorBlock(duplicatedBlock);
    } catch (duplicateError) {
      setError(errorMessage(duplicateError));
    } finally {
      setBusyBlockId(null);
    }
  }

  return (
    <section className="training-blocks-page">
      <div className="training-blocks-heading">
        <div>
          <p className="eyebrow">Trainingsplanung</p>
          <h1>Trainingsblöcke</h1>
          <p>Wiederverwendbare Übungsfolgen erstellen und Leistungsgruppen zuordnen.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={() => setEditorBlock(null)}
            disabled={loading || busy || data.exercises.filter((exercise) => exercise.isActive).length === 0}
          >
            <Plus aria-hidden="true" />
            Block
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="training-blocks-toolbar">
        <label className="training-block-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Block oder Übung suchen"
            aria-label="Trainingsblock suchen"
          />
        </label>

        <label className="training-block-group-filter">
          <Filter aria-hidden="true" />
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            aria-label="Leistungsgruppe filtern"
          >
            <option value="all">Alle Gruppen</option>
            <option value="club">Vereinsweit</option>
            {data.groups.map((group) => (
              <option value={group.id} key={group.id}>{group.shortName || group.name}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="secondary-button training-block-refresh"
          onClick={() => void loadData()}
          disabled={loading || busy}
          aria-label="Trainingsblöcke aktualisieren"
          title="Aktualisieren"
        >
          <RefreshCw aria-hidden="true" />
          <span>Aktualisieren</span>
        </button>
      </div>

      <div className="status-filter" aria-label="Status der Trainingsblöcke filtern">
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
          Alle <span>{data.blocks.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="management-loading">
          <div className="spinner" aria-hidden="true" />
          Trainingsblöcke werden geladen …
        </div>
      ) : data.exercises.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck aria-hidden="true" />
          <h2>Keine Übungen vorhanden</h2>
          <p>Lege zuerst Übungen im Übungskatalog an.</p>
        </div>
      ) : filteredBlocks.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck aria-hidden="true" />
          <h2>Keine Trainingsblöcke gefunden</h2>
          <p>{data.blocks.length === 0 ? "Lege den ersten wiederverwendbaren Trainingsblock an." : "Passe Suche oder Filter an."}</p>
          {canEdit && data.blocks.length === 0 && (
            <button type="button" className="primary-button" onClick={() => setEditorBlock(null)}>
              <Plus aria-hidden="true" />
              Ersten Block anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="training-block-list">
          {filteredBlocks.map((block) => {
            const assignedGroups = block.groupIds
              .map((groupId) => groupById.get(groupId))
              .filter((group): group is NonNullable<typeof group> => Boolean(group));

            return (
              <article className={`training-block-card ${block.isActive ? "" : "inactive"}`} key={block.id}>
                <div className="training-block-card-main">
                  <div className="training-block-card-title">
                    <span className="training-block-status-dot" title={block.isActive ? "Aktiv" : "Inaktiv"} />
                    <div>
                      <h2>{block.name}</h2>
                      {block.goal && <p>{block.goal}</p>}
                    </div>
                  </div>

                  <div className="training-block-card-meta">
                    <span>{block.items.length} Übung{block.items.length === 1 ? "" : "en"}</span>
                    {block.estimatedMinutes && (
                      <span><Clock3 aria-hidden="true" /> {block.estimatedMinutes} min</span>
                    )}
                  </div>

                  <div className="training-block-card-groups">
                    {assignedGroups.length === 0 ? (
                      <span>Vereinsweit</span>
                    ) : (
                      assignedGroups.map((group) => (
                        <span key={group.id}>{group.shortName || group.name}</span>
                      ))
                    )}
                  </div>

                  <ol className="training-block-card-exercises">
                    {block.items.slice(0, 4).map((item) => (
                      <li key={item.id}>{item.exerciseName}</li>
                    ))}
                  </ol>
                  {block.items.length > 4 && <small>+ {block.items.length - 4} weitere</small>}
                </div>

                <div className="training-block-card-actions">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void handleDuplicate(block)}
                      disabled={busyBlockId === block.id}
                      aria-label={`${block.name} duplizieren`}
                      title="Duplizieren"
                    >
                      <Copy aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditorBlock(block)}
                    aria-label={`${block.name} ${canEdit ? "bearbeiten" : "anzeigen"}`}
                    title={canEdit ? "Bearbeiten" : "Anzeigen"}
                  >
                    {canEdit ? <Pencil aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editorBlock !== undefined && (
        <TrainingBlockEditor
          key={editorBlock?.id ?? "new-training-block"}
          block={editorBlock}
          groups={data.groups}
          exercises={data.exercises}
          canEdit={canEdit}
          busy={busy}
          onCancel={() => setEditorBlock(undefined)}
          onSubmit={handleSave}
        />
      )}
    </section>
  );
}
