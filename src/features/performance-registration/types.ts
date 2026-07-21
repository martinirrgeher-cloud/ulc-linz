import type { AppRole } from "@/types/auth";

export type PerformanceAvailabilityStatus =
  | "open"
  | "coming"
  | "maybe"
  | "unavailable";

export type PerformanceAvailability = {
  date: string;
  status: PerformanceAvailabilityStatus;
  availableFrom: string;
  availableUntil: string;
  comment: string;
  source: "self" | "trainer" | "proxy" | "default" | "copy" | null;
  updatedAt: string | null;
  isLate: boolean;
};

export type PerformanceAvailabilityDraft = Pick<
  PerformanceAvailability,
  "status" | "availableFrom" | "availableUntil" | "comment"
>;

export type PerformanceAvailabilityDefault = {
  weekday: number;
  status: PerformanceAvailabilityStatus;
  availableFrom: string;
  availableUntil: string;
  comment: string;
};

export type PerformancePerson = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

export type PerformanceAthlete = PerformancePerson & {
  birthYear: number | null;
  availability: PerformanceAvailability[];
  defaults: PerformanceAvailabilityDefault[];
};

export type PerformanceTrainer = PerformancePerson & {
  availability: PerformanceAvailability[];
};

export type PerformanceGroup = {
  id: string;
  name: string;
  shortName: string | null;
  regularWeekdays: number[];
  deadlineWeekday: number;
  deadlineTime: string;
  weeksAhead: number;
  allowLateRegistration: boolean;
};

export type PerformanceContext = {
  role: AppRole;
  canManage: boolean;
  athlete: PerformancePerson | null;
  trainer: PerformancePerson | null;
  groups: PerformanceGroup[];
};

export type PerformanceTrainingDate = {
  date: string;
  weekday: number;
  deadlineAt: string | null;
};

export type PerformanceWeek = {
  weekStart: string;
  weekEnd: string;
  group: PerformanceGroup;
  dates: PerformanceTrainingDate[];
  athletes: PerformanceAthlete[];
  trainers: PerformanceTrainer[];
};

export type PerformanceSaveTarget = "athlete" | "trainer";

export type PerformanceSaveInput = {
  organizationId: string;
  groupId: string;
  personId: string;
  trainingDate: string;
  target: PerformanceSaveTarget;
  draft: PerformanceAvailabilityDraft;
};
