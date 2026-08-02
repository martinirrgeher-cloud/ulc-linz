import { History } from "lucide-react";
import type { Json } from "@/types/database.generated";
import type { MemberAuditEntry } from "@/features/user-management/types";

export type MemberAuditLogProps = {
  entries: MemberAuditEntry[];
  loading: boolean;
};

const actionNames: Record<string, string> = {
  "member.created": "Benutzerkonto angelegt",
  "member.updated": "Rolle, Status oder Rechte geändert",
  "member.athlete_link_changed": "Athletenverknüpfung geändert",
  "member.trainer_link_changed": "Trainerverknüpfung geändert",
  "member.invitation_sent": "Einladung gesendet",
  "member.invitation_resent": "Einladung erneut gesendet",
  "member.invitation_accepted": "Einladung angenommen",
};

const roleNames: Record<string, string> = {
  admin: "Administrator",
  trainer: "Trainer",
  athlete: "Athlet",
  parent: "Elternteil",
};

const statusNames: Record<string, string> = {
  active: "Aktiv",
  invited: "Eingeladen",
  disabled: "Deaktiviert",
};

function recordValue(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function stringField(data: Record<string, Json | undefined>, key: string): string | null {
  return typeof data[key] === "string" ? data[key] as string : null;
}

function permissionsCount(value: Json | undefined): number {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).length
    : 0;
}

function entryDetails(entry: MemberAuditEntry): string[] {
  const before = recordValue(entry.beforeData);
  const after = recordValue(entry.afterData);
  const details: string[] = [];

  const oldRole = stringField(before, "role");
  const newRole = stringField(after, "role");
  if (oldRole && newRole && oldRole !== newRole) {
    details.push(`Rolle: ${roleNames[oldRole] ?? oldRole} → ${roleNames[newRole] ?? newRole}`);
  }

  const oldStatus = stringField(before, "status");
  const newStatus = stringField(after, "status");
  if (oldStatus && newStatus && oldStatus !== newStatus) {
    details.push(`Status: ${statusNames[oldStatus] ?? oldStatus} → ${statusNames[newStatus] ?? newStatus}`);
  }

  if (before.permissions !== undefined || after.permissions !== undefined) {
    const oldCount = permissionsCount(before.permissions);
    const newCount = permissionsCount(after.permissions);
    if (JSON.stringify(before.permissions) !== JSON.stringify(after.permissions)) {
      details.push(`Modulrechte geändert (${oldCount} → ${newCount})`);
    }
  }

  if (after.display_name_changed === true) details.push("Anzeigename geändert");

  const beforeAthlete = stringField(before, "athlete_id");
  const afterAthlete = stringField(after, "athlete_id");
  if (before.athlete_id !== undefined || after.athlete_id !== undefined) {
    details.push(afterAthlete ? "Athlet verknüpft" : beforeAthlete ? "Athletenverknüpfung entfernt" : "Athletenverknüpfung geändert");
  }

  const beforeTrainer = stringField(before, "trainer_id");
  const afterTrainer = stringField(after, "trainer_id");
  if (before.trainer_id !== undefined || after.trainer_id !== undefined) {
    details.push(afterTrainer ? "Trainer verknüpft" : beforeTrainer ? "Trainerverknüpfung entfernt" : "Trainerverknüpfung geändert");
  }

  const sendCount = after.send_count;
  if (typeof sendCount === "number") details.push(`Versand Nr. ${sendCount}`);

  return details;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MemberAuditLog({ entries, loading }: MemberAuditLogProps) {
  return (
    <details className="e5c-audit-log">
      <summary>
        <span><History aria-hidden="true" /> Änderungsprotokoll</span>
        <span>{entries.length}</span>
      </summary>
      {loading ? (
        <p className="field-hint">Protokoll wird geladen …</p>
      ) : entries.length === 0 ? (
        <p className="field-hint">Noch keine protokollierten Änderungen vorhanden.</p>
      ) : (
        <ol>
          {entries.map((entry) => {
            const details = entryDetails(entry);
            return (
              <li key={entry.auditId}>
                <div>
                  <strong>{actionNames[entry.action] ?? entry.action}</strong>
                  <span>{formatDate(entry.createdAt)} · {entry.actorDisplayName}</span>
                </div>
                {details.length > 0 && <p>{details.join("; ")}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}
