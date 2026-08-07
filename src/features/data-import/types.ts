import type { AthleteContact } from "@/features/athletes/types";
import type { ExerciseParameterInputType } from "@/features/exercise-catalog/types";

export type ImportKind = "exercises" | "athletes";
export type ImportAction = "create" | "update" | "skip";
export type ImportSeverity = "ready" | "warning" | "error";

export type ExerciseParameterImport = {
  key: string;
  label: string;
  unit: string;
  inputType: ExerciseParameterInputType | "";
  defaultValue: string;
  minValue: number | null;
  maxValue: number | null;
  stepValue: number | null;
  isRequired: boolean;
  sortOrder: number;
};

export type ExerciseImportDraft = {
  name: string;
  category: string;
  subcategory: string;
  goal: string;
  description: string;
  coachingCues: string;
  commonMistakes: string;
  equipment: string[];
  groupNames: string[];
  difficulty: string;
  similarExerciseNames: string[];
  videoUrl: string;
  isActive: boolean | null;
  parameters: ExerciseParameterImport[];
};

export type AthleteImportDraft = {
  firstName: string;
  lastName: string;
  birthYear: number | null;
  groupNames: string[];
  notes: string;
  isActive: boolean | null;
  linkedUserEmail: string;
  contacts: AthleteContact[];
};

export type ImportPreviewRow<T> = {
  rowNumber: number;
  key: string;
  label: string;
  value: T;
  action: ImportAction;
  existingId: string | null;
  severity: ImportSeverity;
  warnings: string[];
  errors: string[];
};

export type ImportResultRow = {
  rowNumber: number;
  label: string;
  action: ImportAction;
  success: boolean;
  message: string;
};

export type ImportRunResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: ImportResultRow[];
};

export type WorkbookSheet = {
  name: string;
  rows: string[][];
};
