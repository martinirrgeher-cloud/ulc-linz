// src/modules/kindertraining/lib/types.ts
export type Person = {
  id: string;
  name: string;
  inactive?: boolean;
  paid?: boolean;
  generalNote?: string;
};

export type WeekId = string; // e.g. "2025-W45"

export type DayKey = "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun";

export type AttendanceMap = Record<DayKey, boolean>;

export type WeekData = {
  attendanceByPersonId: Record<string, AttendanceMap>;
  dayNotes?: Record<string, string>;          // ISO date -> note
  inactiveDays?: Record<string, boolean>;     // ISO date -> inactive
  notPaid?: Record<string, boolean>;          // personId -> notPaid flag (optional)
};

export type Settings = {
  activeDays: DayKey[];
  sortOrder: "vorname" | "nachname";
  showInactive: boolean;
};

export type KindertrainingRoot = {
  __settings__?: Settings;
  weeks?: Record<WeekId, WeekData>;
  // legacy fallbacks allowed – mapper.ts normalisiert
  [key: string]: any;
};
