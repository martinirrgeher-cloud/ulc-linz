import { useMemo, useState, useEffect } from "react";
import "./Kindertraining.css";
import "@/assets/styles/Header.css";
import PersonList from "./components/PersonList";
import KTHeader from "./components/KTHeader";
import SettingsOverlay from "./components/SettingsOverlay";
import { useKindertraining } from "./hooks/useKindertraining";
import { getDatesForWeekdays, getCurrentWeek } from "./lib/weekUtils";
import { overwriteJsonContent } from "@/lib/drive/DriveClient";

type WeekEntry = {
  name: string;
  attendance?: Record<string, boolean>;
  note?: string;
  notPaid?: boolean;
  inactive?: boolean;
};

export default function Kindertraining() {
  const [currentWeek, setCurrentWeek] = useState<string>(getCurrentWeek());
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [displayPersons, setDisplayPersons] = useState<WeekEntry[]>([]);

  const { training, loading } = useKindertraining();

  // Personenbasis der Woche
  const personen = training?.personsByWeek?.[currentWeek] ?? [];

  // aktive Trainingstage + Datumsberechnung
  const activeDays = training?.__settings__?.activeDays || ["Dienstag"];
  const trainingDays = getDatesForWeekdays(activeDays, currentWeek);

  // Speichern auf Drive
  async function saveTrainingToDrive(updatedPersons: WeekEntry[]) {
    try {
      if (!training) return;
      const fileId = import.meta.env.VITE_DRIVE_KINDERTRAINING_FILE_ID;
      if (!fileId) {
        console.error("❌ Keine File ID für training.json definiert!");
        return;
      }

      const updatedTraining = { ...training };
      updatedTraining.personsByWeek = { ...updatedTraining.personsByWeek };
      updatedTraining.personsByWeek[currentWeek] = updatedPersons;

      await overwriteJsonContent(fileId, updatedTraining);
      console.log("✅ Training erfolgreich gespeichert");
    } catch (err) {
      console.error("❌ Fehler beim Speichern:", err);
    }
  }

  // Personenliste mergen (Endlosschleife behoben)
  useEffect(() => {
    const byName = new Map<string, WeekEntry>();

    const weekEntries: WeekEntry[] = training?.personsByWeek?.[currentWeek] ?? [];
    weekEntries.forEach((e) =>
      byName.set(e.name, {
        name: e.name,
        attendance: e.attendance || {},
        note: e.note,
        notPaid: e.notPaid,
        inactive: e.inactive,
      })
    );

    // Basisliste aus der Woche ergänzen (neue Namen ohne Einträge)
    (personen || []).forEach((p: any) => {
      const name = p?.name ?? String(p);
      if (!byName.has(name)) byName.set(name, { name, attendance: {} });
    });

    const arr = Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "de", { sensitivity: "base" })
    );

    // nur aktualisieren, wenn es wirklich Änderungen gibt
    setDisplayPersons((prev) => {
      const prevString = JSON.stringify(prev);
      const nextString = JSON.stringify(arr);
      return prevString === nextString ? prev : arr;
    });
  }, [training, currentWeek]); // <<< KEIN 'personen' mehr – sonst Loop

  // Attendance helper
  const getAttendanceChecked = (personName: string, day: string) => {
    const entry = displayPersons.find((p) => p.name === personName);
    return entry?.attendance?.[day] ?? false;
  };

  const toggleAttendance = (personName: string, day: string) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) => {
        if (p.name === personName) {
          const att = { ...(p.attendance ?? {}) };
          att[day] = !att[day];
          return { ...p, attendance: att };
        }
        return p;
      });
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  // Filter
  const filteredPersons = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return displayPersons;
    return displayPersons.filter((p) => p.name.toLowerCase().includes(q));
  }, [displayPersons, searchTerm]);

  // Wochenwechsel
  function shiftWeek(direction: number) {
    const [yearStr, weekStr] = currentWeek.split("-KW");
    let year = parseInt(yearStr, 10);
    let week = parseInt(weekStr, 10);
    week += direction;
    if (week < 1) {
      year--;
      week = 52;
    }
    if (week > 52) {
      year++;
      week = 1;
    }
    setCurrentWeek(`${year}-KW${week.toString().padStart(2, "0")}`);
  }

  // Personen-CRUD und Flags
  const handleAddPerson = () => {
    if (!newName.trim()) return;
    const name = newName.trim();
    setDisplayPersons((prev) => {
      const updated = [...prev, { name, attendance: {}, note: "", notPaid: false, inactive: false }];
      saveTrainingToDrive(updated);
      return updated;
    });
    setNewName("");
  };

  const deletePerson = (personName: string) => {
    setDisplayPersons((prev) => {
      const updated = prev.filter((p) => p.name !== personName);
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  const renamePerson = (oldName: string, newName: string) => {
    if (!newName.trim()) return;
    setDisplayPersons((prev) => {
      const updated = prev.map((p) => (p.name === oldName ? { ...p, name: newName.trim() } : p));
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  const setGeneralNote = (personName: string, note: string) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) => (p.name === personName ? { ...p, note } : p));
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  const setPaid = (personName: string, notPaid: boolean) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) => (p.name === personName ? { ...p, notPaid } : p));
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  const setInactive = (personName: string, inactive: boolean) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) => (p.name === personName ? { ...p, inactive } : p));
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  // Wochenmeta (Tage deaktivieren / Notizen zu Tagen)
  const inactiveDays = training?.weekMeta?.[currentWeek]?.inactiveDays ?? {};
  const dayNotes = training?.weekMeta?.[currentWeek]?.dayNotes ?? {};

  const setDayInactive = (dayKey: string, inactive: boolean) => {
    // hier würdest du updateWeekMeta(...) aus deinem Hook verwenden,
    // ich lasse es unverändert, da du die Funktion bereits hast.
    console.warn("setDayInactive noch mit updateWeekMeta verknüpfen");
  };

  const setDayNote = (dayKey: string, note: string) => {
    console.warn("setDayNote noch mit updateWeekMeta verknüpfen");
  };

  return (
    <div className="kt-wrapper">
      <KTHeader
        week={currentWeek}
        nextWeek={() => shiftWeek(1)}
        prevWeek={() => shiftWeek(-1)}
        onOpenSettings={() => setShowSettings(true)}
        onBack={() => (window.location.href = "/dashboard")}
      />

      <div className="kt-topbar">
        <input
          type="text"
          placeholder="Name suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="kt-input"
        />
      </div>

      <div className="kt-addbar">
        <div className="kt-addbar-left">
          <input
            type="text"
            className="kt-input"
            placeholder="Neuen Namen eingeben..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === "Enter") handleAddPerson();
            }}
          />
        </div>
        <div className="kt-addbar-right">
          <button className="header-btn kt-action-btn" onClick={handleAddPerson}>
            ➕ Hinzufügen
          </button>
        </div>
      </div>

      {loading && <div>⏳ Lade…</div>}

      <PersonList
        persons={filteredPersons}
        days={trainingDays}
        inactiveDays={inactiveDays}
        dayNotes={dayNotes}
        toggleAttendance={toggleAttendance}
        openPerson={openPerson}
        setOpenPerson={setOpenPerson}
        deletePerson={deletePerson}
        renamePerson={renamePerson}
        setPaid={setPaid}
        setInactive={setInactive}
        setDayInactive={setDayInactive}
        setDayNote={setDayNote}
        getAttendanceChecked={getAttendanceChecked}
        setGeneralNote={setGeneralNote}
        settings={training?.__settings__}
      />

      {showSettings && (
        <SettingsOverlay
          settings={training?.__settings__}
          onClose={() => setShowSettings(false)}
          onSettingsChange={() => {}}
        />
      )}
    </div>
  );
}
