export type ExerciseParameterKey = string;
export type ExerciseParameterInputType = "number" | "text";

export type ExerciseListOption = {
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type ExerciseParameterOption = ExerciseListOption & {
  unit: string;
  inputType: ExerciseParameterInputType;
  stepValue: number | null;
};

export type ExerciseCategory = {
  key: string;
  title: string;
  sortOrder: number;
  isActive?: boolean;
};

export type ExerciseTrainingGroup = {
  id: string;
  name: string;
  shortName: string | null;
};

export type ExerciseVideo = {
  id: string;
  title: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  isPrimary: boolean;
  createdAt: string;
  signedUrl: string | null;
};

export type ExerciseParameterDefinition = {
  key: ExerciseParameterKey;
  label: string;
  unit: string;
  inputType: ExerciseParameterInputType;
  defaultValue: string;
  minValue: number | null;
  maxValue: number | null;
  stepValue: number | null;
  isRequired: boolean;
  sortOrder: number;
};

export type Exercise = {
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
  isActive: boolean;
  isFavorite: boolean;
  groupIds: string[];
  parameters: ExerciseParameterDefinition[];
  videos: ExerciseVideo[];
  createdAt: string;
  updatedAt: string;
};

export type ExerciseCatalogData = {
  categories: ExerciseCategory[];
  subcategories: ExerciseListOption[];
  materials: ExerciseListOption[];
  parameterOptions: ExerciseParameterOption[];
  groups: ExerciseTrainingGroup[];
  exercises: Exercise[];
};

export type ExerciseInput = {
  name: string;
  categoryKey: string;
  subcategory: string;
  goal: string;
  description: string;
  coachingCues: string;
  commonMistakes: string;
  equipment: string[];
  videoUrl: string;
  isActive: boolean;
  groupIds: string[];
  parameters: ExerciseParameterDefinition[];
};

export function createParameterDefinition(
  option: ExerciseParameterOption,
  sortOrder: number,
): ExerciseParameterDefinition {
  return {
    key: option.key,
    label: option.label,
    unit: option.unit,
    inputType: option.inputType,
    defaultValue: "",
    minValue: null,
    maxValue: null,
    stepValue: option.stepValue,
    isRequired: false,
    sortOrder,
  };
}

export function createEmptyExerciseInput(defaultCategoryKey: string): ExerciseInput {
  return {
    name: "",
    categoryKey: defaultCategoryKey,
    subcategory: "",
    goal: "",
    description: "",
    coachingCues: "",
    commonMistakes: "",
    equipment: [],
    videoUrl: "",
    isActive: true,
    groupIds: [],
    parameters: [],
  };
}

export function exerciseToInput(exercise: Exercise): ExerciseInput {
  return {
    name: exercise.name,
    categoryKey: exercise.categoryKey,
    subcategory: exercise.subcategory ?? "",
    goal: exercise.goal ?? "",
    description: exercise.description ?? "",
    coachingCues: exercise.coachingCues ?? "",
    commonMistakes: exercise.commonMistakes ?? "",
    equipment: [...exercise.equipment],
    videoUrl: exercise.videoUrl ?? "",
    isActive: exercise.isActive,
    groupIds: [...exercise.groupIds],
    parameters: exercise.parameters.map((parameter) => ({ ...parameter })),
  };
}
