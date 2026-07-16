// src/modules/kindertraining/services/weeks.ts
import { downloadJson, overwriteJsonContent as __overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import type { DayKey, WeekData, WeekId } from "../lib/types";
// --- prune notPaid before persisting ---
function pruneNotPaid(root: any) {
  if (!root || typeof root !== "object") return;
  const weeks = root.weeks && typeof root.weeks === "object" ? root.weeks : {};
  if (weeks.attendance && typeof weeks.attendance === "object") delete weeks.attendance.notPaid;
  if (weeks.weekMeta && typeof weeks.weekMeta === "object") delete weeks.weekMeta.notPaid;
  Object.values(weeks).forEach((wk: any) => { if (wk && typeof wk === "object") delete wk.notPaid; });
}

// Wrapper für persistierende Writes
async function overwriteJsonContent(fileId: string, payload: any) {
  try { pruneNotPaid(payload); } catch {}
  return __overwriteJsonContent(fileId, payload);
}


function getDataFileId(): string {
  const id = import.meta.env.VITE_DRIVE_KINDERTRAINING_DATA_FILE_ID;
  if (!id) throw new Error("VITE_DRIVE_KINDERTRAINING_DATA_FILE_ID fehlt");
  return String(id);
}

type Root = {
  __settings__?: any;
  weeks?: Record<string, WeekData>;
};

let cache: Root | null = null;
let saveTimer: number | null = null;

// Debounced save (300ms) – bündelt schnelle Änderungen
function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    if (cache) await overwriteJsonContent(getDataFileId(), cache);
  }, 300) as unknown as number;
}

async function loadRoot(): Promise<Root> {
  if (cache) return cache;
  const raw = await downloadJson<any>(getDataFileId());
  const root: Root = (raw && typeof raw === "object") ? raw : {};
  if (!root.weeks) root.weeks = {};
  cache = root;
  return root;
}

export async function loadWeekData(weekId: WeekId): Promise<WeekData> {
  const root = await loadRoot();
  if (!root.weeks![weekId]) root.weeks![weekId] = { attendanceByPersonId: {}, dayNotes: {}, inactiveDays: {}, notPaid: {} };
  return root.weeks![weekId];
}

export async function toggleAttendance(weekId: WeekId, personId: string, day: DayKey): Promise<WeekData> {
  const root = await loadRoot();
  const week = await loadWeekData(weekId);
  const map = (week.attendanceByPersonId[personId] ||= {} as any);
  (map as any)[day] = !(map as any)[day];
  root.weeks![weekId] = week;
  scheduleSave();
  return week;
}

export async function setDayNote(weekId: WeekId, isoDate: string, text: string): Promise<WeekData> {
  const root = await loadRoot();
  const week = await loadWeekData(weekId);
  if (!week.dayNotes) week.dayNotes = {};
  if (text && text.trim()) week.dayNotes[isoDate] = text;
  else delete week.dayNotes[isoDate];
  root.weeks![weekId] = week;
  scheduleSave();
  return week;
}

export async function setInactiveDay(weekId: WeekId, isoDate: string, inactive: boolean): Promise<WeekData> {
  const root = await loadRoot();
  const week = await loadWeekData(weekId);
  if (!week.inactiveDays) week.inactiveDays = {};
  if (inactive) week.inactiveDays[isoDate] = true;
  else delete week.inactiveDays[isoDate];
  root.weeks![weekId] = week;
  scheduleSave();
  return week;
}
