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

  const {
    loading,
    persons,
    settings,
    weekMeta,
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
    updateSettings,
  } = useKindertraining(currentWeek);

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

  const trainingDays = getDatesForWeekdays(
    settings?.activeDays?.length ? settings.activeDays : ["Dienstag"],
    currentWeek
  );

  const filteredPersons = useMemo(() => {
  const q = searchTerm.toLowerCase();
  return persons?.filter((p) => p.name.toLowerCase().includes(q)) ?? [];
}, [persons, searchTerm]);

  const handleAddPerson = () => {
    if (newName.trim()) {
      addPerson(newName.trim());
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

      {/* Suche + Statistik */}
     
{/* Suche + Statistik */}
<div className="kt-topbar">
  <div className="kt-topbar-left">
    <input
      type="text"
      placeholder="Name suchen..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="kt-input"
    />
  </div>
 
</div>

{/* Person hinzufügen */}
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
        inactiveDays={weekMeta?.[currentWeek]?.inactiveDays ?? {}}
        dayNotes={weekMeta?.[currentWeek]?.dayNotes ?? {}}
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
        settings={settings}
      />

      {showSettings && (
        <SettingsOverlay
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={(s) => updateSettings(s)}
        />
      )}
    </div>
  );
}
