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
  attendance: Record<string, boolean>;
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

  const { loading, personen, training, error } = useKindertraining(currentWeek);

  // 📅 aktive Trainingstage
  const activeDays = training?.__settings__?.activeDays || ["Dienstag"];
  const trainingDays = getDatesForWeekdays(activeDays, currentWeek);

  // 🧾 Speichern auf Drive
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

  // 🔄 Personenliste mergen
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

    (personen || []).forEach((p: any) => {
      const name = p?.name ?? String(p);
      if (!byName.has(name)) byName.set(name, { name, attendance: {} });
    });

    const arr = Array.from(byName.values());
    arr.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
    setDisplayPersons(arr);
  }, [personen, training, currentWeek]);

  // 📅 Attendance check
  const getAttendanceChecked = (personName: string, day: string) => {
    const entry = displayPersons.find((p) => p.name === personName);
    return entry?.attendance?.[day] ?? false;
  };

  // 📅 Attendance toggle (mit speichern)
  const toggleAttendance = (personName: string, day: string) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) => {
        if (p.name === personName) {
          const att = { ...p.attendance };
          att[day] = !att[day];
          return { ...p, attendance: att };
        }
        return p;
      });
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  // 🔍 Filter
  const filteredPersons = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return displayPersons;
    return displayPersons.filter((p) => p.name.toLowerCase().includes(q));
  }, [displayPersons, searchTerm]);

  // 📅 Wochenwechsel
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

  // ➕ Neue Person
  const handleAddPerson = () => {
    if (newName.trim()) {
      const name = newName.trim();
      setDisplayPersons((prev) => {
        const updated = [
          ...prev,
          { name, attendance: {}, note: "", notPaid: false, inactive: false },
        ];
        saveTrainingToDrive(updated);
        return updated;
      });
      setNewName("");
    }
  };

  // ✏️ Notiz setzen
  const setGeneralNote = (personName: string, note: string) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) =>
        p.name === personName ? { ...p, note } : p
      );
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  // 💰 Nicht bezahlt setzen
  const setPaid = (personName: string, notPaid: boolean) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) =>
        p.name === personName ? { ...p, notPaid } : p
      );
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  // 🚫 Inaktiv setzen
  const setInactive = (personName: string, inactive: boolean) => {
    setDisplayPersons((prev) => {
      const updated = prev.map((p) =>
        p.name === personName ? { ...p, inactive } : p
      );
      saveTrainingToDrive(updated);
      return updated;
    });
  };

  // 📅 Inaktive Trainingstage & Notizen
  const inactiveDays = training?.weekMeta?.[currentWeek]?.inactiveDays ?? {};
  const dayNotes = training?.weekMeta?.[currentWeek]?.dayNotes ?? {};

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
      {error && <div style={{ color: "red" }}>{error}</div>}

      <PersonList
        persons={filteredPersons}
        days={trainingDays}
        inactiveDays={inactiveDays}
        dayNotes={dayNotes}
        toggleAttendance={toggleAttendance}   // ✅ aktiv
        openPerson={openPerson}
        setOpenPerson={setOpenPerson}
        deletePerson={() => {}}
        renamePerson={() => {}}
        setPaid={setPaid}
        setInactive={setInactive}
        setDayInactive={() => {}}
        setDayNote={() => {}}
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
