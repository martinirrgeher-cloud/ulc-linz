import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import {
  createAthlete,
  createTrainingGroup,
  loadAthleteManagement,
  updateAthlete,
  updateTrainingGroup,
} from "@/features/athletes/api";
import {
  AthleteEditor,
  type AthleteEditorMode,
} from "@/features/athletes/AthleteEditor";
import {
  TrainingGroupEditor,
  type TrainingGroupEditorMode,
} from "@/features/athletes/TrainingGroupEditor";
import type {
  Athlete,
  AthleteInput,
  TrainingGroup,
  TrainingGroupInput,
} from "@/features/athletes/types";

type ActiveFilter = "active" | "inactive" | "all";
type AthleteSort = "lastName" | "firstName" | "birthYearAsc" | "birthYearDesc";
type ViewTab = "athletes" | "groups";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Die Stammdaten konnten nicht geladen werden.";
}

function athleteName(athlete: Athlete): string {
  return `${athlete.firstName} ${athlete.lastName}`.trim();
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "de-AT", { sensitivity: "base" });
}

function sortAthletes(items: Athlete[], mode: AthleteSort): Athlete[] {
  return [...items].sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;

    if (mode === "firstName") {
      return (
        compareText(left.firstName, right.firstName) ||
        compareText(left.lastName, right.lastName)
      );
    }

    if (mode === "birthYearAsc" || mode === "birthYearDesc") {
      const leftYear = left.birthYear ?? (mode === "birthYearAsc" ? 9999 : -1);
      const rightYear = right.birthYear ?? (mode === "birthYearAsc" ? 9999 : -1);
      const difference = leftYear - rightYear;
      if (difference !== 0) return mode === "birthYearAsc" ? difference : -difference;
    }

    return (
      compareText(left.lastName, right.lastName) ||
      compareText(left.firstName, right.firstName)
    );
  });
}

export function AthleteManagementPage() {
  const { appContext, canViewModule, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canView = canViewModule("athletes");
  const canEdit = canEditModule("athletes");

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>("athletes");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<AthleteSort>("lastName");
  const [athleteEditor, setAthleteEditor] = useState<AthleteEditorMode | null>(null);
  const [groupEditor, setGroupEditor] = useState<TrainingGroupEditorMode | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId || !canView) return;

    setLoading(true);
    setError(null);
    try {
      const data = await loadAthleteManagement(organizationId);
      setAthletes(data.athletes);
      setGroups(data.groups);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canView, organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      ]
        .join(" ")
        .toLocaleLowerCase("de-AT");

      return searchable.includes(search);
    });

    return sortAthletes(filtered, sortMode);
  }, [activeFilter, athletes, groupFilter, searchTerm, sortMode]);

  const filteredGroups = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de-AT");
    return groups.filter((group) => {
      if (activeFilter === "active" && !group.isActive) return false;
      if (activeFilter === "inactive" && group.isActive) return false;
      if (!search) return true;
      return [group.name, group.shortName ?? "", group.description ?? ""]
        .join(" ")
        .toLocaleLowerCase("de-AT")
        .includes(search);
    });
  }, [activeFilter, groups, searchTerm]);

  const counts = useMemo(
    () => ({
      activeAthletes: athletes.filter((athlete) => athlete.isActive).length,
      inactiveAthletes: athletes.filter((athlete) => !athlete.isActive).length,
      activeGroups: groups.filter((group) => group.isActive).length,
    }),
    [athletes, groups],
  );

  if (!canView || !organizationId) return <Navigate to="/kein-zugriff" replace />;
  const activeOrganizationId = organizationId;

  function closeEditors() {
    setAthleteEditor(null);
    setGroupEditor(null);
  }

  function openCreateEditor() {
    setSuccess(null);
    if (tab === "athletes") {
      setGroupEditor(null);
      setAthleteEditor({ type: "create" });
    } else {
      setAthleteEditor(null);
      setGroupEditor({ type: "create" });
    }
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
        await updateAthlete(activeOrganizationId, athleteEditor.athlete.id, values);
        setSuccess("Die Athletendaten wurden gespeichert.");
      }
      setAthleteEditor(null);
      await loadData();
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
        await updateTrainingGroup(activeOrganizationId, groupEditor.group.id, values);
        setSuccess("Die Trainingsgruppe wurde gespeichert.");
      }
      setGroupEditor(null);
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="athlete-management-page">
      <Link to="/" className="back-link">
        <ArrowLeft aria-hidden="true" />
        Zur Modulübersicht
      </Link>

      <div className="management-page-heading">
        <div>
          <p className="eyebrow">Gemeinsame Stammdaten</p>
          <h1>Athleten und Trainingsgruppen</h1>
          <p>
            Zentrale Grundlage für Kindertraining, Leistungsgruppe und Trainingsplanung.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={openCreateEditor}
            disabled={loading || busy}
          >
            <Plus aria-hidden="true" />
            {tab === "athletes" ? "Athlet anlegen" : "Gruppe anlegen"}
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="read-only-notice">
          Du besitzt für dieses Modul Leserechte. Änderungen sind nur mit Bearbeitungsrecht möglich.
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {athleteEditor && (
        <AthleteEditor
          key={
            athleteEditor.type === "create"
              ? "new-athlete"
              : `athlete-${athleteEditor.athlete.id}`
          }
          mode={athleteEditor}
          groups={groups}
          busy={busy}
          onCancel={closeEditors}
          onSubmit={handleAthleteSubmit}
        />
      )}

      {groupEditor && (
        <TrainingGroupEditor
          key={
            groupEditor.type === "create" ? "new-group" : `group-${groupEditor.group.id}`
          }
          mode={groupEditor}
          busy={busy}
          onCancel={closeEditors}
          onSubmit={handleGroupSubmit}
        />
      )}

      <div className="summary-grid" aria-label="Übersicht Stammdaten">
        <div className="summary-card">
          <UserRound aria-hidden="true" />
          <span>
            <strong>{counts.activeAthletes}</strong>
            aktive Athleten
          </span>
        </div>
        <div className="summary-card">
          <UsersRound aria-hidden="true" />
          <span>
            <strong>{counts.activeGroups}</strong>
            aktive Gruppen
          </span>
        </div>
        <div className="summary-card subtle">
          <CalendarDays aria-hidden="true" />
          <span>
            <strong>{counts.inactiveAthletes}</strong>
            inaktive Athleten
          </span>
        </div>
      </div>

      <div className="management-tabs" role="tablist" aria-label="Stammdatenbereich">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "athletes"}
          className={tab === "athletes" ? "active" : ""}
          onClick={() => {
            setTab("athletes");
            setGroupFilter("all");
            closeEditors();
          }}
        >
          <UserRound aria-hidden="true" />
          Athleten
          <span>{athletes.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "groups"}
          className={tab === "groups" ? "active" : ""}
          onClick={() => {
            setTab("groups");
            setGroupFilter("all");
            closeEditors();
          }}
        >
          <Layers3 aria-hidden="true" />
          Trainingsgruppen
          <span>{groups.length}</span>
        </button>
      </div>

      <div className="athlete-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={tab === "athletes" ? "Athlet suchen" : "Gruppe suchen"}
            aria-label={tab === "athletes" ? "Athlet suchen" : "Trainingsgruppe suchen"}
          />
        </label>

        {tab === "athletes" && (
          <select
            className="toolbar-select"
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            aria-label="Nach Trainingsgruppe filtern"
          >
            <option value="all">Alle Gruppen</option>
            {groups.map((group) => (
              <option value={group.id} key={group.id}>
                {group.name}{group.isActive ? "" : " (inaktiv)"}
              </option>
            ))}
          </select>
        )}

        {tab === "athletes" && (
          <select
            className="toolbar-select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as AthleteSort)}
            aria-label="Athleten sortieren"
          >
            <option value="lastName">Nachname</option>
            <option value="firstName">Vorname</option>
            <option value="birthYearAsc">Jahrgang aufsteigend</option>
            <option value="birthYearDesc">Jahrgang absteigend</option>
          </select>
        )}

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

      <div className="status-filter" aria-label="Status filtern">
        {(
          [
            ["active", "Aktiv"],
            ["inactive", "Inaktiv"],
            ["all", "Alle"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            className={activeFilter === value ? "active" : ""}
            onClick={() => setActiveFilter(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="management-loading">
          <div className="spinner" aria-hidden="true" />
          Stammdaten werden geladen …
        </div>
      ) : tab === "athletes" ? (
        filteredAthletes.length === 0 ? (
          <div className="empty-state">
            <UserRound aria-hidden="true" />
            <h2>Keine Athleten gefunden</h2>
            <p>Passe Suche oder Filter an oder lege den ersten Athleten an.</p>
          </div>
        ) : (
          <div className="athlete-list">
            {filteredAthletes.map((athlete) => (
              <article
                className={`athlete-card ${athlete.isActive ? "" : "inactive"}`}
                key={athlete.id}
              >
                <div className="athlete-identity">
                  <div className="athlete-avatar" aria-hidden="true">
                    {athlete.firstName.charAt(0).toUpperCase()}
                    {athlete.lastName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2>{athleteName(athlete)}</h2>
                    <p>
                      {athlete.birthYear ? `Jahrgang ${athlete.birthYear}` : "Kein Geburtsjahr"}
                    </p>
                  </div>
                </div>

                <div className="athlete-groups">
                  {athlete.groups.length > 0 ? (
                    athlete.groups.map((group) => (
                      <span className={group.isActive ? "" : "inactive"} key={group.id}>
                        {group.shortName || group.name}
                      </span>
                    ))
                  ) : (
                    <span className="unassigned">Keine Gruppe</span>
                  )}
                </div>

                <div className="athlete-notes">
                  {athlete.notes ? athlete.notes : "Keine interne Notiz"}
                </div>

                <div className="athlete-card-actions">
                  <span className={`record-status ${athlete.isActive ? "active" : "inactive"}`}>
                    {athlete.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setSuccess(null);
                        setGroupEditor(null);
                        setAthleteEditor({ type: "edit", athlete });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Pencil aria-hidden="true" />
                      Bearbeiten
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )
      ) : filteredGroups.length === 0 ? (
        <div className="empty-state">
          <Layers3 aria-hidden="true" />
          <h2>Keine Trainingsgruppen gefunden</h2>
          <p>Passe Suche oder Filter an oder lege die erste Gruppe an.</p>
        </div>
      ) : (
        <div className="training-group-grid">
          {filteredGroups.map((group) => (
            <article
              className={`training-group-card ${group.isActive ? "" : "inactive"}`}
              key={group.id}
            >
              <div className="training-group-card-heading">
                <div className="group-icon" aria-hidden="true">
                  <UsersRound />
                </div>
                <div>
                  <h2>{group.name}</h2>
                  {group.shortName && <p>{group.shortName}</p>}
                </div>
              </div>

              <p className="training-group-description">
                {group.description || "Keine Beschreibung hinterlegt."}
              </p>

              <dl className="training-group-details">
                <div>
                  <dt>Athleten</dt>
                  <dd>{group.athleteCount}</dd>
                </div>
                <div>
                  <dt>Reihenfolge</dt>
                  <dd>{group.sortOrder}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{group.isActive ? "Aktiv" : "Inaktiv"}</dd>
                </div>
              </dl>

              {canEdit && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSuccess(null);
                    setAthleteEditor(null);
                    setGroupEditor({ type: "edit", group });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Pencil aria-hidden="true" />
                  Bearbeiten
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
