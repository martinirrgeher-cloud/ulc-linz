export type AttendanceStatus = "open" | "present" | "excused" | "absent";

export type DraftTrainingEntry = {
  attendance: Record<string, AttendanceStatus>;
  note: string;
  cancelled: boolean;
};
