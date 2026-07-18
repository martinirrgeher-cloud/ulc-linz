import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Layers3,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
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
import type {
  Athlete,
  AthleteInput,
  Trainer,
  TrainerInput,
  TrainingGroup,
  TrainingGroupInput,
} from "@/features/athletes/types";

type ActiveFilter = "active" | "inactive" | "all";
type AthleteSort = "lastName" | "firstName" | "birthYearAsc" | "birthYearDesc";
type ViewTab = "athletes" | "groups" | "trainers";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Die Stammdaten konnten nicht geladen werden.";
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<ViewTab>(() => parseInitialTab(searchParams.get("tab")));
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<AthleteSort>("lastName");
  const [athleteEditor, setAthleteEditor] = useState<AthleteEditorMode | null>(null);
  const [groupEditor, setGroupEditor] = useState<TrainingGroupEditorMode | null>(null);
  const [trainerEditor, setTrainerEditor] = useState<TrainerEditorMode | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId || !canView) return;

    setLoading(true);
    setError(null);
    try {
      const data = await loadAthleteManagement(organizationId);
      setAthletes(data.athletes);
      setGroups(data.groups);
      setTrainers(data.trainers);
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

  const filteredTrainers = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("de-AT");
    return trainers.filter((trainer) => {
      if (activeFilter === "active" && !trainer.isActive) return false;
      if (activeFilter === "inactive" && trainer.isActive) return false;
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
    });
  }, [activeFilter, groups, searchTerm, trainers]);

  const counts = useMemo(
    () => ({
      activeAthletes: athletes.filter((athlete) => athlete.isActive).length,
      inactiveAthletes: athletes.filter((athlete) => !athlete.isActive).length,
      activeGroups: groups.filter((group) => group.isActive).length,
      activeTrainers: trainers.filter((trainer) => trainer.isActive).length,
    }),
    [athletes, groups, trainers],
  );

  if (!canView || !organizationId) return <Navigate to="/kein-zugriff" replace />;
  const activeOrganizationId = organizationId;

  function closeEditors() {
    setAthleteEditor(null);
    setGroupEditor(null);
    setTrainerEditor(null);
  }

  function switchTab(nextTab: ViewTab) {
    setTab(nextTab);
    setSearchTerm("");
    setGroupFilter("all");
    closeEditors();
    setSearchParams(nextTab === "athletes" ? {} : { tab: nextTab }, { replace: true });
  }

  function openCreateEditor() {
    setSuccess(null);
    closeEditors();
    if (tab === "athletes") setAthleteEditor({ type: "create" });
    if (tab === "groups") setGroupEditor({ type: "create" });
    if (tab === "trainers") setTrainerEditor({ type: "create" });
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

  async function handleTrainerSubmit(values: TrainerInput) {
    if (!trainerEditor) return;

    setBusy(true);
    setSuccess(null);
    try {
      if (trainerEditor.type === "create") {
        await createTrainer(activeOrganizationId, values);
        setSuccess("Der Trainer wurde angelegt.");
      } else {
        await updateTrainer(activeOrganizationId, trainerEditor.trainer.id, values);
        setSuccess("Die Trainerdaten wurden gespeichert.");
      }
      setTrainerEditor(null);
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  const createLabel = tab === "athletes" ? "Athlet anlegen" : tab === "groups" ? "Gruppe anlegen" : "Trainer anlegen";
  const searchLabel = tab === "athletes" ? "Athlet suchen" : tab === "groups" ? "Gruppe suchen" : "Trainer suchen";

  return (
    <section className="athlete-management-page">
      <div className="management-page-heading">
        <div>
          <p className="eyebrow">Gemeinsame Stammdaten</p>
          <h1>Athleten, Trainer &amp; Gruppen</h1>
        </div>
        {canEdit && (
          <button type="button" className="primary-button" onClick={openCreateEditor} disabled={loading || busy}>
            <Plus aria-hidden="true" />
            {createLabel}
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
          key={athleteEditor.type === "create" ? "new-athlete" : `athlete-${athleteEditor.athlete.id}`}
          mode={athleteEditor}
          groups={groups}
          busy={busy}
          onCancel={closeEditors}
          onSubmit={handleAthleteSubmit}
        />
      )}

      {groupEditor && (
        <TrainingGroupEditor
          key={groupEditor.type === "create" ? "new-group" : `group-${groupEditor.group.id}`}
          mode={groupEditor}
          busy={busy}
          onCancel={closeEditors}
          onSubmit={handleGroupSubmit}
        />
      )}

      {trainerEditor && (
        <TrainerEditor
          key={trainerEditor.type === "create" ? "new-trainer" : `trainer-${trainerEditor.trainer.id}`}
          mode={trainerEditor}
          groups={groups}
          busy={busy}
          onCancel={closeEditors}
          onSubmit={handleTrainerSubmit}
        />
      )}

      <div className="summary-grid" aria-label="Übersicht Stammdaten">
        <div className="summary-card">
          <UserRound aria-hidden="true" />
          <span><strong>{counts.activeAthletes}</strong> aktive Athleten</span>
        </div>
        <div className="summary-card">
          <UsersRound aria-hidden="true" />
          <span><strong>{counts.activeGroups}</strong> aktive Gruppen</span>
        </div>
        <div className="summary-card">
          <UserRoundCog aria-hidden="true" />
          <span><strong>{counts.activeTrainers}</strong> aktive Trainer</span>
        </div>
        <div className="summary-card subtle">
          <CalendarDays aria-hidden="true" />
          <span><strong>{counts.inactiveAthletes}</strong> inaktive Athleten</span>
        </div>
      </div>

      <div className="management-tabs three-tabs" role="tablist" aria-label="Stammdatenbereich">
        <button type="button" role="tab" aria-selected={tab === "athletes"} className={tab === "athletes" ? "active" : ""} onClick={() => switchTab("athletes")}>
          <UserRound aria-hidden="true" /> Athleten <span>{athletes.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "groups"} className={tab === "groups" ? "active" : ""} onClick={() => switchTab("groups")}>
          <Layers3 aria-hidden="true" /> Gruppen <span>{groups.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "trainers"} className={tab === "trainers" ? "active" : ""} onClick={() => switchTab("trainers")}>
          <UserRoundCog aria-hidden="true" /> Trainer <span>{trainers.length}</span>
        </button>
      </div>

      <div className="athlete-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
          />
        </label>

        {tab === "athletes" && (
          <select className="toolbar-select" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} aria-label="Nach Trainingsgruppe filtern">
            <option value="all">Alle Gruppen</option>
            {groups.map((group) => (
              <option value={group.id} key={group.id}>{group.name}{group.isActive ? "" : " (inaktiv)"}</option>
            ))}
          </select>
        )}

        {tab === "athletes" && (
          <select className="toolbar-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as AthleteSort)} aria-label="Athleten sortieren">
            <option value="lastName">Nachname</option>
            <option value="firstName">Vorname</option>
            <option value="birthYearAsc">Jahrgang aufsteigend</option>
            <option value="birthYearDesc">Jahrgang absteigend</option>
          </select>
        )}

        <button type="button" className="secondary-button" onClick={() => void loadData()} disabled={loading || busy}>
          <RefreshCw aria-hidden="true" /> Aktualisieren
        </button>
      </div>

      <div className="status-filter" aria-label="Status filtern">
        {([['active', 'Aktiv'], ['inactive', 'Inaktiv'], ['all', 'Alle']] as const).map(([value, label]) => (
          <button type="button" className={activeFilter === value ? "active" : ""} onClick={() => setActiveFilter(value)} key={value}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" /> Stammdaten werden geladen …</div>
      ) : tab === "athletes" ? (
        filteredAthletes.length === 0 ? (
          <div className="empty-state"><UserRound aria-hidden="true" /><h2>Keine Athleten gefunden</h2><p>Passe Suche oder Filter an oder lege den ersten Athleten an.</p></div>
        ) : (
          <div className="athlete-list">
            {filteredAthletes.map((athlete) => (
              <article className={`athlete-card ${athlete.isActive ? "" : "inactive"}`} key={athlete.id}>
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
                    <button type="button" className="icon-button athlete-edit-button" onClick={() => { setSuccess(null); closeEditors(); setAthleteEditor({ type: "edit", athlete }); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`${athleteName(athlete)} bearbeiten`} title="Bearbeiten">
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
          <div className="empty-state"><Layers3 aria-hidden="true" /><h2>Keine Trainingsgruppen gefunden</h2><p>Passe Suche oder Filter an oder lege die erste Gruppe an.</p></div>
        ) : (
          <div className="training-group-grid">
            {filteredGroups.map((group) => (
              <article className={`training-group-card ${group.isActive ? "" : "inactive"}`} key={group.id}>
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
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <p className="training-group-description">{group.description || "Keine Beschreibung hinterlegt."}</p>
                <dl className="training-group-details">
                  <div><dt>Athleten</dt><dd>{group.athleteCount}</dd></div>
                  <div><dt>Reihenfolge</dt><dd>{group.sortOrder}</dd></div>
                  <div><dt>Trainingstage</dt><dd>{formatWeekdays(group.regularWeekdays)}</dd></div>
                  <div><dt>Status</dt><dd>{group.isActive ? "Aktiv" : "Inaktiv"}</dd></div>
                  {group.moduleKey !== null && (
                    <div>
                      <dt>Sondertraining</dt>
                      <dd>{group.allowSpecialTraining ? "Erlaubt" : "Deaktiviert"}</dd>
                    </div>
                  )}
                </dl>
                {canEdit && (
                  <button type="button" className="secondary-button" onClick={() => { setSuccess(null); closeEditors(); setGroupEditor({ type: "edit", group }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    <Pencil aria-hidden="true" /> Bearbeiten
                  </button>
                )}
              </article>
            ))}
          </div>
        )
      ) : filteredTrainers.length === 0 ? (
        <div className="empty-state"><UserRoundCog aria-hidden="true" /><h2>Keine Trainer gefunden</h2><p>Lege Trainer an, damit sie bei den Trainings ausgewählt werden können.</p></div>
      ) : (
        <div className="trainer-grid">
          {filteredTrainers.map((trainer) => (
            <article className={`trainer-card ${trainer.isActive ? "" : "inactive"}`} key={trainer.id}>
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
                <button type="button" className="icon-button trainer-edit-button" onClick={() => { setSuccess(null); closeEditors(); setTrainerEditor({ type: "edit", trainer }); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={`${trainerName(trainer)} bearbeiten`} title="Bearbeiten">
                  <Pencil aria-hidden="true" />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
