import type { Json } from "@/types/database.generated";
import type { EditLockWriteGuard } from "@/features/collaboration/edit-locks";
import type { ExerciseParameterDefinition, ExerciseParameterInputType } from "@/features/exercise-catalog/types";
import { callJsonRpc } from "@/lib/supabase-rpc";
import { isRecord, numberOrNull, parseStringArray } from "@/lib/json-value";
import type {
  PlanningAthlete,
  PlanningBlock,
  PlanningBlockItem,
  PlanningExercise,
  PlanningGroup,
  TrainingPlan,
  TrainingPlanInput,
  TrainingPlanningData,
  TrainingPlanSectionInput,
  TrainingPlanSummary,
} from "@/features/training-planning/types";

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
      sortOrder: numberValue(item.sort_order, 100),
    }];
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

function parseParameterValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (typeof entry === "string") return [[key, entry]];
      if (typeof entry === "number" && Number.isFinite(entry)) return [[key, String(entry)]];
      return [];
    }),
  );
}

function parseGroups(value: unknown): PlanningGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      shortName: optionalString(item.short_name),
      isPerformanceGroup: item.is_performance_group === true,
    }];
  });
}

function parseAthletes(value: unknown): PlanningAthlete[] {
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
      groupIds: parseStringArray(item.group_ids),
    }];
  });
}

function parseBlockItems(value: unknown): PlanningBlockItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.exercise_id !== "string"
      || typeof item.exercise_name !== "string"
    ) return [];
    return [{
      exerciseId: item.exercise_id,
      exerciseName: item.exercise_name,
      categoryTitle: stringValue(item.category_title),
      note: optionalString(item.note),
      parameterValues: parseParameterValues(item.parameter_values),
      parameters: parseParameters(item.parameters),
    }];
  });
}

function parseBlocks(value: unknown): PlanningBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      name: item.name,
      goal: optionalString(item.goal),
      description: optionalString(item.description),
      estimatedMinutes: numberOrNull(item.estimated_minutes),
      groupIds: parseStringArray(item.group_ids),
      items: parseBlockItems(item.items),
    }];
  });
}

function parseExercises(value: unknown): PlanningExercise[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.name !== "string"
      || typeof item.category_key !== "string"
    ) return [];
    return [{
      id: item.id,
      name: item.name,
      categoryKey: item.category_key,
      categoryTitle: stringValue(item.category_title),
      subcategory: optionalString(item.subcategory),
      goal: optionalString(item.goal),
      description: optionalString(item.description),
      coachingCues: optionalString(item.coaching_cues),
      commonMistakes: optionalString(item.common_mistakes),
      equipment: parseStringArray(item.equipment),
      videoUrl: optionalString(item.video_url),
      groupIds: parseStringArray(item.group_ids),
      parameters: parseParameters(item.parameters),
    }];
  });
}

function parsePlanSummaries(value: unknown): TrainingPlanSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item)
      || typeof item.id !== "string"
      || typeof item.athlete_id !== "string"
      || typeof item.athlete_name !== "string"
      || typeof item.group_id !== "string"
      || typeof item.training_date !== "string"
      || typeof item.title !== "string"
    ) return [];
    return [{
      id: item.id,
      athleteId: item.athlete_id,
      athleteName: item.athlete_name,
      groupId: item.group_id,
      trainingDate: item.training_date,
      title: item.title,
      status: item.status === "published" ? "published" : "draft",
      sourcePlanId: optionalString(item.source_plan_id),
      copiedFromAthleteId: optionalString(item.copied_from_athlete_id),
      copiedFromAthleteName: optionalString(item.copied_from_athlete_name),
      sectionCount: numberValue(item.section_count),
      exerciseCount: numberValue(item.exercise_count),
      totalMinutes: numberValue(item.total_minutes),
      updatedAt: stringValue(item.updated_at),
    }];
  });
}

function parsePlanSections(value: unknown): TrainingPlanSectionInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((section) => {
    if (
      !isRecord(section)
      || typeof section.id !== "string"
      || (section.section_type !== "block" && section.section_type !== "exercise")
      || typeof section.name !== "string"
    ) return [];

    const items = Array.isArray(section.items)
      ? section.items.flatMap((item) => {
        if (
          !isRecord(item)
          || typeof item.id !== "string"
          || typeof item.exercise_id !== "string"
          || typeof item.exercise_name !== "string"
        ) return [];
        return [{
          clientId: item.id,
          id: item.id,
          exerciseId: item.exercise_id,
          exerciseName: item.exercise_name,
          categoryTitle: stringValue(item.category_title),
          note: stringValue(item.note),
          parameterDefinitions: parseParameters(item.parameter_definitions),
          parameterValues: parseParameterValues(item.parameter_values),
        }];
      })
      : [];

    return [{
      clientId: section.id,
      id: section.id,
      sectionType: section.section_type,
      sourceBlockId: optionalString(section.source_block_id),
      countsAsBlockUsage: section.counts_as_block_usage === true,
      name: section.name,
      goal: stringValue(section.goal),
      description: stringValue(section.description),
      estimatedMinutes: numberOrNull(section.estimated_minutes)?.toString() ?? "",
      items,
    }];
  });
}

export async function loadTrainingPlanningOverview(
  organizationId: string,
  trainingDate: string,
  groupId: string | null,
): Promise<TrainingPlanningData> {
  const data = await callJsonRpc("training_planning_overview", {
    p_organization_id: organizationId,
    p_training_date: trainingDate,
    p_group_id: groupId,
  });
  if (!isRecord(data)) throw new Error("Die Trainingsplanung konnte nicht geladen werden.");

  return {
    groups: parseGroups(data.groups),
    athletes: parseAthletes(data.athletes),
    blocks: parseBlocks(data.blocks),
    exercises: parseExercises(data.exercises),
    plans: parsePlanSummaries(data.plans),
  };
}

export async function loadTrainingPlan(
  organizationId: string,
  planId: string,
): Promise<TrainingPlan> {
  const data = await callJsonRpc("training_plan_detail", {
    p_organization_id: organizationId,
    p_plan_id: planId,
  });
  if (
    !isRecord(data)
    || typeof data.id !== "string"
    || typeof data.athlete_id !== "string"
    || typeof data.athlete_name !== "string"
    || typeof data.group_id !== "string"
    || typeof data.training_date !== "string"
    || typeof data.title !== "string"
  ) {
    throw new Error("Der Trainingsplan konnte nicht gelesen werden.");
  }

  return {
    id: data.id,
    athleteId: data.athlete_id,
    athleteName: data.athlete_name,
    groupId: data.group_id,
    trainingDate: data.training_date,
    title: data.title,
    notes: stringValue(data.notes),
    status: data.status === "published" ? "published" : "draft",
    sourcePlanId: optionalString(data.source_plan_id),
    copiedFromAthleteId: optionalString(data.copied_from_athlete_id),
    copiedFromAthleteName: optionalString(data.copied_from_athlete_name),
    sections: parsePlanSections(data.sections),
    createdAt: stringValue(data.created_at),
    updatedAt: stringValue(data.updated_at),
  };
}

function sectionToJson(section: TrainingPlanSectionInput): Json {
  return {
    section_type: section.sectionType,
    source_block_id: section.sourceBlockId,
    counts_as_block_usage: section.countsAsBlockUsage,
    name: section.name.trim(),
    goal: section.goal.trim() || null,
    description: section.description.trim() || null,
    estimated_minutes: section.estimatedMinutes.trim() || null,
    items: section.items.map((item) => ({
      exercise_id: item.exerciseId,
      note: item.note.trim() || null,
      parameter_definitions: item.parameterDefinitions.map((parameter) => ({
        parameter_key: parameter.key,
        label: parameter.label,
        unit: parameter.unit,
        input_type: parameter.inputType,
        default_value: parameter.defaultValue || null,
        min_value: parameter.minValue,
        max_value: parameter.maxValue,
        step_value: parameter.stepValue,
        is_required: parameter.isRequired,
        sort_order: parameter.sortOrder,
      })),
      parameter_values: Object.fromEntries(
        Object.entries(item.parameterValues)
          .map(([key, value]) => [key, value.trim()] as const)
          .filter(([, value]) => value !== ""),
      ),
    })),
  };
}

export async function saveTrainingPlan(
  organizationId: string,
  planId: string | null,
  athleteId: string,
  groupId: string,
  trainingDate: string,
  values: TrainingPlanInput,
  editLock: EditLockWriteGuard | null,
): Promise<string> {
  const data = await callJsonRpc("save_athlete_training_plan_v2", {
    p_organization_id: organizationId,
    p_plan_id: planId,
    p_athlete_id: athleteId,
    p_group_id: groupId,
    p_training_date: trainingDate,
    p_title: values.title,
    p_notes: values.notes,
    p_sections: values.sections.map(sectionToJson),
    p_lock_token: editLock?.lockToken ?? null,
    p_expected_updated_at: editLock?.expectedUpdatedAt ?? null,
  });
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.updated_at !== "string") {
    throw new Error("Der Trainingsplan wurde gespeichert, aber die Rückgabe ist ungültig.");
  }
  return data.id;
}
