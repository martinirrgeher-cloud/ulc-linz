export const EXERCISE_PARAMETER_OPTIONS = [
  { key: "sets", label: "Sätze", unit: "", inputType: "number", step: 1 },
  { key: "repetitions", label: "Wiederholungen", unit: "", inputType: "number", step: 1 },
  { key: "distance_m", label: "Distanz", unit: "m", inputType: "number", step: 1 },
  { key: "weight_kg", label: "Gewicht", unit: "kg", inputType: "number", step: 0.5 },
  { key: "duration_s", label: "Dauer", unit: "s", inputType: "number", step: 1 },
  { key: "target_time_s", label: "Zielzeit", unit: "s", inputType: "number", step: 0.01 },
  { key: "intensity_percent", label: "Intensität", unit: "%", inputType: "number", step: 1 },
  { key: "rest_s", label: "Pause", unit: "s", inputType: "number", step: 5 },
  { key: "series_rest_s", label: "Serienpause", unit: "s", inputType: "number", step: 5 },
  { key: "approach_distance_m", label: "Anlauf", unit: "m", inputType: "number", step: 1 },
  { key: "flying_distance_m", label: "Fliegende Distanz", unit: "m", inputType: "number", step: 1 },
  { key: "contacts", label: "Kontakte", unit: "", inputType: "number", step: 1 },
  { key: "resistance_kg", label: "Widerstand", unit: "kg", inputType: "number", step: 0.5 },
  { key: "height_cm", label: "Höhe", unit: "cm", inputType: "number", step: 1 },
  { key: "tempo_text", label: "Tempo", unit: "", inputType: "text", step: null },
  { key: "surface_text", label: "Untergrund", unit: "", inputType: "text", step: null },
  { key: "start_position_text", label: "Startposition", unit: "", inputType: "text", step: null },
  { key: "note_text", label: "Zusatzhinweis", unit: "", inputType: "text", step: null },
] as const;

export type ExerciseParameterKey = typeof EXERCISE_PARAMETER_OPTIONS[number]["key"];
export type ExerciseParameterInputType = "number" | "text";

export type ExerciseCategory = {
  key: string;
  title: string;
  sortOrder: number;
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
  equipment: string;
  videoUrl: string;
  isActive: boolean;
  groupIds: string[];
  parameters: ExerciseParameterDefinition[];
};

export function createParameterDefinition(
  key: ExerciseParameterKey,
  sortOrder: number,
): ExerciseParameterDefinition {
  const option = EXERCISE_PARAMETER_OPTIONS.find((item) => item.key === key);
  if (!option) throw new Error(`Unbekannter Übungsparameter: ${key}`);

  return {
    key,
    label: option.label,
    unit: option.unit,
    inputType: option.inputType,
    defaultValue: "",
    minValue: null,
    maxValue: null,
    stepValue: option.step,
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
    equipment: "",
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
    equipment: exercise.equipment.join(", "),
    videoUrl: exercise.videoUrl ?? "",
    isActive: exercise.isActive,
    groupIds: [...exercise.groupIds],
    parameters: exercise.parameters.map((parameter) => ({ ...parameter })),
  };
}
