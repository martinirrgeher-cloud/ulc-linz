import {
  AlertTriangle,
  Check,
  CheckCheck,
  MoreVertical,
  Phone,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import {
  athleteDisplayName,
} from "@/features/training-session/core";
import type {
  AthleteNameSort,
  AttendanceStatus,
  TrainingDraft,
  TrainingParticipant,
} from "@/features/training-session/types";

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
}> = [
  { value: "open", label: "Offen" },
  { value: "present", label: "Da" },
  { value: "absent", label: "Fehlt" },
];

function attendanceStatusIcon(status: AttendanceStatus) {
  if (status === "present") return <Check aria-hidden="true" />;
  if (status === "absent") return <X aria-hidden="true" />;
  return <span className="status-question-mark" aria-hidden="true">?</span>;
}

type TrainingAttendanceWorkspaceProps = {
  activeCategory: AttendanceStatus;
  counts: Record<AttendanceStatus, number>;
  sortMode: AthleteNameSort;
  canEdit: boolean;
  sessionLoading: boolean;
  searchTerm: string;
  participants: TrainingParticipant[];
  categoryParticipants: TrainingParticipant[];
  draft: TrainingDraft;
  onCategoryChange: (status: AttendanceStatus) => void;
  onSortModeChange: (mode: AthleteNameSort) => void;
  onAddAthlete: () => void;
  onSearchTermChange: (value: string) => void;
  onMarkAllOpenAbsent: () => void;
  onShowContacts: (participant: TrainingParticipant) => void;
  onManageAthlete: (participant: TrainingParticipant) => void;
  onSetAttendance: (athleteId: string, status: AttendanceStatus) => void;
};

export function TrainingAttendanceWorkspace({
  activeCategory,
  counts,
  sortMode,
  canEdit,
  sessionLoading,
  searchTerm,
  participants,
  categoryParticipants,
  draft,
  onCategoryChange,
  onSortModeChange,
  onAddAthlete,
  onSearchTermChange,
  onMarkAllOpenAbsent,
  onShowContacts,
  onManageAthlete,
  onSetAttendance,
}: TrainingAttendanceWorkspaceProps) {
  return (
    <section className="attendance-workspace compact">
      <div className="attendance-toolbar">
        <div className="attendance-category-tabs" role="tablist" aria-label="Status">
          {STATUS_OPTIONS.map((status) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === status.value}
              className={`${status.value} ${activeCategory === status.value ? "active" : ""}`}
              onClick={() => onCategoryChange(status.value)}
              key={status.value}
            >
              <strong>{counts[status.value]}</strong>
              <span>{status.label}</span>
            </button>
          ))}
        </div>

        <div className="attendance-list-tools">
          <div className="attendance-sort-row">
            <div className="name-sort-toggle" aria-label="Namenssortierung">
              <button
                type="button"
                className={sortMode === "firstName" ? "active" : ""}
                onClick={() => onSortModeChange("firstName")}
              >
                Vorname
              </button>
              <button
                type="button"
                className={sortMode === "lastName" ? "active" : ""}
                onClick={() => onSortModeChange("lastName")}
              >
                Nachname
              </button>
            </div>
            {canEdit && (
              <button
                type="button"
                className="icon-button add-child-icon-button"
                onClick={onAddAthlete}
                disabled={sessionLoading}
                title="Kind hinzufügen"
                aria-label="Kind hinzufügen"
              >
                <UserPlus aria-hidden="true" />
              </button>
            )}
          </div>

          <label className="attendance-search compact">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Name suchen"
            />
          </label>
        </div>

        <div className="attendance-progress-row">
          <span>
            <CheckCheck aria-hidden="true" />
            {participants.length - counts.open} von {participants.length} erfasst
          </span>
          {canEdit && counts.open > 0 && draft.state !== "cancelled" && (
            <button type="button" className="text-button" onClick={onMarkAllOpenAbsent}>
              Alle offenen auf Fehlt
            </button>
          )}
        </div>
      </div>

      {draft.state === "cancelled" ? (
        <div className="training-cancelled-state">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Training abgesagt</strong>
            <p>Die Anwesenheitsauswahl ist gesperrt, bis die Absage aufgehoben wird.</p>
          </div>
        </div>
      ) : categoryParticipants.length === 0 ? (
        <div className="inline-empty-state attendance-empty">
          {searchTerm
            ? "Keine passenden Kinder in dieser Kategorie."
            : activeCategory === "open"
              ? "Alle Kinder wurden bereits zugeordnet."
              : "In dieser Kategorie befinden sich noch keine Kinder."}
        </div>
      ) : (
        <div className="compact-attendance-list">
          {categoryParticipants.map((participant) => {
            const currentStatus = draft.attendance[participant.athleteId] ?? "open";
            const displayName = athleteDisplayName(participant, sortMode);
            return (
              <article className="compact-attendance-row" key={participant.athleteId}>
                <div className="compact-athlete-name">
                  <strong>{displayName}</strong>
                </div>

                <div className="compact-athlete-actions">
                  {participant.contacts.length > 0 ? (
                    <button
                      type="button"
                      className="icon-button contact-button"
                      onClick={() => onShowContacts(participant)}
                      aria-label={`Kontaktdaten von ${displayName} anzeigen`}
                      title="Notfallkontakte"
                    >
                      <Phone aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="contact-button-placeholder" aria-hidden="true" />
                  )}
                  {canEdit && participant.isActive && (
                    <button
                      type="button"
                      className="icon-button athlete-more-button"
                      onClick={() => onManageAthlete(participant)}
                      aria-label={`${displayName} verwalten`}
                      title="Athlet verwalten"
                    >
                      <MoreVertical aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="compact-status-actions" aria-label="Status wählen">
                  {STATUS_OPTIONS.filter((status) => status.value !== currentStatus).map(
                    (status) => (
                      <button
                        type="button"
                        className={status.value}
                        onClick={() => onSetAttendance(participant.athleteId, status.value)}
                        disabled={!canEdit}
                        aria-label={`Status ${status.label} setzen`}
                        title={status.label}
                        key={status.value}
                      >
                        {attendanceStatusIcon(status.value)}
                      </button>
                    ),
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
