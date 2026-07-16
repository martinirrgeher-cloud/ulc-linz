import { requireSupabase } from "@/lib/supabase";
import type { Json } from "@/types/database.generated";
import type {
  Athlete,
  AthleteGroupSummary,
  AthleteInput,
  TrainingGroup,
  TrainingGroupInput,
} from "@/features/athletes/types";

type RawAthleteGroup = {
  id?: unknown;
  name?: unknown;
  short_name?: unknown;
  is_active?: unknown;
};

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

export async function loadAthleteManagement(
  organizationId: string,
): Promise<{ athletes: Athlete[]; groups: TrainingGroup[] }> {
  const supabase = requireSupabase();
  const [athletesResult, groupsResult] = await Promise.all([
    supabase.rpc("athlete_overview", {
      p_organization_id: organizationId,
    }),
    supabase.rpc("training_group_overview", {
      p_organization_id: organizationId,
    }),
  ]);

  if (athletesResult.error) throw athletesResult.error;
  if (groupsResult.error) throw groupsResult.error;

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
    groups: groupsResult.data.map((group) => ({
      id: group.id,
      name: group.name,
      shortName: group.short_name,
      description: group.description,
      isActive: group.is_active,
      sortOrder: group.sort_order,
      athleteCount: Number(group.athlete_count),
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    })),
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
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("create_training_group", {
    p_organization_id: organizationId,
    p_name: values.name.trim(),
    p_short_name: values.shortName.trim() || null,
    p_description: values.description.trim() || null,
    p_sort_order: values.sortOrder,
  });

  if (error) throw error;
  return data;
}

export async function updateTrainingGroup(
  organizationId: string,
  groupId: string,
  values: TrainingGroupInput,
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("update_training_group", {
    p_organization_id: organizationId,
    p_group_id: groupId,
    p_name: values.name.trim(),
    p_short_name: values.shortName.trim() || null,
    p_description: values.description.trim() || null,
    p_is_active: values.isActive,
    p_sort_order: values.sortOrder,
  });

  if (error) throw error;
}
