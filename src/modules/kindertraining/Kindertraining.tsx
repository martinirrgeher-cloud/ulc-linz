import { useMemo, useState } from "react";
import "./Kindertraining.css";
import "@/assets/styles/Header.css";
import PersonList from "./components/PersonList";
import KTHeader from "./components/KTHeader";
import SettingsOverlay from "./components/SettingsOverlay";
import { useKindertraining } from "./hooks/useKindertraining";
import { getDatesForWeekdays, getCurrentWeek } from "./lib/weekUtils";

type WeekEntry = { name: string; attendance: Record<string, boolean> };

export default function Kindertraining() {
  const [currentWeek, setCurrentWeek] = useState<string>(getCurrentWeek());
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [openPerson, setOpenPerson] = useState<string | null>(null);

  const { loading, personen, training, error } = useKindertraining(currentWeek);

  const activeDays = training?.__settings__?.activeDays || ["Dienstag"];
  const trainingDays = getDatesForWeekdays(activeDays, currentWeek);

  // ---- Kernelement: Personen der Woche = globale Personen ∪ Wochen-Einträge
  const weekEntries: WeekEntry[] = training?.personsByWeek?.[currentWeek] ?? [];
  const allPersonsForWeek: WeekEntry[] = useMemo(() => {
    const byName = new Map<string, WeekEntry>();
    // zuerst evtl. vorhandene Wochen-Einträge
    weekEntries.forEach(e => byName.set(e.name, { name: e.name, attendance: e.attendance || {} }));
    // dann alle globalen Personen ergänzen (falls nicht vorhanden)
    (personen || []).forEach((p: any) => {
      const name = p?.name ?? String(p);
      if (!byName.has(name)) byName.set(name, { name, attendance: {} });
    });
    // optional sortieren (nach settings.sortOrder)
    const sortOrder = training?.__settings__?.sortOrder ?? "vorname";
    const arr = Array.from(byName.values());
    arr.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
    return arr;
  }, [weekEntries, personen, training]);

  const inactiveDays = training?.weekMeta?.[currentWeek]?.inactiveDays ?? {};
  const dayNotes = training?.weekMeta?.[currentWeek]?.dayNotes ?? {};

  const getAttendanceChecked = (personName: string, day: string) => {
    const entry = allPersonsForWeek.find(p => p.name === personName);
    return entry?.attendance?.[day] ?? false;
  };

  const filteredPersons = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allPersonsForWeek;
    return allPersonsForWeek.filter(p => p.name.toLowerCase().includes(q));
  }, [allPersonsForWeek, searchTerm]);

  function shiftWeek(direction: number) {
    const [yearStr, weekStr] = currentWeek.split("-KW");
    let year = parseInt(yearStr, 10);
    let week = parseInt(weekStr, 10);
    week += direction;
    if (week < 1) { year--; week = 52; }
    if (week > 52) { year++; week = 1; }
    setCurrentWeek(`${year}-KW${week.toString().padStart(2, "0")}`);
  }

  const handleAddPerson = () => {
    if (newName.trim()) {
      console.log("Neue Person hinzufügen (noch ohne Persistenz):", newName);
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
            onKeyUp={(e) => { if (e.key === "Enter") handleAddPerson(); }}
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
