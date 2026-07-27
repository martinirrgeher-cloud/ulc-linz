import type {
  ExerciseParameterDefinition,
  ExerciseTrainingGroup,
  ExerciseVideo,
} from "@/features/exercise-catalog/types";

export type TrainingBlockExercise = {
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
  videos: ExerciseVideo[];
  groupIds: string[];
  isActive: boolean;
  parameters: ExerciseParameterDefinition[];
};

export type TrainingBlockItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseIsActive: boolean;
  categoryTitle: string;
  sortOrder: number;
  note: string | null;
  parameterValues: Record<string, string>;
  parameters: ExerciseParameterDefinition[];
};

export type TrainingBlock = {
  id: string;
  name: string;
  goal: string | null;
  description: string | null;
  estimatedMinutes: number | null;
  isActive: boolean;
  groupIds: string[];
  items: TrainingBlockItem[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TrainingBlockData = {
  groups: ExerciseTrainingGroup[];
  exercises: TrainingBlockExercise[];
  blocks: TrainingBlock[];
};

export type TrainingBlockItemInput = {
  clientId: string;
  exerciseId: string;
  note: string;
  parameterValues: Record<string, string>;
};

export type TrainingBlockInput = {
  name: string;
  goal: string;
  description: string;
  estimatedMinutes: string;
  isActive: boolean;
  groupIds: string[];
  items: TrainingBlockItemInput[];
};

function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `training-block-item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyTrainingBlockInput(): TrainingBlockInput {
  return {
    name: "",
    goal: "",
    description: "",
    estimatedMinutes: "",
    isActive: true,
    groupIds: [],
    items: [],
  };
}

export function trainingBlockToInput(block: TrainingBlock): TrainingBlockInput {
  return {
    name: block.name,
    goal: block.goal ?? "",
    description: block.description ?? "",
    estimatedMinutes: block.estimatedMinutes?.toString() ?? "",
    isActive: block.isActive,
    groupIds: [...block.groupIds],
    items: block.items.map((item) => ({
      clientId: item.id || createClientId(),
      exerciseId: item.exerciseId,
      note: item.note ?? "",
      parameterValues: { ...item.parameterValues },
    })),
  };
}

export function createTrainingBlockItemInput(
  exercise: TrainingBlockExercise,
): TrainingBlockItemInput {
  const parameterValues: Record<string, string> = {};
  exercise.parameters.forEach((parameter) => {
    if (parameter.defaultValue) parameterValues[parameter.key] = parameter.defaultValue;
  });

  return {
    clientId: createClientId(),
    exerciseId: exercise.id,
    note: "",
    parameterValues,
  };
}

export function duplicateTrainingBlockItemInput(
  item: TrainingBlockItemInput,
): TrainingBlockItemInput {
  return {
    ...item,
    clientId: createClientId(),
    parameterValues: { ...item.parameterValues },
  };
}
