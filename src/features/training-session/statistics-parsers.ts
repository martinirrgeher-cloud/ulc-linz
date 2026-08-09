import type { Json } from "@/types/database.generated";
import { isRecord } from "@/lib/json-value";
import type {
  AthleteStatisticsRow,
  MonthlyStatisticsRow,
  StatisticsNamedItem,
  StatisticsSession,
  TrainerStatisticsRow,
  TrainingStatistics,
  TrainingStatisticsSummary,
} from "@/features/training-session/statistics-types";
import type { TrainingEnvironment, TrainingSessionState } from "@/features/training-session/types";

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEnvironment(value: unknown): TrainingEnvironment {
  return value === "indoor" || value === "outdoor" ? value : null;
}

function parseState(value: unknown): TrainingSessionState {
  return value === "cancelled" ? "cancelled" : "scheduled";
}

function parseNamedItems(value: unknown): StatisticsNamedItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{ id: item.id, name: item.name }];
  });
}

function parseSessions(value: unknown): StatisticsSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.session_date !== "string") {
      return [];
    }
    return [{
      id: item.id,
      sessionDate: item.session_date,
      state: parseState(item.state),
      isSpecial: item.is_special === true,
      environment: parseEnvironment(item.environment),
      note: typeof item.note === "string" ? item.note : "",
      presentCount: numberValue(item.present_count),
      participantCount: numberValue(item.participant_count),
      presentAthletes: parseNamedItems(item.present_athletes),
      trainers: parseNamedItems(item.trainers),
    }];
  });
}

function parseAthletes(value: unknown): AthleteStatisticsRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.first_name !== "string" ||
      typeof item.last_name !== "string"
    ) return [];
    return [{
      id: item.id,
      firstName: item.first_name,
      lastName: item.last_name,
      isActive: item.is_active === true,
      presentCount: numberValue(item.present_count),
    }];
  });
}

function parseTrainers(value: unknown): TrainerStatisticsRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.first_name !== "string" ||
      typeof item.last_name !== "string"
    ) return [];
    return [{
      id: item.id,
      firstName: item.first_name,
      lastName: item.last_name,
      isActive: item.is_active === true,
      sessionCount: numberValue(item.session_count),
    }];
  });
}

function parseMonthly(value: unknown): MonthlyStatisticsRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.month !== "string") return [];
    return [{
      month: item.month,
      sessionCount: numberValue(item.session_count),
      averagePresent: numberValue(item.average_present),
    }];
  });
}

function parseSummary(value: unknown): TrainingStatisticsSummary {
  const summary = isRecord(value) ? value : {};
  return {
    sessionCount: numberValue(summary.session_count),
    cancelledCount: numberValue(summary.cancelled_count),
    averagePresent: numberValue(summary.average_present),
    maxPresent: numberValue(summary.max_present),
    minPresent: numberValue(summary.min_present),
    uniquePresent: numberValue(summary.unique_present),
  };
}

export function parseTrainingStatisticsOverview(value: Json, fallbackToDate: string): TrainingStatistics {
  if (!isRecord(value)) throw new Error("Die Statistik besitzt ein ungültiges Format.");

  return {
    defaultFromDate: typeof value.default_from_date === "string" ? value.default_from_date : "",
    fromDate: typeof value.from_date === "string" ? value.from_date : "",
    toDate: typeof value.to_date === "string" ? value.to_date : fallbackToDate,
    summary: parseSummary(value.summary),
    sessions: parseSessions(value.sessions),
    athletes: parseAthletes(value.athletes),
    trainers: parseTrainers(value.trainers),
    monthly: parseMonthly(value.monthly),
  };
}
