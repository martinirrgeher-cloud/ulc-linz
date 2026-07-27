import type { ExerciseParameterDefinition } from "@/features/exercise-catalog/types";

export type DocumentationRole = "admin" | "trainer" | "athlete" | "parent";
export type TrainingSessionStatus = "not_started" | "in_progress" | "completed" | "partial" | "aborted";
export type ExerciseDocumentationStatus = "planned" | "as_planned" | "changed" | "partial" | "skipped" | "aborted";
export type PainLevel = "none" | "mild" | "strong";
export type SaveState = "idle" | "saving" | "saved" | "local" | "error";

export type DocumentationGroup = {
  id: string;
  name: string;
  shortName: string | null;
  regularWeekdays: number[];
};

export type DocumentationAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  groupIds: string[];
};

export type DocumentationPlanSummary = {
  id: string;
  athleteId: string;
  athleteName: string;
  groupId: string;
  groupName: string;
  trainingDate: string;
  title: string;
  plannedMinutes: number;
  exerciseCount: number;
  sessionId: string | null;
  sessionStatus: TrainingSessionStatus;
  actualMinutes: number | null;
  overallRpe: number | null;
  overallRating: number | null;
  completedExerciseCount: number;
  updatedAt: string;
};

export type TrainingDocumentationOverview = {
  weekStart: string;
  weekEnd: string;
  currentRole: DocumentationRole;
  ownAthleteId: string | null;
  canReview: boolean;
  groups: DocumentationGroup[];
  athletes: DocumentationAthlete[];
  plans: DocumentationPlanSummary[];
};

export type DocumentationMedia = {
  id: string;
  title: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  signedUrl: string | null;
};

export type DocumentationSetInput = {
  clientId: string;
  id: string | null;
  setNumber: number;
  plannedValues: Record<string, string>;
  actualValues: Record<string, string>;
  status: Exclude<ExerciseDocumentationStatus, "planned">;
  comment: string;
};

export type DocumentationItemInput = {
  id: string;
  sourcePlanItemId: string | null;
  sourceExerciseId: string | null;
  exerciseName: string;
  categoryTitle: string;
  exerciseGoal: string;
  exerciseDescription: string;
  exerciseCoachingCues: string;
  exerciseCommonMistakes: string;
  exerciseEquipment: string[];
  plannedNote: string;
  parameterDefinitions: ExerciseParameterDefinition[];
  plannedValues: Record<string, string>;
  actualValues: Record<string, string>;
  status: ExerciseDocumentationStatus;
  rating: number | null;
  rpe: number | null;
  comment: string;
  painLevel: PainLevel;
  painComment: string;
  trainerComment: string;
  exerciseVideoUrl: string | null;
  exerciseVideoStoragePath: string | null;
  exerciseVideoSignedUrl: string | null;
  media: DocumentationMedia[];
  sets: DocumentationSetInput[];
};

export type DocumentationSectionInput = {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number | null;
  items: DocumentationItemInput[];
};

export type TrainingDocumentationInput = {
  sessionId: string;
  planId: string;
  athleteId: string;
  athleteName: string;
  groupId: string;
  groupName: string;
  trainingDate: string;
  planTitle: string;
  planNotes: string;
  status: Exclude<TrainingSessionStatus, "not_started">;
  startedAt: string;
  completedAt: string | null;
  plannedMinutes: number;
  actualMinutes: string;
  overallRpe: number | null;
  overallRating: number | null;
  overallComment: string;
  painLevel: PainLevel;
  painComment: string;
  trainerFeedback: string;
  trainerReviewedAt: string | null;
  editedAfterCompletion: boolean;
  updatedAt: string;
  canEdit: boolean;
  canReview: boolean;
  sections: DocumentationSectionInput[];
};

export type TrainingDocumentationPlanPreview = {
  planId: string;
  athleteId: string;
  athleteName: string;
  groupId: string;
  groupName: string;
  trainingDate: string;
  title: string;
  notes: string;
  plannedMinutes: number;
  exerciseCount: number;
  canEdit: boolean;
  canReview: boolean;
  sections: Array<{
    id: string;
    name: string;
    description: string;
    estimatedMinutes: number | null;
    items: Array<{
      id: string;
      exerciseName: string;
      categoryTitle: string;
      exerciseGoal: string;
      exerciseDescription: string;
      exerciseCoachingCues: string;
      exerciseCommonMistakes: string;
      exerciseEquipment: string[];
      note: string;
      parameterDefinitions: ExerciseParameterDefinition[];
      parameterValues: Record<string, string>;
      exerciseVideoUrl: string | null;
      exerciseVideoStoragePath: string | null;
      exerciseVideoSignedUrl: string | null;
    }>;
  }>;
};

export type TrainingDocumentationDetail = {
  preview: TrainingDocumentationPlanPreview;
  session: TrainingDocumentationInput | null;
};

export type DocumentationStatisticsSummary = {
  sessionCount: number;
  completedCount: number;
  plannedMinutes: number;
  actualMinutes: number;
  averageRpe: number | null;
  averageRating: number | null;
  painSessionCount: number;
  exerciseCount: number;
  completionRate: number;
};

export type DocumentationStatisticsSession = {
  id: string;
  trainingDate: string;
  title: string;
  status: Exclude<TrainingSessionStatus, "not_started">;
  plannedMinutes: number;
  actualMinutes: number | null;
  overallRpe: number | null;
  overallRating: number | null;
  painLevel: PainLevel;
  completedExerciseCount: number;
  exerciseCount: number;
};

export type DocumentationExerciseStatistic = {
  exerciseId: string | null;
  exerciseName: string;
  sessionCount: number;
  completedCount: number;
  changedCount: number;
  skippedCount: number;
  averageRating: number | null;
  averageRpe: number | null;
  painCount: number;
};

export type DocumentationParameterStatistic = {
  exerciseId: string | null;
  exerciseName: string;
  parameterKey: string;
  label: string;
  unit: string;
  sampleCount: number;
  plannedAverage: number;
  actualAverage: number;
  achievementPercent: number | null;
};

export type DocumentationMonthStatistic = {
  month: string;
  sessionCount: number;
  plannedMinutes: number;
  actualMinutes: number;
  averageRpe: number | null;
  averageRating: number | null;
};

export type DocumentationReasonStatistic = {
  key: string;
  label: string;
  count: number;
};

export type TrainingDocumentationStatistics = {
  athleteId: string;
  athleteName: string;
  dateFrom: string;
  dateTo: string;
  summary: DocumentationStatisticsSummary;
  sessions: DocumentationStatisticsSession[];
  exercises: DocumentationExerciseStatistic[];
  parameters: DocumentationParameterStatistic[];
  months: DocumentationMonthStatistic[];
  reasons: DocumentationReasonStatistic[];
};

export function createDocumentationClientId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function cloneDocumentationInput(value: TrainingDocumentationInput): TrainingDocumentationInput {
  return {
    ...value,
    sections: value.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        parameterDefinitions: item.parameterDefinitions.map((parameter) => ({ ...parameter })),
        exerciseEquipment: [...(item.exerciseEquipment ?? [])],
        plannedValues: { ...item.plannedValues },
        actualValues: { ...item.actualValues },
        media: item.media.map((medium) => ({ ...medium })),
        sets: item.sets.map((set) => ({
          ...set,
          plannedValues: { ...set.plannedValues },
          actualValues: { ...set.actualValues },
        })),
      })),
    })),
  };
}
