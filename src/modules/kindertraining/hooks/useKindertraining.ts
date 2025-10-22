import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClient";
import { loadPersonen, savePersonen, type KTPerson } from "../lib/kindertrainingPersonenDrive";

export type AttendanceByDay = Record<string, boolean>;

export type PersonWeekRow = {
  name: string;
  attendance: AttendanceByDay;
};

export type KTSettings = {
  activeDays: string[];
  sortOrder?: "vorname" | "nachname";
  showInactive?: boolean;
};

type TrainingData = {
  personsByWeek: Record<string, PersonWeekRow[]>;
  __settings__?: KTSettings;
  weekMeta?: Record<
    string,
    {
      inactiveDays: Record<string, boolean>;
      dayNotes: Record<string, string>;
    }
  >;
};

import { requireEnv } from "@/lib/requireEnv";

const TRAINING_FILE_ID = requireEnv("VITE_DRIVE_KINDERTRAINING_FILE_ID");

function normalizeName(n: string): string {
  return (n || "").trim();
}

function findOrCreateWeekRow(week: string, name: string, td: TrainingData): PersonWeekRow {
  const n = normalizeName(name);
  td.personsByWeek[week] = td.personsByWeek[week] || [];
  const hit = td.personsByWeek[week].find(
    (p) => normalizeName(p.name).toLowerCase() === n.toLowerCase()
  );
  if (hit) return hit;
  const row: PersonWeekRow = { name: n, attendance: {} };
  td.personsByWeek[week].push(row);
  return row;
}

export function useKindertraining(currentWeek: string) {
  const [personen, setPersonen] = useState<KTPerson[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadedPersonen = useRef(false);
  const loadedTraining = useRef(false);

  // 🟡 Daten laden
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      try {
        const [p, tdRaw] = await Promise.all([
          loadPersonen(),
          downloadJson(TRAINING_FILE_ID).catch(() => ({})),
        ]);

        const td: TrainingData = {
          personsByWeek:
            tdRaw?.personsByWeek && typeof tdRaw.personsByWeek === "object"
              ? tdRaw.personsByWeek
              : {},
          __settings__: tdRaw?.__settings__ || {
            activeDays: ["Dienstag"],
            sortOrder: "vorname",
            showInactive: true,
          },
          weekMeta: tdRaw?.weekMeta || {},
        };

        if (!cancelled) {
          setPersonen(p);
          setTrainingData(td);
          loadedPersonen.current = true;
          loadedTraining.current = true;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveTraining = useCallback(
    async (next: TrainingData) => {
      if (!loadedTraining.current) return;
      await overwriteJsonContent(TRAINING_FILE_ID, next);
    },
    []
  );

  const savePersonenSafe = useCallback(
    async (next: KTPerson[]) => {
      if (!loadedPersonen.current) return;
      await savePersonen(next);
    },
    []
  );

  // 🟡 Anwesenheit toggeln
  const toggleAttendance = useCallback(
    (name: string, dayLabel: string) => {
      if (!trainingData) return;
      const next = structuredClone(trainingData) as TrainingData;
      const row = findOrCreateWeekRow(currentWeek, name, next);
      row.attendance[dayLabel] = !row.attendance[dayLabel];
      setTrainingData(next);
      saveTraining(next);
    },
    [trainingData, currentWeek, saveTraining]
  );

  // 🟡 Bezahlt / Inaktiv / Notiz
  const setPaid = useCallback(
    (name: string, paid: boolean) => {
      const n = normalizeName(name);
      const next = personen.map((p) =>
        normalizeName(p.name).toLowerCase() === n.toLowerCase() ? { ...p, paid } : p
      );
      setPersonen(next);
      savePersonenSafe(next);
    },
    [personen, savePersonenSafe]
  );

  const setInactive = useCallback(
    (name: string, inactive: boolean) => {
      const n = normalizeName(name);
      const next = personen.map((p) =>
        normalizeName(p.name).toLowerCase() === n.toLowerCase() ? { ...p, inactive } : p
      );
      setPersonen(next);
      savePersonenSafe(next);
    },
    [personen, savePersonenSafe]
  );

  const setGeneralNote = useCallback(
    (name: string, note: string) => {
      const n = normalizeName(name);
      const next = personen.map((p) =>
        normalizeName(p.name).toLowerCase() === n.toLowerCase()
          ? { ...p, generalNote: note }
          : p
      );
      setPersonen(next);
      savePersonenSafe(next);
    },
    [personen, savePersonenSafe]
  );

  const addPerson = useCallback(
    (newName: string) => {
      const n = normalizeName(newName);
      if (!n) return;
      if (personen.some((p) => normalizeName(p.name).toLowerCase() === n.toLowerCase()))
        return;
      const nextPersons: KTPerson[] = [
        ...personen,
        { name: n, paid: false, inactive: false, generalNote: "" },
      ];
      setPersonen(nextPersons);
      savePersonenSafe(nextPersons);
    },
    [personen, savePersonenSafe]
  );

  const renamePerson = useCallback(
    (oldName: string, newName: string) => {
      const o = normalizeName(oldName);
      const n = normalizeName(newName);
      if (!n) return;

      const nextPersons = personen.map((p) =>
        normalizeName(p.name).toLowerCase() === o.toLowerCase() ? { ...p, name: n } : p
      );
      setPersonen(nextPersons);
      savePersonenSafe(nextPersons);

      if (trainingData) {
        const nextTD = structuredClone(trainingData) as TrainingData;
        Object.keys(nextTD.personsByWeek || {}).forEach((week) => {
          nextTD.personsByWeek[week] = (nextTD.personsByWeek[week] || []).map((row) =>
            normalizeName(row.name).toLowerCase() === o.toLowerCase()
              ? { ...row, name: n }
              : row
          );
        });
        setTrainingData(nextTD);
        saveTraining(nextTD);
      }
    },
    [personen, trainingData, savePersonenSafe, saveTraining]
  );

  const deletePerson = useCallback(
    (name: string) => {
      const n = normalizeName(name);
      const next = personen.filter(
        (p) => normalizeName(p.name).toLowerCase() !== n.toLowerCase()
      );
      setPersonen(next);
      savePersonenSafe(next);
    },
    [personen, savePersonenSafe]
  );

  // 🟡 Settings sofort aktualisieren
  const updateSettings = useCallback((newSettings: KTSettings) => {
    setTrainingData((prev) => {
      if (!prev) return null;
      const next = { ...prev, __settings__: newSettings };
      return next;
    });
  }, []);

  // 🟡 Tagesinaktivität + Notiz
 
// 📌 Tag deaktivieren / reaktivieren


const setDayInactive = useCallback(
  (day: string, inactive: boolean) => {
    setTrainingData((prev) => {
      if (!prev) return prev;

      const next = { ...prev };
      const meta = next.weekMeta[currentWeek] ?? { inactiveDays: {}, dayNotes: {} };

      const newInactiveDays = { ...meta.inactiveDays, [day]: inactive };
      let newDayNotes = meta.dayNotes;

      if (!inactive && meta.dayNotes?.[day]) {
        const { [day]: _remove, ...rest } = meta.dayNotes;
        newDayNotes = rest;
      }

      next.weekMeta = {
        ...next.weekMeta,
        [currentWeek]: {
          ...meta,
          inactiveDays: newInactiveDays,
          dayNotes: newDayNotes,
        },
      };

      return next;
    });
  },
  [currentWeek, setTrainingData]
);

const setDayNote = useCallback(
  (day: string, note: string) => {
    setTrainingData((prev) => {
      if (!prev) return prev;

      const next = { ...prev };
      const meta = next.weekMeta[currentWeek] ?? { inactiveDays: {}, dayNotes: {} };

      next.weekMeta = {
        ...next.weekMeta,
        [currentWeek]: {
          ...meta,
          dayNotes: {
            ...meta.dayNotes,
            [day]: note,
          },
          inactiveDays: meta.inactiveDays,
        },
      };

      return next;
    });
  },
  [currentWeek, setTrainingData]
);






  const getAttendanceChecked = useCallback(
    (name: string, dayLabel: string): boolean => {
      const n = normalizeName(name);
      const weekRows = trainingData?.personsByWeek?.[currentWeek] || [];
      const row = weekRows.find(
        (r) => normalizeName(r.name).toLowerCase() === n.toLowerCase()
      );
      return !!row?.attendance?.[dayLabel];
    },
    [trainingData, currentWeek]
  );

  // 🟡 Sortierung
  const sortedPersons = useMemo(() => {
    const sortOrder = trainingData?.__settings__?.sortOrder ?? "vorname";
    const showInactive = trainingData?.__settings__?.showInactive ?? false;

    const active = personen.filter((p) => !p.inactive);
    const inactive = personen.filter((p) => p.inactive);

    const sorter = (a: KTPerson, b: KTPerson) => {
      const [aFirst, aLast] = a.name.split(" ");
      const [bFirst, bLast] = b.name.split(" ");
      const priA = (sortOrder === "vorname" ? (aFirst || a.name) : (aLast || aFirst || a.name)).toLowerCase();
      const priB = (sortOrder === "vorname" ? (bFirst || b.name) : (bLast || bFirst || b.name)).toLowerCase();
      if (priA !== priB) return priA.localeCompare(priB);
      // Sekundär nach Vorname
      const secA = (aFirst || a.name).toLowerCase();
      const secB = (bFirst || b.name).toLowerCase();
      return secA.localeCompare(secB);
    };

    active.sort(sorter);
    inactive.sort(sorter);

    // Wenn showInactive = false → nur aktive zurückgeben
    return showInactive ? [...active, ...inactive] : active;
  }, [personen, trainingData]);

  return {
    loading,
    persons: sortedPersons,
    settings: trainingData?.__settings__,
    weekMeta: trainingData?.weekMeta,
    toggleAttendance,
    setPaid,
    setInactive,
    setGeneralNote,
    addPerson,
    renamePerson,
    deletePerson,
    setDayInactive,
    setDayNote,
    getAttendanceChecked,
    updateSettings, // ⬅️ neu
  };
}
