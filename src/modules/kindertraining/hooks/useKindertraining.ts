// src/modules/kindertraining/hooks/useKindertraining.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DayKey, Person, Settings, WeekData, WeekId } from "../lib/types";
import { loadPersons, addPerson, renamePerson, setInactive as setInactivePerson, setPaid as setPaidPerson, setGeneralNote as setGeneralNotePerson } from "../services/persons";
import { loadWeekData, toggleAttendance, setDayNote, setInactiveDay } from "../services/weeks";
import { loadSettings, saveSettings } from "../services/settings";
import { datesForISOWeek, getISOWeekId, moveISOWeek } from "../lib/weekUtils";

type State = {
  persons: Person[];
  settings: Settings;
  weekId: WeekId;
  dates: string[];
  week: WeekData;
  busy: boolean;
};

const DEFAULT_SETTINGS: Settings = { activeDays: ["mon","tue","wed","thu","fri"], sortOrder: "nachname", showInactive: false };
const KEYS: DayKey[] = ["mon","tue","wed","thu","fri","sat","sun"];
const NAMES_DE = ["Mo","Di","Mi","Do","Fr","Sa","So"] as const;

export function useKindertraining() {
  const [state, setState] = useState<State>({
    persons: [],
    settings: DEFAULT_SETTINGS,
    weekId: getISOWeekId(new Date()),
    dates: datesForISOWeek(getISOWeekId(new Date())),
    week: { attendanceByPersonId: {} },
    busy: false,
  });

  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      setState(s => ({ ...s, busy: true }));
      try {
        const [persons, settings, week] = await Promise.all([
          loadPersons(),
          loadSettings(),
          loadWeekData(state.weekId),
        ]);
        setState(s => ({
          ...s,
          persons,
          settings: settings || DEFAULT_SETTINGS,
          week,
          dates: datesForISOWeek(s.weekId),
        }));
      } finally {
        setState(s => ({ ...s, busy: false }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goWeek = useCallback(async (dir: -1|0|1) => {
    const target = dir === 0 ? getISOWeekId(new Date()) : moveISOWeek(state.weekId, dir);
    setState(s => ({ ...s, weekId: target, dates: datesForISOWeek(target), busy: true }));
    const week = await loadWeekData(target);
    setState(s => ({ ...s, week, busy: false }));
  }, [state.weekId]);
  const prevWeek = useCallback(() => { void goWeek(-1); }, [goWeek]);
  const nextWeek = useCallback(() => { void goWeek(1); }, [goWeek]);

  // Personen – optimistisch & schnell
  const setPersonsLocal = useCallback((updater: (list: Person[]) => Person[]) => {
    setState(s => ({ ...s, persons: updater(s.persons) }));
  }, []);

  const addNewPerson = useCallback(async (name: string) => {
    // optimistisch
    setPersonsLocal(list => [...list, { id: undefined as any, name: name.trim() }]);
    await addPerson(name);
    // resync
    const persons = await loadPersons();
    setState(s => ({ ...s, persons }));
  }, [setPersonsLocal]);

  const rename = useCallback(async (id: string, name: string) => {
    setPersonsLocal(list => list.map(p => p.id === id ? { ...p, name: name.trim() } : p));
    await renamePerson(id, name);
  }, [setPersonsLocal]);

  const setInactive = useCallback(async (id: string, inactive: boolean) => {
    setPersonsLocal(list => list.map(p => p.id === id ? { ...p, inactive } : p));
    await setInactivePerson(id, inactive);
  }, [setPersonsLocal]);

  const setPaid = useCallback(async (id: string, paid: boolean) => {
    setPersonsLocal(list => list.map(p => p.id === id ? { ...p, paid } : p));
    await setPaidPerson(id, paid);
  }, [setPersonsLocal]);

  const setGeneralNote = useCallback(async (id: string, note: string) => {
    setPersonsLocal(list => list.map(p => p.id === id ? { ...p, generalNote: note } : p));
    await setGeneralNotePerson(id, note);
  }, [setPersonsLocal]);

  // Attendance – direkt per ID (keine Name-Suche), schneller
  const toggleById = useCallback(async (personId: string, dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const wd = ((d.getDay() + 6) % 7) as 0|1|2|3|4|5|6;
    const dayKey = KEYS[wd];
    const next = await toggleAttendance(state.weekId, personId, dayKey);
    setState(s => ({ ...s, week: next }));
  }, [state.weekId]);

  const getById = useCallback((personId: string, dateStr: string): boolean | null => {
    const map = state.week?.attendanceByPersonId?.[personId] || {};
    const d = new Date(dateStr + "T00:00:00");
    const wd = ((d.getDay() + 6) % 7) as 0|1|2|3|4|5|6;
    const dayKey = KEYS[wd];
    const val = (map as any)[dayKey];
    return typeof val === "boolean" ? val : null;
  }, [state.week]);

  // Settings: optimistic + debounced persist
  const persistSettings = useCallback((next: Settings) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void saveSettings(next); }, 300);
  }, []);

  const setActiveDaysForWeek = useCallback((keys: string[]) => {
    const allowed = new Set(KEYS);
    const norm = Array.from(new Set(keys.filter(k => allowed.has(k as any)))) as DayKey[];
    if (!norm.length) return;
    const next = { ...state.settings, activeDays: norm };
    setState(s => ({ ...s, settings: next }));
    persistSettings(next);
  }, [state.settings, persistSettings]);

  const setSortOrder = useCallback((order: "vorname"|"nachname") => {
    const next = { ...state.settings, sortOrder: order };
    setState(st => ({ ...st, settings: next }));
    persistSettings(next);
  }, [state.settings, persistSettings]);

  const setShowInactive = useCallback((v: boolean) => {
    const next = { ...state.settings, showInactive: v };
    setState(st => ({ ...st, settings: next }));
    persistSettings(next);
  }, [state.settings, persistSettings]);

  const visiblePersons = useMemo(() => {
    const showInactive = state.settings.showInactive;
    const order = state.settings.sortOrder;
    const list = state.persons.filter(p => showInactive || !p.inactive);
    if (order === "vorname") return [...list].sort((a,b) => a.name.localeCompare(b.name, "de"));
    const ln = (n: string) => (n.trim().split(/\s+/).pop() || "").toLowerCase();
    return [...list].sort((a,b) => ln(a.name).localeCompare(ln(b.name), "de"));
  }, [state.persons, state.settings.showInactive, state.settings.sortOrder]);

  const activeDaysForWeek = useMemo(() => {
    const keysSet = new Set(state.settings.activeDays);
    const dates = state.dates;
    return dates.map((dateStr, idx) => ({
      idx,
      key: KEYS[idx],
      name: NAMES_DE[idx],
      dateStr,
      visible: keysSet.has(KEYS[idx]),
      disabled: false,
    }));
  }, [state.dates, state.settings.activeDays]);

  return {
    persons: visiblePersons,
    week: state.week,
    weekId: state.weekId,
    info: { year: Number(state.weekId.slice(0,4)), weekNumber: Number(state.weekId.slice(6)) },
    activeDaysForWeek,

    prevWeek, nextWeek,

    // Person Ops
    addNewPerson, rename, setInactive, setPaid, setGeneralNote,

    // Attendance per ID
    getAttendanceById: getById,
    toggleAttendanceById: toggleById,

    // Notes & inactive day
    getDayNote: (dateStr: string) => state.week?.dayNotes?.[dateStr] || "",
    setNote: (dateStr: string, text: string) => { void setDayNote(state.weekId, dateStr, text); },
    setInactiveForDate: (dateStr: string, inactive: boolean) => { void setInactiveDay(state.weekId, dateStr, inactive); },

    // Settings
    sortOrder: state.settings.sortOrder,
    setSortOrder,
    showInactive: state.settings.showInactive,
    setShowInactive,
    setActiveDaysForWeek,
  };
}
