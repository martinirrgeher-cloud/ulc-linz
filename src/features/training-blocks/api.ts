import type { Json } from "@/types/database.generated";
import { requireSupabase } from "@/lib/supabase";
import {
  type ExerciseParameterDefinition,
  type ExerciseParameterInputType,
  type ExerciseTrainingGroup,
} from "@/features/exercise-catalog/types";
import type {
  TrainingBlock,
  TrainingBlockData,
  TrainingBlockExercise,
  TrainingBlockInput,
  TrainingBlockItem,
} from "@/features/training-blocks/types";

type JsonRpc = (
  functionName: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function parseParameters(value: unknown): ExerciseParameterDefinition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.parameter_key !== "string") return [];
    const inputType: ExerciseParameterInputType = item.input_type === "text" ? "text" : "number";
    return [{
      key: item.parameter_key,
      label: typeof item.label === "string" ? item.label : item.parameter_key,
      unit: typeof item.unit === "string" ? item.unit : "",
      inputType,
      defaultValue: typeof item.default_value === "string" ? item.default_value : "",
      minValue: numberOrNull(item.min_value),
      maxValue: numberOrNull(item.max_value),
      stepValue: numberOrNull(item.step_value),
      isRequired: item.is_required === true,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

function parseGroups(value: unknown): ExerciseTrainingGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      shortName: optionalString(item.short_name),
    }];
  });
}

function parseExercises(value: unknown): TrainingBlockExercise[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.category_key !== "string" ||
      typeof item.category_title !== "string"
    ) return [];

    return [{
      id: item.id,
      name: item.name,
      categoryKey: item.category_key,
      categoryTitle: item.category_title,
      subcategory: optionalString(item.subcategory),
      goal: optionalString(item.goal),
      equipment: parseStringArray(item.equipment),
      groupIds: parseStringArray(item.group_ids),
      isActive: item.is_active !== false,
      parameters: parseParameters(item.parameters),
    }];
  });
}

function parseParameterValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (typeof entry === "string") return [[key, entry]];
      if (typeof entry === "number" && Number.isFinite(entry)) return [[key, entry.toString()]];
      return [];
    }),
  );
}

function parseItems(value: unknown): TrainingBlockItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.exercise_id !== "string" ||
      typeof item.exercise_name !== "string" ||
      typeof item.category_title !== "string"
    ) return [];

    return [{
      id: item.id,
      exerciseId: item.exercise_id,
      exerciseName: item.exercise_name,
      exerciseIsActive: item.exercise_is_active !== false,
      categoryTitle: item.category_title,
      sortOrder: typeof item.sort_order === "number" ? item.sort_order : 100,
      note: optionalString(item.note),
      parameterValues: parseParameterValues(item.parameter_values),
      parameters: parseParameters(item.parameters),
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

function parseBlocks(value: unknown): TrainingBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      goal: optionalString(item.goal),
      description: optionalString(item.description),
      estimatedMinutes: numberOrNull(item.estimated_minutes),
      isActive: item.is_active !== false,
      groupIds: parseStringArray(item.group_ids),
      items: parseItems(item.items),
      usageCount: typeof item.usage_count === "number" ? item.usage_count : 0,
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
      updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
    }];
  });
}

async function callJsonRpc(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Json> {
  const supabase = requireSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as JsonRpc;
  const { data, error } = await rpc(functionName, args);
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function loadTrainingBlocks(
  organizationId: string,
  includeInactive = true,
): Promise<TrainingBlockData> {
  const data = await callJsonRpc("training_block_overview_v2", {
    p_organization_id: organizationId,
    p_include_inactive: includeInactive,
  });

  if (!isRecord(data)) {
    throw new Error("Die Trainingsblöcke konnten nicht gelesen werden.");
  }

  return {
    groups: parseGroups(data.groups),
    exercises: parseExercises(data.exercises),
    blocks: parseBlocks(data.blocks),
  };
}

function itemsToJson(values: TrainingBlockInput): Json {
  return values.items.map((item) => ({
    exercise_id: item.exerciseId,
    note: item.note.trim() || null,
    parameter_values: Object.fromEntries(
      Object.entries(item.parameterValues)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== ""),
    ),
  }));
}

export async function saveTrainingBlock(
  organizationId: string,
  blockId: string | null,
  values: TrainingBlockInput,
): Promise<string> {
  const estimatedMinutes = values.estimatedMinutes.trim()
    ? Number.parseInt(values.estimatedMinutes, 10)
    : null;

  if (estimatedMinutes !== null && !Number.isFinite(estimatedMinutes)) {
    throw new Error("Die geschätzte Dauer ist ungültig.");
  }

  const data = await callJsonRpc("save_training_block", {
    p_organization_id: organizationId,
    p_block_id: blockId,
    p_name: values.name.trim(),
    p_goal: values.goal.trim() || null,
    p_description: values.description.trim() || null,
    p_estimated_minutes: estimatedMinutes,
    p_is_active: values.isActive,
    p_group_ids: values.groupIds,
    p_items: itemsToJson(values),
  });

  if (typeof data !== "string") {
    throw new Error("Der Trainingsblock wurde gespeichert, aber die Rückgabe ist ungültig.");
  }
  return data;
}

export async function duplicateTrainingBlock(
  organizationId: string,
  blockId: string,
): Promise<string> {
  const data = await callJsonRpc("duplicate_training_block", {
    p_organization_id: organizationId,
    p_block_id: blockId,
  });

  if (typeof data !== "string") {
    throw new Error("Der Trainingsblock wurde dupliziert, aber die Rückgabe ist ungültig.");
  }
  return data;
}


export async function deleteTrainingBlock(
  organizationId: string,
  blockId: string,
): Promise<void> {
  await callJsonRpc("delete_unused_training_block", {
    p_organization_id: organizationId,
    p_block_id: blockId,
  });
}
