import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  Athlete,
  AthleteGroupSummary,
  AthleteInput,
  TrainingGroup,
  TrainingGroupInput,
  TrainingGroupModuleKey,
} from "@/features/athletes/types";

type RawAthleteGroup = {
  id?: unknown;
  name?: unknown;
  short_name?: unknown;
  is_active?: unknown;
};

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

function parseAthleteGroups(value: Json): AthleteGroupSummary[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const group = item as RawAthleteGroup;
    if (typeof group.id !== "string" || typeof group.name !== "string") return [];

    return [
      {
        id: group.id,
        name: group.name,
        shortName: typeof group.short_name === "string" ? group.short_name : null,
        isActive: group.is_active === true,
      },
    ];
  });
}

function parseModuleKey(value: unknown): TrainingGroupModuleKey {
  return value === "kindertraining" ? "kindertraining" : null;
}

function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => (
    typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= 7
  )))].sort((left, right) => left - right);
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
      shortName: typeof item.short_name === "string" ? item.short_name : null,
      description: typeof item.description === "string" ? item.description : null,
      isActive: item.is_active === true,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
      athleteCount: typeof item.athlete_count === "number" ? item.athlete_count : 0,
      moduleKey: parseModuleKey(item.module_key),
      regularWeekdays: parseWeekdays(item.regular_weekdays),
      allowSpecialTraining: item.allow_special_training !== false,
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
    }];
  });
}

export async function loadAthleteManagement(
  organizationId: string,
): Promise<{ athletes: Athlete[]; groups: TrainingGroup[] }> {
  const supabase = requireSupabase();
  const [athletesResult, groupsData] = await Promise.all([
    supabase.rpc("athlete_overview", {
      p_organization_id: organizationId,
    }),
    callJsonRpc("training_group_overview_v2", {
      p_organization_id: organizationId,
    }),
  ]);

  if (athletesResult.error) throw athletesResult.error;

  return {
    athletes: athletesResult.data.map((athlete) => ({
      id: athlete.id,
      firstName: athlete.first_name,
      lastName: athlete.last_name,
      birthYear: athlete.birth_year,
      notes: athlete.notes,
      isActive: athlete.is_active,
      createdAt: athlete.created_at,
      updatedAt: athlete.updated_at,
      groups: parseAthleteGroups(athlete.groups),
    })),
    groups: parseTrainingGroups(groupsData),
  };
}

export async function createAthlete(
  organizationId: string,
  values: AthleteInput,
): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("create_athlete", {
    p_organization_id: organizationId,
    p_first_name: values.firstName.trim(),
    p_last_name: values.lastName.trim(),
    p_birth_year: values.birthYear,
    p_notes: values.notes.trim() || null,
    p_group_ids: values.groupIds,
  });

  if (error) throw error;
  return data;
}

export async function updateAthlete(
  organizationId: string,
  athleteId: string,
  values: AthleteInput,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("update_athlete", {
    p_organization_id: organizationId,
    p_athlete_id: athleteId,
    p_first_name: values.firstName.trim(),
    p_last_name: values.lastName.trim(),
    p_birth_year: values.birthYear,
    p_notes: values.notes.trim() || null,
    p_is_active: values.isActive,
    p_group_ids: values.groupIds,
  });

  if (error) throw error;
}

export async function createTrainingGroup(
  organizationId: string,
  values: TrainingGroupInput,
): Promise<string> {
  const data = await callJsonRpc("create_training_group_v2", {
    p_organization_id: organizationId,
    p_name: values.name.trim(),
    p_short_name: values.shortName.trim() || null,
    p_description: values.description.trim() || null,
    p_sort_order: values.sortOrder,
    p_module_key: values.moduleKey,
    p_regular_weekdays: values.regularWeekdays,
    p_allow_special_training: values.allowSpecialTraining,
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
  await callJsonRpc("update_training_group_v2", {
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
  });
}
