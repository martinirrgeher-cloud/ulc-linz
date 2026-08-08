import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  AthleteEmergencyContact,
  AttendanceStatus,
  DeleteSpecialTrainingResult,
  KindertrainingConfiguration,
  KindertrainingParticipant,
  KindertrainingSession,
  KindertrainingTrainer,
  QuickAthleteInput,
  QuickAthleteResult,
  QuickAthleteResultStatus,
  SaveKindertrainingInput,
  TrainingEnvironment,
  TrainingSessionState,
} from "@/features/kindertraining/types";

type JsonRpcResponse = {
  data: Json;
  error: unknown | null;
};

export type GroupTrainingModuleKey = "u12" | "u14";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseStatus(value: unknown): AttendanceStatus {
  // Historische „Entschuldigt“-Einträge werden fachlich wie „Fehlt“ behandelt.
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

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
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

function parseParticipants(value: unknown): KindertrainingParticipant[] {
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

function parseTrainers(value: unknown): KindertrainingTrainer[] {
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

function parseSessionPayload(value: Json): KindertrainingSession {
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

export async function loadGroupTrainingConfiguration(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
): Promise<KindertrainingConfiguration> {
  const data = await callJsonRpc("training_module_configuration_overview", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
  });

  if (!isRecord(data)) {
    throw new Error("Die Trainingskonfiguration besitzt ein ungültiges Format.");
  }

  const rawGroup = isRecord(data.group) ? data.group : null;
  const specialDates = Array.isArray(data.special_dates)
    ? data.special_dates.filter((item): item is string => typeof item === "string")
    : [];

  if (!rawGroup) return { group: null, specialDates, groupTrainerIds: [] };
  if (typeof rawGroup.id !== "string" || typeof rawGroup.name !== "string") {
    throw new Error("Die zugeordnete Trainingsgruppe ist ungültig.");
  }

  const groupTrainerIds = parseStringArray(await callJsonRpc(
    "training_module_group_trainer_ids",
    {
      p_organization_id: organizationId,
      p_module_key: moduleKey,
      p_group_id: rawGroup.id,
    },
  ));

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
    groupTrainerIds,
  };
}

export async function loadGroupTrainingSession(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  groupId: string,
  sessionDate: string,
): Promise<KindertrainingSession> {
  const data = await callJsonRpc("training_module_session_overview", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_group_id: groupId,
    p_session_date: sessionDate,
  });

  return parseSessionPayload(data);
}

export async function saveGroupTrainingSession(
  moduleKey: GroupTrainingModuleKey,
  input: SaveKindertrainingInput,
): Promise<KindertrainingSession> {
  const attendance = input.participants.map((participant) => ({
    athlete_id: participant.athleteId,
    status: input.attendance[participant.athleteId] ?? "open",
  }));

  const data = await callJsonRpc("save_training_module_session", {
    p_organization_id: input.organizationId,
    p_module_key: moduleKey,
    p_group_id: input.groupId,
    p_session_date: input.sessionDate,
    p_state: input.state,
    p_note: input.note,
    p_attendance: attendance,
    p_trainer_ids: input.trainerIds,
    p_environment: input.environment,
    p_expected_updated_at: input.expectedUpdatedAt,
  });

  return parseSessionPayload(data);
}

export async function deleteGroupTrainingSpecialSession(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  groupId: string,
  sessionDate: string,
): Promise<DeleteSpecialTrainingResult> {
  const data = await callJsonRpc("delete_training_module_special_session", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_group_id: groupId,
    p_session_date: sessionDate,
  });

  if (!isRecord(data) || !DELETE_RESULT_STATUSES.includes(data.mode as DeleteSpecialTrainingResult)) {
    throw new Error("Das Ergebnis der Löschung ist ungültig.");
  }

  return data.mode as DeleteSpecialTrainingResult;
}

export async function createGroupTrainingAthlete(
  organizationId: string,
  moduleKey: GroupTrainingModuleKey,
  input: QuickAthleteInput,
): Promise<QuickAthleteResult> {
  const data = await callJsonRpc("create_training_module_athlete", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_birth_year: input.birthYear,
    p_session_date: input.sessionDate,
    p_attach_existing: input.attachExisting === true,
  });

  if (!isRecord(data) || !isRecord(data.athlete)) {
    throw new Error("Die Rückgabe der Athletenanlage ist ungültig.");
  }

  const status = QUICK_RESULT_STATUSES.includes(data.status as QuickAthleteResultStatus)
    ? (data.status as QuickAthleteResultStatus)
    : null;
  const athlete = data.athlete;

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
