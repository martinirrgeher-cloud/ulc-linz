import type { ExerciseParameterDefinition } from "@/features/exercise-catalog/types";

export type PlanningGroup = {
  id: string;
  name: string;
  shortName: string | null;
  isPerformanceGroup: boolean;
};

export type PlanningAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  groupIds: string[];
};

export type PlanningExercise = {
  id: string;
  name: string;
  categoryKey: string;
  categoryTitle: string;
  subcategory: string | null;
  goal: string | null;
  description: string | null;
  coachingCues: string | null;
  commonMistakes: string | null;
  equipment: string[];
  videoUrl: string | null;
  groupIds: string[];
  parameters: ExerciseParameterDefinition[];
};

export type PlanningBlockItem = {
  exerciseId: string;
  exerciseName: string;
  categoryTitle: string;
  note: string | null;
  parameterValues: Record<string, string>;
  parameters: ExerciseParameterDefinition[];
};

export type PlanningBlock = {
  id: string;
  name: string;
  goal: string | null;
  description: string | null;
  estimatedMinutes: number | null;
  groupIds: string[];
  items: PlanningBlockItem[];
};

export type TrainingPlanSummary = {
  id: string;
  athleteId: string;
  athleteName: string;
  groupId: string;
  trainingDate: string;
  title: string;
  status: "draft" | "published";
  sourcePlanId: string | null;
  copiedFromAthleteId: string | null;
  copiedFromAthleteName: string | null;
  sectionCount: number;
  exerciseCount: number;
  totalMinutes: number;
  updatedAt: string;
};

export type TrainingPlanningData = {
  groups: PlanningGroup[];
  athletes: PlanningAthlete[];
  blocks: PlanningBlock[];
  exercises: PlanningExercise[];
  plans: TrainingPlanSummary[];
};

export type TrainingPlanItemInput = {
  clientId: string;
  id: string | null;
  exerciseId: string;
  exerciseName: string;
  categoryTitle: string;
  note: string;
  parameterDefinitions: ExerciseParameterDefinition[];
  parameterValues: Record<string, string>;
};

export type TrainingPlanSectionInput = {
  clientId: string;
  id: string | null;
  sectionType: "block" | "exercise";
  sourceBlockId: string | null;
  countsAsBlockUsage: boolean;
  name: string;
  goal: string;
  description: string;
  estimatedMinutes: string;
  items: TrainingPlanItemInput[];
};

export type TrainingPlan = {
  id: string;
  athleteId: string;
  athleteName: string;
  groupId: string;
  trainingDate: string;
  title: string;
  notes: string;
  status: "draft" | "published";
  sourcePlanId: string | null;
  copiedFromAthleteId: string | null;
  copiedFromAthleteName: string | null;
  sections: TrainingPlanSectionInput[];
  createdAt: string;
  updatedAt: string;
};

export type TrainingPlanInput = {
  title: string;
  notes: string;
  sections: TrainingPlanSectionInput[];
};

export type CopyTrainingPlanResult = {
  copied: Array<{
    athleteId: string;
    planId: string;
    overwritten: boolean;
  }>;
  skipped: Array<{
    athleteId: string;
    planId: string | null;
    reason: "source_athlete" | "not_in_group" | "existing_plan" | string;
  }>;
};

export function createClientId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyTrainingPlanInput(trainingDate: string): TrainingPlanInput {
  const [year, month, day] = trainingDate.split("-");
  const dateTitle = day && month && year ? `${day}.${month}.${year}` : trainingDate;
  return {
    title: `Training ${dateTitle}`,
    notes: "",
    sections: [],
  };
}

export function createSectionFromBlock(block: PlanningBlock): TrainingPlanSectionInput {
  return {
    clientId: createClientId("plan-section"),
    id: null,
    sectionType: "block",
    sourceBlockId: block.id,
    countsAsBlockUsage: true,
    name: block.name,
    goal: block.goal ?? "",
    description: block.description ?? "",
    estimatedMinutes: block.estimatedMinutes?.toString() ?? "",
    items: block.items.map((item) => ({
      clientId: createClientId("plan-item"),
      id: null,
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      categoryTitle: item.categoryTitle,
      note: item.note ?? "",
      parameterDefinitions: item.parameters.map((parameter) => ({ ...parameter })),
      parameterValues: { ...item.parameterValues },
    })),
  };
}

export function createSectionFromExercise(exercise: PlanningExercise): TrainingPlanSectionInput {
  const parameterValues = Object.fromEntries(
    exercise.parameters
      .filter((parameter) => parameter.defaultValue !== "")
      .map((parameter) => [parameter.key, parameter.defaultValue]),
  );

  const durationParameter = exercise.parameters.find(
    (parameter) => parameter.key === "duration_s" && parameter.defaultValue,
  );
  const durationSeconds = durationParameter
    ? Number.parseFloat(durationParameter.defaultValue)
    : Number.NaN;
  const estimatedMinutes = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.max(1, Math.ceil(durationSeconds / 60)).toString()
    : "";

  return {
    clientId: createClientId("plan-section"),
    id: null,
    sectionType: "exercise",
    sourceBlockId: null,
    countsAsBlockUsage: false,
    name: exercise.name,
    goal: exercise.goal ?? "",
    description: exercise.description ?? "",
    estimatedMinutes,
    items: [{
      clientId: createClientId("plan-item"),
      id: null,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      categoryTitle: exercise.categoryTitle,
      note: "",
      parameterDefinitions: exercise.parameters.map((parameter) => ({ ...parameter })),
      parameterValues,
    }],
  };
}

export function trainingPlanToInput(plan: TrainingPlan): TrainingPlanInput {
  return {
    title: plan.title,
    notes: plan.notes,
    sections: plan.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        parameterDefinitions: item.parameterDefinitions.map((parameter) => ({ ...parameter })),
        parameterValues: { ...item.parameterValues },
      })),
    })),
  };
}
