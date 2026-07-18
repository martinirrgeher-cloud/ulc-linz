export type AthleteGroupSummary = {
  id: string;
  name: string;
  shortName: string | null;
  isActive: boolean;
};

export type AthleteContact = {
  id: string | null;
  contactName: string;
  relationship: string;
  phone: string;
  isEmergency: boolean;
  priority: number;
  notes: string;
};

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  groups: AthleteGroupSummary[];
  contacts: AthleteContact[];
};

export type TrainingGroupModuleKey = "kindertraining" | null;

export type TrainingGroup = {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  athleteCount: number;
  moduleKey: TrainingGroupModuleKey;
  regularWeekdays: number[];
  allowSpecialTraining: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Trainer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  linkedUserId: string | null;
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AthleteInput = {
  firstName: string;
  lastName: string;
  birthYear: number | null;
  notes: string;
  isActive: boolean;
  groupIds: string[];
  contacts: AthleteContact[];
};

export type TrainingGroupInput = {
  name: string;
  shortName: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  moduleKey: TrainingGroupModuleKey;
  regularWeekdays: number[];
  allowSpecialTraining: boolean;
};

export type TrainerInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  isActive: boolean;
  groupIds: string[];
};
