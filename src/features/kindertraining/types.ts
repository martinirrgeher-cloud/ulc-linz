export type AttendanceStatus = "open" | "present" | "absent";
export type TrainingSessionState = "scheduled" | "cancelled";
export type AthleteNameSort = "firstName" | "lastName";
export type TrainingEnvironment = "indoor" | "outdoor" | null;

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
  groupTrainerIds: string[];
};

export type AthleteEmergencyContact = {
  id: string;
  contactName: string;
  relationship: string;
  phone: string;
  isEmergency: boolean;
  priority: number;
  notes: string;
};

export type KindertrainingParticipant = {
  athleteId: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  isActive: boolean;
  status: AttendanceStatus;
  contacts: AthleteEmergencyContact[];
};

export type KindertrainingTrainer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

export type KindertrainingSession = {
  id: string | null;
  state: TrainingSessionState;
  note: string;
  isSpecial: boolean;
  isRegularDay: boolean;
  environment: TrainingEnvironment;
  trainerIds: string[];
  availableTrainers: KindertrainingTrainer[];
  usesDefaults: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  participants: KindertrainingParticipant[];
};

export type KindertrainingDraft = {
  state: TrainingSessionState;
  note: string;
  attendance: Record<string, AttendanceStatus>;
  environment: TrainingEnvironment;
  trainerIds: string[];
};

export type SaveKindertrainingInput = {
  organizationId: string;
  groupId: string;
  sessionDate: string;
  state: TrainingSessionState;
  note: string;
  participants: KindertrainingParticipant[];
  attendance: Record<string, AttendanceStatus>;
  environment: TrainingEnvironment;
  trainerIds: string[];
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

export type DeleteSpecialTrainingResult = "deleted" | "archived" | "not_found";
