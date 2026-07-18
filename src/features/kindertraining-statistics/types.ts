import type { TrainingEnvironment, TrainingSessionState } from "@/features/kindertraining/types";

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
  birthYear: number | null;
  isActive: boolean;
  possibleCount: number;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  openCount: number;
  attendanceRate: number;
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

export type KindertrainingStatisticsSummary = {
  sessionCount: number;
  cancelledCount: number;
  averagePresent: number;
  maxPresent: number;
  uniquePresent: number;
};

export type KindertrainingStatistics = {
  defaultFromDate: string;
  fromDate: string;
  toDate: string;
  summary: KindertrainingStatisticsSummary;
  sessions: StatisticsSession[];
  athletes: AthleteStatisticsRow[];
  trainers: TrainerStatisticsRow[];
  monthly: MonthlyStatisticsRow[];
};
