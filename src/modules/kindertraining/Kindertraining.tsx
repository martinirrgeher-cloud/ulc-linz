import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Kindertraining.css";
import "@/assets/styles/Header.css";
import PersonList from "./components/PersonList";
import KTHeader from "./components/KTHeader";
import SettingsOverlay from "./components/SettingsOverlay";
import { useKindertraining } from "./hooks/useKindertraining";
import { getDatesForWeekdays, getCurrentWeek } from "./lib/weekUtils";

export default function Kindertraining() {
  const [currentWeek, setCurrentWeek] = useState<string>(getCurrentWeek());
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [openPerson, setOpenPerson] = useState<string | null>(null);

  const { loading, personen, training, error } = useKindertraining(currentWeek);

  // 📅 Trainings-Tage basierend auf den aktiven Tagen aus __settings__
  const activeDays = training?.__settings__?.activeDays || ["Dienstag"];
  const trainingDays = getDatesForWeekdays(activeDays, currentWeek);

  // 📊 Trainingsdaten dieser Woche
  const trainingWeekData = training?.personsByWeek?.[currentWeek] ?? [];
  const inactiveDays = training?.weekMeta?.[currentWeek]?.inactiveDays ?? {};
  const dayNotes = training?.weekMeta?.[currentWeek]?.dayNotes ?? {};

  // ✅ Attendance prüfen
  const getAttendanceChecked = (personName: string, day: string) => {
    const entry = trainingWeekData.find((p: any) => p.name === personName);
    return entry?.attendance?.[day] ?? false;
  };

  // 🔍 Personen filtern
  const filteredPersons = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return trainingWeekData.filter((p: any) =>
      p.name.toLowerCase().includes(q)
    );
  }, [trainingWeekData, searchTerm]);

  // ⏪ Wochen wechseln
  function shiftWeek(direction: number) {
    const [yearStr, weekStr] = currentWeek.split("-KW");
    let year = parseInt(yearStr);
    let week = parseInt(weekStr);
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

  // ➕ Person hinzufügen (Platzhalter – speichern später wieder aktivieren)
  const handleAddPerson = () => {
    if (newName.trim()) {
      console.log("Neue Person hinzufügen:", newName);
      setNewName("");
    }
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
      {error && <div style={{ color: "red" }}>{error}</div>}

      <PersonList
        persons={filteredPersons}
        days={trainingDays}
        inactiveDays={inactiveDays}
        dayNotes={dayNotes}
        toggleAttendance={() => {}}
        openPerson={openPerson}
        setOpenPerson={setOpenPerson}
        deletePerson={() => {}}
        renamePerson={() => {}}
        setPaid={() => {}}
        setInactive={() => {}}
        setDayInactive={() => {}}
        setDayNote={() => {}}
        getAttendanceChecked={getAttendanceChecked}
        setGeneralNote={() => {}}
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
