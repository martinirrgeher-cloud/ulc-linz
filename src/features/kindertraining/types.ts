export type AttendanceStatus = "open" | "present" | "excused" | "absent";
export type TrainingSessionState = "scheduled" | "cancelled";
export type AthleteNameSort = "firstName" | "lastName";

export type KindertrainingGroupConfiguration = {
  id: string;
  name: string;
  shortName: string | null;
  isActive: boolean;
  regularWeekdays: number[];
  allowSpecialTraining: boolean;
};

export type KindertrainingConfiguration = {
  group: KindertrainingGroupConfiguration | null;
  specialDates: string[];
};

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
  isSpecial: boolean;
  isRegularDay: boolean;
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

export type QuickAthleteInput = {
  firstName: string;
  lastName: string;
  birthYear: number;
  sessionDate: string;
  attachExisting?: boolean;
};

export type QuickAthleteResultStatus =
  | "created"
  | "duplicate"
  | "attached"
  | "already_assigned";

export type QuickAthleteResult = {
  status: QuickAthleteResultStatus;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    birthYear: number;
    isActive: boolean;
  };
};
