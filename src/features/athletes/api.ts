import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  Athlete,
  AthleteContact,
  AthleteGroupSummary,
  AthleteInput,
  LinkableUser,
  Trainer,
  TrainerInput,
  TrainingGroup,
  TrainingGroupInput,
  TrainingGroupModuleKey,
} from "@/features/athletes/types";

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

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function parseAthleteGroups(value: unknown): AthleteGroupSummary[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      return [];
    }

    return [{
      id: item.id,
      name: item.name,
      shortName: nullableString(item.short_name),
      isActive: item.is_active === true,
    }];
  });
}

function parseAthleteContacts(value: unknown): AthleteContact[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.contact_name !== "string" ||
      typeof item.phone !== "string"
    ) {
      return [];
    }

    return [{
      id: typeof item.id === "string" ? item.id : null,
      contactName: item.contact_name,
      relationship: typeof item.relationship === "string" ? item.relationship : "",
      phone: item.phone,
      isEmergency: item.is_emergency !== false,
      priority: typeof item.priority === "number" ? item.priority : index + 1,
      notes: typeof item.notes === "string" ? item.notes : "",
    }];
  });
}

function parseModuleKey(value: unknown): TrainingGroupModuleKey {
  return value === "kindertraining" || value === "u12" || value === "u14"
    ? value
    : null;
}

function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => (
    typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= 7
  )))].sort((left, right) => left - right);
}

function parseAthletes(value: Json): Athlete[] {
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
      birthYear: typeof item.birth_year === "number" ? item.birth_year : null,
      notes: nullableString(item.notes),
      isActive: item.is_active === true,
      linkedUserId: nullableString(item.linked_user_id),
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
      groups: parseAthleteGroups(item.groups),
      contacts: parseAthleteContacts(item.contacts),
    }];
  });
}

function parseTrainingGroups(value: Json): TrainingGroup[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      return [];
    }

    return [{
      id: item.id,
      name: item.name,
      shortName: nullableString(item.short_name),
      description: nullableString(item.description),
      isActive: item.is_active === true,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
      athleteCount: typeof item.athlete_count === "number" ? item.athlete_count : 0,
      moduleKey: parseModuleKey(item.module_key),
      regularWeekdays: parseWeekdays(item.regular_weekdays),
      allowSpecialTraining: item.allow_special_training !== false,
      isPerformanceGroup: item.is_performance_group === true,
      registrationDeadlineWeekday:
        typeof item.registration_deadline_weekday === "number"
          ? item.registration_deadline_weekday
          : 7,
      registrationDeadlineTime:
        typeof item.registration_deadline_time === "string"
          ? item.registration_deadline_time.slice(0, 5)
          : "18:00",
      performanceWeeksAhead:
        typeof item.performance_weeks_ahead === "number"
          ? item.performance_weeks_ahead
          : 4,
      allowLateRegistration: item.allow_late_registration !== false,
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
    }];
  });
}

function parseTrainers(value: Json): Trainer[] {
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
      phone: nullableString(item.phone),
      email: nullableString(item.email),
      notes: nullableString(item.notes),
      isActive: item.is_active === true,
      linkedUserId: nullableString(item.linked_user_id),
      groupIds: parseStringArray(item.group_ids),
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
    }];
  });
}

function parseLinkableUsers(value: Json): LinkableUser[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.user_id !== "string" ||
      typeof item.email !== "string" ||
      typeof item.role !== "string" ||
      typeof item.status !== "string"
    ) {
      return [];
    }

    if (
      !["admin", "trainer", "athlete", "parent"].includes(item.role) ||
      !["invited", "active", "disabled"].includes(item.status)
    ) {
      return [];
    }

    return [{
      userId: item.user_id,
      email: item.email,
      displayName:
        typeof item.display_name === "string" && item.display_name.trim()
          ? item.display_name
          : item.email,
      role: item.role as LinkableUser["role"],
      status: item.status as LinkableUser["status"],
      athleteId: nullableString(item.athlete_id),
      trainerId: nullableString(item.trainer_id),
    }];
  });
}

function contactsToJson(contacts: AthleteContact[]): Json {
  return contacts.map((contact, index) => ({
    contact_name: contact.contactName.trim(),
    relationship: contact.relationship.trim() || null,
    phone: contact.phone.trim(),
    is_emergency: contact.isEmergency,
    priority: index + 1,
    notes: contact.notes.trim() || null,
  }));
}

export async function loadAthleteManagement(
  organizationId: string,
  includeLinkableUsers = false,
): Promise<{
  athletes: Athlete[];
  groups: TrainingGroup[];
  trainers: Trainer[];
  linkableUsers: LinkableUser[];
}> {
  const [athletesData, groupsData, trainersData, usersData] = await Promise.all([
    callJsonRpc("athlete_overview", { p_organization_id: organizationId }),
    callJsonRpc("training_group_overview_v3", { p_organization_id: organizationId }),
    callJsonRpc("trainer_overview_v2", { p_organization_id: organizationId }),
    includeLinkableUsers
      ? callJsonRpc("organization_linkable_users", { p_organization_id: organizationId })
      : Promise.resolve([] as Json),
  ]);

  return {
    athletes: parseAthletes(athletesData),
    groups: parseTrainingGroups(groupsData),
    trainers: parseTrainers(trainersData),
    linkableUsers: parseLinkableUsers(usersData),
  };
}

export async function createAthlete(
  organizationId: string,
  values: AthleteInput,
): Promise<string> {
  const data = await callJsonRpc("create_athlete_v3", {
    p_organization_id: organizationId,
    p_first_name: values.firstName.trim(),
    p_last_name: values.lastName.trim(),
    p_birth_year: values.birthYear,
    p_notes: values.notes.trim() || null,
    p_group_ids: values.groupIds,
    p_contacts: contactsToJson(values.contacts),
    p_linked_user_id: values.linkedUserId,
  });

  if (typeof data !== "string") {
    throw new Error("Der Athlet wurde gespeichert, aber die Rückgabe ist ungültig.");
  }

  return data;
}

export async function updateAthlete(
  organizationId: string,
  athleteId: string,
  values: AthleteInput,
): Promise<void> {
  await callJsonRpc("update_athlete_v3", {
    p_organization_id: organizationId,
    p_athlete_id: athleteId,
    p_first_name: values.firstName.trim(),
    p_last_name: values.lastName.trim(),
    p_birth_year: values.birthYear,
    p_notes: values.notes.trim() || null,
    p_is_active: values.isActive,
    p_group_ids: values.groupIds,
    p_contacts: contactsToJson(values.contacts),
    p_linked_user_id: values.linkedUserId,
  });
}

export async function createTrainingGroup(
  organizationId: string,
  values: TrainingGroupInput,
): Promise<string> {
  const data = await callJsonRpc("create_training_group_v3", {
    p_organization_id: organizationId,
    p_name: values.name.trim(),
    p_short_name: values.shortName.trim() || null,
    p_description: values.description.trim() || null,
    p_sort_order: values.sortOrder,
    p_module_key: values.moduleKey,
    p_regular_weekdays: values.regularWeekdays,
    p_allow_special_training: values.allowSpecialTraining,
    p_is_performance_group: values.isPerformanceGroup,
    p_registration_deadline_weekday: values.registrationDeadlineWeekday,
    p_registration_deadline_time: values.registrationDeadlineTime,
    p_performance_weeks_ahead: values.performanceWeeksAhead,
    p_allow_late_registration: values.allowLateRegistration,
  });

  if (typeof data !== "string") {
    throw new Error("Die Trainingsgruppe wurde gespeichert, aber die Rückgabe ist ungültig.");
  }

  return data;
}

export async function updateTrainingGroup(
  organizationId: string,
  groupId: string,
  values: TrainingGroupInput,
): Promise<void> {
  await callJsonRpc("update_training_group_v3", {
    p_organization_id: organizationId,
    p_group_id: groupId,
    p_name: values.name.trim(),
    p_short_name: values.shortName.trim() || null,
    p_description: values.description.trim() || null,
    p_is_active: values.isActive,
    p_sort_order: values.sortOrder,
    p_module_key: values.moduleKey,
    p_regular_weekdays: values.regularWeekdays,
    p_allow_special_training: values.allowSpecialTraining,
    p_is_performance_group: values.isPerformanceGroup,
    p_registration_deadline_weekday: values.registrationDeadlineWeekday,
    p_registration_deadline_time: values.registrationDeadlineTime,
    p_performance_weeks_ahead: values.performanceWeeksAhead,
    p_allow_late_registration: values.allowLateRegistration,
  });
}

export async function createTrainer(
  organizationId: string,
  values: TrainerInput,
): Promise<string> {
  const data = await callJsonRpc("create_trainer_v3", {
    p_organization_id: organizationId,
    p_first_name: values.firstName.trim(),
    p_last_name: values.lastName.trim(),
    p_phone: values.phone.trim() || null,
    p_email: values.email.trim() || null,
    p_notes: values.notes.trim() || null,
    p_group_ids: values.groupIds,
    p_linked_user_id: values.linkedUserId,
  });

  if (typeof data !== "string") {
    throw new Error("Der Trainer wurde gespeichert, aber die Rückgabe ist ungültig.");
  }

  return data;
}

export async function updateTrainer(
  organizationId: string,
  trainerId: string,
  values: TrainerInput,
): Promise<void> {
  await callJsonRpc("update_trainer_v3", {
    p_organization_id: organizationId,
    p_trainer_id: trainerId,
    p_first_name: values.firstName.trim(),
    p_last_name: values.lastName.trim(),
    p_phone: values.phone.trim() || null,
    p_email: values.email.trim() || null,
    p_notes: values.notes.trim() || null,
    p_is_active: values.isActive,
    p_group_ids: values.groupIds,
    p_linked_user_id: values.linkedUserId,
  });
}

export async function deactivateAthleteFromTraining(
  organizationId: string,
  moduleKey: Exclude<TrainingGroupModuleKey, null>,
  groupId: string,
  athleteId: string,
): Promise<void> {
  await callJsonRpc("deactivate_training_module_athlete", {
    p_organization_id: organizationId,
    p_module_key: moduleKey,
    p_group_id: groupId,
    p_athlete_id: athleteId,
  });
}
