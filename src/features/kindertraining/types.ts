import type { TrainingGroup } from "@/features/athletes/types";

export type AttendanceStatus = "open" | "present" | "excused" | "absent";
export type TrainingSessionState = "scheduled" | "cancelled";

export type KindertrainingParticipant = {
  athleteId: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  isActive: boolean;
  status: AttendanceStatus;
};

export type KindertrainingSession = {
  id: string | null;
  state: TrainingSessionState;
  note: string;
  createdAt: string | null;
  updatedAt: string | null;
  participants: KindertrainingParticipant[];
};

export type KindertrainingDraft = {
  state: TrainingSessionState;
  note: string;
  attendance: Record<string, AttendanceStatus>;
};

export type SaveKindertrainingInput = {
  organizationId: string;
  groupId: string;
  sessionDate: string;
  state: TrainingSessionState;
  note: string;
  participants: KindertrainingParticipant[];
  attendance: Record<string, AttendanceStatus>;
  expectedUpdatedAt: string | null;
};

export type KindertrainingGroup = TrainingGroup;
