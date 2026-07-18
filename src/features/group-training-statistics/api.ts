import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  AthleteStatisticsRow,
  KindertrainingStatistics,
  KindertrainingStatisticsSummary,
  MonthlyStatisticsRow,
  StatisticsNamedItem,
  StatisticsSession,
  TrainerStatisticsRow,
} from "@/features/kindertraining-statistics/types";
import type { TrainingEnvironment, TrainingSessionState } from "@/features/kindertraining/types";

type JsonRpcResponse = { data: Json; error: unknown | null };

export type GroupStatisticsModuleKey = "u12" | "u14";

async function callJsonRpc(
  functionName: string,
  args: Record<string, Json | undefined>,
): Promise<Json> {
  const supabase = requireSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    parameters: Record<string, Json | undefined>,
  ) => PromiseLike<JsonRpcResponse>;
  const { data, error } = await rpc(functionName, args);
  if (error) throw error;
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEnvironment(value: unknown): TrainingEnvironment {
  return value === "indoor" || value === "outdoor" || value === "mixed" ? value : null;
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
      birthYear: typeof item.birth_year === "number" ? item.birth_year : null,
      isActive: item.is_active === true,
      possibleCount: numberValue(item.possible_count),
      presentCount: numberValue(item.present_count),
      excusedCount: numberValue(item.excused_count),
      absentCount: numberValue(item.absent_count),
      openCount: numberValue(item.open_count),
      attendanceRate: numberValue(item.attendance_rate),
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

function parseSummary(value: unknown): KindertrainingStatisticsSummary {
  const summary = isRecord(value) ? value : {};
  return {
    sessionCount: numberValue(summary.session_count),
    cancelledCount: numberValue(summary.cancelled_count),
    averagePresent: numberValue(summary.average_present),
    maxPresent: numberValue(summary.max_present),
    uniquePresent: numberValue(summary.unique_present),
  };
}

export async function loadGroupTrainingStatistics(
  organizationId: string,
  moduleKey: GroupStatisticsModuleKey,
  fromDate: string | null,
  toDate: string,
  sessionLimit: number,
): Promise<KindertrainingStatistics> {
  const data = await callJsonRpc("training_module_statistics_overview", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_session_limit: sessionLimit,
  });

  if (!isRecord(data)) throw new Error("Die Statistik besitzt ein ungültiges Format.");

  return {
    defaultFromDate: typeof data.default_from_date === "string" ? data.default_from_date : "",
    fromDate: typeof data.from_date === "string" ? data.from_date : "",
    toDate: typeof data.to_date === "string" ? data.to_date : toDate,
    summary: parseSummary(data.summary),
    sessions: parseSessions(data.sessions),
    athletes: parseAthletes(data.athletes),
    trainers: parseTrainers(data.trainers),
    monthly: parseMonthly(data.monthly),
  };
}

export async function saveGroupTrainingStatisticsDefault(
  organizationId: string,
  moduleKey: GroupStatisticsModuleKey,
  fromDate: string,
): Promise<string> {
  const data = await callJsonRpc("save_training_module_statistics_default", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_from_date: fromDate,
  });
  if (typeof data !== "string") throw new Error("Der Statistik-Standard konnte nicht bestätigt werden.");
  return data;
}
