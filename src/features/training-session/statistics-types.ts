import type { TrainingEnvironment, TrainingSessionState } from "@/features/training-session/types";

export type StatisticsNamedItem = {
  id: string;
  name: string;
};

export type StatisticsSession = {
  id: string;
  sessionDate: string;
  state: TrainingSessionState;
  isSpecial: boolean;
  environment: TrainingEnvironment;
  note: string;
  presentCount: number;
  participantCount: number;
  presentAthletes: StatisticsNamedItem[];
  trainers: StatisticsNamedItem[];
};

export type AthleteStatisticsRow = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  presentCount: number;
};

export type TrainerStatisticsRow = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  sessionCount: number;
};

export type MonthlyStatisticsRow = {
  month: string;
  sessionCount: number;
  averagePresent: number;
};

export type TrainingStatisticsSummary = {
  sessionCount: number;
  cancelledCount: number;
  averagePresent: number;
  maxPresent: number;
  minPresent: number;
  uniquePresent: number;
};

export type TrainingStatistics = {
  defaultFromDate: string;
  fromDate: string;
  toDate: string;
  summary: TrainingStatisticsSummary;
  sessions: StatisticsSession[];
  athletes: AthleteStatisticsRow[];
  trainers: TrainerStatisticsRow[];
  monthly: MonthlyStatisticsRow[];
};
