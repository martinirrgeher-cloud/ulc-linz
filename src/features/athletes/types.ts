export type AthleteGroupSummary = {
  id: string;
  name: string;
  shortName: string | null;
  isActive: boolean;
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

export type AthleteInput = {
  firstName: string;
  lastName: string;
  birthYear: number | null;
  notes: string;
  isActive: boolean;
  groupIds: string[];
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
