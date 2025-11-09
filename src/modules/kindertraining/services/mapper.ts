// src/modules/kindertraining/services/mapper.ts
import type { KindertrainingRoot, WeekData, Settings, WeekId, DayKey } from "../lib/types";

const DAY_KEYS: DayKey[] = ["mon","tue","wed","thu","fri","sat","sun"];

export function normalizeRoot(raw: any): KindertrainingRoot {
  const root: KindertrainingRoot = {
    __settings__: normalizeSettings(raw?.__settings__),
    weeks: {}
  };

  // Wochen normalisieren (neu: root.weeks[weekId], alt: root[weekId] oder root.weeks?.items etc.)
  const weeksObj = raw?.weeks && typeof raw.weeks === "object" ? raw.weeks : raw;
  if (weeksObj && typeof weeksObj === "object") {
    for (const [k, v] of Object.entries(weeksObj)) {
      if (!k || k.startsWith("__")) continue;
      if (!v || typeof v !== "object") continue;
      root.weeks![k as WeekId] = normalizeWeek(v);
    }
  }
  return root;
}

export function normalizeWeek(v: any): WeekData {
  const attendance: Record<string, any> =
    (v?.attendanceByPersonId && typeof v.attendanceByPersonId === "object")
      ? v.attendanceByPersonId
      : (v?.attendance || {});

  const mapped: Record<string, any> = {};
  for (const [pid, days] of Object.entries(attendance || {})) {
    const entry: any = {};
    for (const d of DAY_KEYS) {
      const bool = !!(days as any)?.[d];
      entry[d] = bool;
    }
    mapped[pid] = entry;
  }

  const wd: WeekData = {
    attendanceByPersonId: mapped,
    dayNotes: v?.dayNotes && typeof v.dayNotes === "object" ? v.dayNotes : {},
    inactiveDays: v?.inactiveDays && typeof v.inactiveDays === "object" ? v.inactiveDays : {},
    notPaid: v?.notPaid && typeof v.notPaid === "object" ? v.notPaid : {},
  };
  return wd;
}

export function normalizeSettings(raw: any): Settings {
  const def: Settings = {
    activeDays: ["mon","tue","wed","thu","fri"],
    sortOrder: "nachname",
    showInactive: false,
  };
  if (!raw || typeof raw !== "object") return def;
  return {
    activeDays: Array.isArray(raw.activeDays) ? raw.activeDays as any : def.activeDays,
    sortOrder: raw.sortOrder === "vorname" ? "vorname" : "nachname",
    showInactive: !!raw.showInactive,
  };
}

export function writeBack(root: KindertrainingRoot): KindertrainingRoot {
  // Hier könnten wir das Zielschema erzwingen; aktuell lassen wir es so wie normalisiert (stabil)
  return root;
}
