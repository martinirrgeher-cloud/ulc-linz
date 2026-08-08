import { callJsonRpc } from "@/lib/supabase-rpc";
import { isRecord, numberOrNull } from "@/lib/json-value";
import type {
  TrainingOverviewAthlete,
  TrainingOverviewDate,
  TrainingOverviewDocumentationStatus,
  TrainingOverviewGroup,
  TrainingOverviewPlan,
  TrainingOverviewRegistration,
  TrainingOverviewStatus,
  TrainingWeekOverview,
} from "@/features/training-overview/types";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseDocumentationStatus(value: unknown): TrainingOverviewDocumentationStatus {
  if (value === "in_progress" || value === "completed" || value === "partial" || value === "aborted") return value;
  return "not_started";
}

function parseStatus(value: unknown): TrainingOverviewStatus {
  if (value === "coming" || value === "maybe" || value === "unavailable") return value;
  return "open";
}

function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is number => (
    typeof entry === "number" && Number.isInteger(entry) && entry >= 1 && entry <= 7
  )))].sort((left, right) => left - right);
}

function parseGroups(value: unknown): TrainingOverviewGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      shortName: optionalString(item.short_name),
      regularWeekdays: parseWeekdays(item.regular_weekdays),
    }];
  });
}

function parseDates(value: unknown): TrainingOverviewDate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.date !== "string" || typeof item.weekday !== "number") return [];
    return [{ date: item.date, weekday: item.weekday }];
  });
}

function parseRegistrations(value: unknown): TrainingOverviewRegistration[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.date !== "string") return [];
    return [{
      date: item.date,
      status: parseStatus(item.status),
      comment: stringValue(item.comment),
      isLate: item.is_late === true,
    }];
  });
}

function parseAthletes(value: unknown): TrainingOverviewAthlete[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.first_name !== "string"
      || typeof item.last_name !== "string"
    ) return [];
    return [{
      id: item.id,
      firstName: item.first_name,
      lastName: item.last_name,
      registrations: parseRegistrations(item.registrations),
    }];
  });
}

function parsePlans(value: unknown): TrainingOverviewPlan[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.athlete_id !== "string"
      || typeof item.training_date !== "string"
      || typeof item.title !== "string"
    ) return [];
    return [{
      id: item.id,
      athleteId: item.athlete_id,
      trainingDate: item.training_date,
      title: item.title,
      status: item.status === "published" ? "published" : "draft",
      exerciseCount: numberValue(item.exercise_count),
      totalMinutes: numberValue(item.total_minutes),
      sessionId: optionalString(item.session_id),
      documentationStatus: parseDocumentationStatus(item.documentation_status),
      actualMinutes: numberOrNull(item.actual_minutes),
      overallRpe: numberOrNull(item.overall_rpe),
      completedExerciseCount: numberValue(item.completed_exercise_count),
    }];
  });
}

export async function loadTrainingWeekOverview(
  organizationId: string,
  weekStart: string,
  groupId: string | null,
): Promise<TrainingWeekOverview> {
  const data = await callJsonRpc("training_plan_week_overview", {
    p_organization_id: organizationId,
    p_week_start: weekStart,
    p_group_id: groupId,
  });
  if (!isRecord(data)) throw new Error("Die Trainingsplan-Übersicht konnte nicht geladen werden.");

  const groups = parseGroups(data.groups);
  const selectedGroupId = optionalString(data.selected_group_id);

  return {
    weekStart: stringValue(data.week_start) || weekStart,
    weekEnd: stringValue(data.week_end) || weekStart,
    groups,
    group: groups.find((group) => group.id === selectedGroupId) ?? null,
    dates: parseDates(data.dates),
    athletes: parseAthletes(data.athletes),
    plans: parsePlans(data.plans),
  };
}
