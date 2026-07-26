export type TrainingOverviewStatus = "open" | "coming" | "maybe" | "unavailable";
export type TrainingOverviewDocumentationStatus = "not_started" | "in_progress" | "completed" | "partial" | "aborted";

export type TrainingOverviewGroup = {
  id: string;
  name: string;
  shortName: string | null;
  regularWeekdays: number[];
};

export type TrainingOverviewDate = {
  date: string;
  weekday: number;
};

export type TrainingOverviewRegistration = {
  date: string;
  status: TrainingOverviewStatus;
  comment: string;
  isLate: boolean;
};

export type TrainingOverviewAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  registrations: TrainingOverviewRegistration[];
};

export type TrainingOverviewPlan = {
  id: string;
  athleteId: string;
  trainingDate: string;
  title: string;
  status: "draft" | "published";
  exerciseCount: number;
  totalMinutes: number;
  sessionId: string | null;
  documentationStatus: TrainingOverviewDocumentationStatus;
  actualMinutes: number | null;
  overallRpe: number | null;
  completedExerciseCount: number;
};

export type TrainingWeekOverview = {
  weekStart: string;
  weekEnd: string;
  groups: TrainingOverviewGroup[];
  group: TrainingOverviewGroup | null;
  dates: TrainingOverviewDate[];
  athletes: TrainingOverviewAthlete[];
  plans: TrainingOverviewPlan[];
};
