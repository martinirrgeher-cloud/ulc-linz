import type { Json } from "@/types/database.generated";
import { isRecord, parseStringArray } from "@/lib/json-value";
import type {
  AthleteEmergencyContact,
  AttendanceStatus,
  DeleteSpecialTrainingResult,
  QuickAthleteResult,
  QuickAthleteResultStatus,
  TrainingConfiguration,
  TrainingParticipant,
  TrainingSession,
  TrainingTrainer,
  TrainingEnvironment,
  TrainingSessionState,
} from "@/features/training-session/types";

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["open", "present", "absent"];
const QUICK_RESULT_STATUSES: QuickAthleteResultStatus[] = [
  "created",
  "duplicate",
  "attached",
  "already_assigned",
];
const DELETE_RESULT_STATUSES: DeleteSpecialTrainingResult[] = [
  "deleted",
  "archived",
  "not_found",
];

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseStatus(value: unknown): AttendanceStatus {
  if (value === "excused") return "absent";
  return ATTENDANCE_STATUSES.includes(value as AttendanceStatus)
    ? (value as AttendanceStatus)
    : "open";
}

function parseState(value: unknown): TrainingSessionState {
  return value === "cancelled" ? "cancelled" : "scheduled";
}

function parseEnvironment(value: unknown): TrainingEnvironment {
  return value === "indoor" || value === "outdoor" ? value : null;
}

function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => (
    typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= 7
  )))].sort((left, right) => left - right);
}

function parseContacts(value: unknown): AthleteEmergencyContact[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.contact_name !== "string" ||
      typeof item.phone !== "string"
    ) {
      return [];
    }

    return [{
      id: item.id,
      contactName: item.contact_name,
      relationship: typeof item.relationship === "string" ? item.relationship : "",
      phone: item.phone,
      isEmergency: item.is_emergency !== false,
      priority: typeof item.priority === "number" ? item.priority : index + 1,
      notes: typeof item.notes === "string" ? item.notes : "",
    }];
  });
}

function parseParticipants(value: unknown): TrainingParticipant[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (
      typeof item.athlete_id !== "string" ||
      typeof item.first_name !== "string" ||
      typeof item.last_name !== "string"
    ) {
      return [];
    }

    return [{
      athleteId: item.athlete_id,
      firstName: item.first_name,
      lastName: item.last_name,
      birthYear: typeof item.birth_year === "number" ? item.birth_year : null,
      isActive: item.is_active !== false,
      status: parseStatus(item.status),
      contacts: parseContacts(item.contacts),
    }];
  });
}

function parseTrainers(value: unknown): TrainingTrainer[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.first_name !== "string" ||
      typeof item.last_name !== "string"
    ) {
      return [];
    }

    return [{
      id: item.id,
      firstName: item.first_name,
      lastName: item.last_name,
      phone: asNullableString(item.phone),
      email: asNullableString(item.email),
      isActive: item.is_active === true,
    }];
  });
}

export function parseTrainingConfigurationOverview(
  value: Json,
  invalidConfigurationMessage: string,
  invalidGroupMessage: string,
): TrainingConfiguration {
  if (!isRecord(value)) throw new Error(invalidConfigurationMessage);

  const rawGroup = isRecord(value.group) ? value.group : null;
  const specialDates = Array.isArray(value.special_dates)
    ? value.special_dates.filter((item): item is string => typeof item === "string")
    : [];

  if (!rawGroup) return { group: null, specialDates, groupTrainerIds: [] };
  if (typeof rawGroup.id !== "string" || typeof rawGroup.name !== "string") {
    throw new Error(invalidGroupMessage);
  }

  return {
    group: {
      id: rawGroup.id,
      name: rawGroup.name,
      shortName: typeof rawGroup.short_name === "string" ? rawGroup.short_name : null,
      isActive: rawGroup.is_active === true,
      regularWeekdays: parseWeekdays(rawGroup.regular_weekdays),
      allowSpecialTraining: rawGroup.allow_special_training !== false,
    },
    specialDates,
    groupTrainerIds: [],
  };
}

export function parseTrainingSessionPayload(value: Json): TrainingSession {
  if (!isRecord(value)) {
    throw new Error("Die Trainingsdaten besitzen ein ungültiges Format.");
  }

  const rawSession = isRecord(value.session) ? value.session : null;
  const storedTrainerIds = parseStringArray(rawSession?.trainer_ids);
  const defaultTrainerIds = parseStringArray(value.default_trainer_ids);
  const storedEnvironment = parseEnvironment(rawSession?.environment);
  const defaultEnvironment = parseEnvironment(value.default_environment);

  return {
    id: rawSession && typeof rawSession.id === "string" ? rawSession.id : null,
    state: parseState(rawSession?.state),
    note: rawSession && typeof rawSession.note === "string" ? rawSession.note : "",
    isSpecial: rawSession?.is_special === true,
    isRegularDay: value.is_regular_day === true,
    environment: rawSession ? storedEnvironment : defaultEnvironment,
    trainerIds: rawSession ? storedTrainerIds : defaultTrainerIds,
    availableTrainers: parseTrainers(value.trainers),
    usesDefaults: !rawSession && (defaultTrainerIds.length > 0 || defaultEnvironment !== null),
    createdAt: asNullableString(rawSession?.created_at),
    updatedAt: asNullableString(rawSession?.updated_at),
    participants: parseParticipants(value.participants),
  };
}

export function parseDeleteSpecialTrainingResult(value: Json): DeleteSpecialTrainingResult {
  if (!isRecord(value) || !DELETE_RESULT_STATUSES.includes(value.mode as DeleteSpecialTrainingResult)) {
    throw new Error("Das Ergebnis der Löschung ist ungültig.");
  }
  return value.mode as DeleteSpecialTrainingResult;
}

export function parseQuickAthleteResult(value: Json): QuickAthleteResult {
  if (!isRecord(value) || !isRecord(value.athlete)) {
    throw new Error("Die Rückgabe der Athletenanlage ist ungültig.");
  }

  const status = QUICK_RESULT_STATUSES.includes(value.status as QuickAthleteResultStatus)
    ? (value.status as QuickAthleteResultStatus)
    : null;
  const athlete = value.athlete;

  if (
    !status ||
    typeof athlete.id !== "string" ||
    typeof athlete.first_name !== "string" ||
    typeof athlete.last_name !== "string" ||
    typeof athlete.birth_year !== "number"
  ) {
    throw new Error("Die Rückgabe der Athletenanlage ist unvollständig.");
  }

  return {
    status,
    athlete: {
      id: athlete.id,
      firstName: athlete.first_name,
      lastName: athlete.last_name,
      birthYear: athlete.birth_year,
      isActive: athlete.is_active !== false,
    },
  };
}
