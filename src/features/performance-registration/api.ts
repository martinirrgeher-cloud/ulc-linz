import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  PerformanceAthlete,
  PerformanceAvailability,
  PerformanceAvailabilityDefault,
  PerformanceAvailabilityDraft,
  PerformanceAvailabilityStatus,
  PerformanceContext,
  PerformanceGroup,
  PerformancePerson,
  PerformanceSaveInput,
  PerformanceTrainer,
  PerformanceTrainingDate,
  PerformanceWeek,
} from "@/features/performance-registration/types";

type JsonRpcResponse = {
  data: Json;
  error: unknown | null;
};

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

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseStatus(value: unknown): PerformanceAvailabilityStatus {
  return value === "coming" || value === "maybe" || value === "unavailable"
    ? value
    : "open";
}

function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => (
    typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= 7
  )))].sort((left, right) => left - right);
}

function parsePerson(value: unknown): PerformancePerson | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.first_name !== "string" ||
    typeof value.last_name !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    firstName: value.first_name,
    lastName: value.last_name,
    isActive: value.is_active !== false,
  };
}

function parseGroup(value: unknown): PerformanceGroup | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    shortName: nullableString(value.short_name),
    regularWeekdays: parseWeekdays(value.regular_weekdays),
    deadlineWeekday: numberValue(value.deadline_weekday, 7),
    deadlineTime: stringValue(value.deadline_time, "18:00").slice(0, 5),
    weeksAhead: numberValue(value.weeks_ahead, 4),
    allowLateRegistration: value.allow_late_registration !== false,
  };
}

function parseAvailability(value: unknown): PerformanceAvailability | null {
  if (!isRecord(value) || typeof value.date !== "string") return null;

  const source =
    value.source === "self" ||
    value.source === "trainer" ||
    value.source === "default" ||
    value.source === "copy"
      ? value.source
      : null;

  return {
    date: value.date,
    status: parseStatus(value.status),
    availableFrom: stringValue(value.available_from).slice(0, 5),
    availableUntil: stringValue(value.available_until).slice(0, 5),
    comment: stringValue(value.comment),
    source,
    updatedAt: nullableString(value.updated_at),
    isLate: value.is_late === true,
  };
}

function parseAvailabilityList(value: unknown): PerformanceAvailability[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = parseAvailability(item);
    return parsed ? [parsed] : [];
  });
}

function parseDefaults(value: unknown): PerformanceAvailabilityDefault[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.weekday !== "number") return [];
    return [{
      weekday: item.weekday,
      status: parseStatus(item.status),
      availableFrom: stringValue(item.available_from).slice(0, 5),
      availableUntil: stringValue(item.available_until).slice(0, 5),
      comment: stringValue(item.comment),
    }];
  });
}

function parseAthletes(value: unknown): PerformanceAthlete[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const person = parsePerson(item);
    if (!person || !isRecord(item)) return [];
    return [{
      ...person,
      birthYear: typeof item.birth_year === "number" ? item.birth_year : null,
      availability: parseAvailabilityList(item.availability),
      defaults: parseDefaults(item.defaults),
    }];
  });
}

function parseTrainers(value: unknown): PerformanceTrainer[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const person = parsePerson(item);
    if (!person || !isRecord(item)) return [];
    return [{
      ...person,
      availability: parseAvailabilityList(item.availability),
    }];
  });
}

function parseDates(value: unknown): PerformanceTrainingDate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.date !== "string" || typeof item.weekday !== "number") {
      return [];
    }
    return [{
      date: item.date,
      weekday: item.weekday,
      deadlineAt: nullableString(item.deadline_at),
    }];
  });
}

export async function loadPerformanceContext(
  organizationId: string,
): Promise<PerformanceContext> {
  const data = await callJsonRpc("performance_registration_context", {
    p_organization_id: organizationId,
  });

  if (!isRecord(data)) throw new Error("Die Leistungsgruppen-Konfiguration ist ungültig.");

  const role = data.role;
  if (role !== "admin" && role !== "trainer" && role !== "athlete" && role !== "parent") {
    throw new Error("Die Benutzerrolle konnte nicht ermittelt werden.");
  }

  const groups = Array.isArray(data.groups)
    ? data.groups.flatMap((item) => {
        const parsed = parseGroup(item);
        return parsed ? [parsed] : [];
      })
    : [];

  return {
    role,
    canManage: data.can_manage === true,
    athlete: parsePerson(data.athlete),
    trainer: parsePerson(data.trainer),
    groups,
  };
}

export async function loadPerformanceWeek(
  organizationId: string,
  groupId: string,
  weekStart: string,
): Promise<PerformanceWeek> {
  const data = await callJsonRpc("performance_group_week_overview", {
    p_organization_id: organizationId,
    p_group_id: groupId,
    p_week_start: weekStart,
  });

  if (!isRecord(data)) throw new Error("Die Wochenübersicht ist ungültig.");
  const group = parseGroup(data.group);
  if (!group) throw new Error("Die Leistungsgruppe konnte nicht geladen werden.");

  return {
    weekStart: stringValue(data.week_start, weekStart),
    weekEnd: stringValue(data.week_end, weekStart),
    group,
    dates: parseDates(data.dates),
    athletes: parseAthletes(data.athletes),
    trainers: parseTrainers(data.trainers),
  };
}

export async function savePerformanceAvailability(
  input: PerformanceSaveInput,
): Promise<PerformanceAvailability> {
  const functionName = input.target === "athlete"
    ? "save_performance_athlete_availability"
    : "save_performance_trainer_availability";
  const personKey = input.target === "athlete" ? "p_athlete_id" : "p_trainer_id";

  const data = await callJsonRpc(functionName, {
    p_organization_id: input.organizationId,
    p_group_id: input.groupId,
    [personKey]: input.personId,
    p_training_date: input.trainingDate,
    p_status: input.draft.status,
    p_available_from: input.draft.availableFrom || null,
    p_available_until: input.draft.availableUntil || null,
    p_comment: input.draft.comment.trim() || null,
  });

  const parsed = parseAvailability(data);
  if (!parsed) throw new Error("Die gespeicherte Anmeldung konnte nicht gelesen werden.");
  return parsed;
}

export async function savePerformanceDefault(
  organizationId: string,
  groupId: string,
  athleteId: string,
  weekday: number,
  draft: PerformanceAvailabilityDraft,
): Promise<void> {
  await callJsonRpc("save_performance_athlete_default", {
    p_organization_id: organizationId,
    p_group_id: groupId,
    p_athlete_id: athleteId,
    p_weekday: weekday,
    p_status: draft.status,
    p_available_from: draft.availableFrom || null,
    p_available_until: draft.availableUntil || null,
    p_comment: draft.comment.trim() || null,
  });
}

export async function applyPerformanceDefaults(
  organizationId: string,
  groupId: string,
  athleteId: string,
  weekStart: string,
): Promise<void> {
  await callJsonRpc("apply_performance_athlete_defaults", {
    p_organization_id: organizationId,
    p_group_id: groupId,
    p_athlete_id: athleteId,
    p_week_start: weekStart,
  });
}

export async function copyPerformancePreviousWeek(
  organizationId: string,
  groupId: string,
  athleteId: string,
  weekStart: string,
): Promise<void> {
  await callJsonRpc("copy_performance_previous_week", {
    p_organization_id: organizationId,
    p_group_id: groupId,
    p_athlete_id: athleteId,
    p_week_start: weekStart,
  });
}
