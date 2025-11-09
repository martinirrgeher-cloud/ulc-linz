import React, { useMemo, useState } from "react";
import "./Kindertraining.css";
import KTHeader from "./components/KTHeader";
import PersonList from "./components/PersonList";
import NamePopup from "./components/NamePopup";
import NotePopup from "./components/NotePopup";
import { useKindertraining } from "./hooks/useKindertraining";
import type { Person as PType } from "./lib/types";

export default function Kindertraining() {
  const {
    weekId, prevWeek, nextWeek, info,
    persons, activeDaysForWeek, setInactiveForDate,
    getAttendanceById, toggleAttendanceById,
    addNewPerson, rename, setInactive, setPaid, setGeneralNote,
    getDayNote, setNote,
    sortOrder, setSortOrder, showInactive, setShowInactive, setActiveDaysForWeek,
  } = useKindertraining() as any;

  const personsSafe: PType[] = Array.isArray(persons) ? (persons as PType[]) : [];
  const daysSafe: any[] = Array.isArray(activeDaysForWeek) ? activeDaysForWeek : [];

  const [search, setSearchLocal] = useState("");

  const personsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personsSafe;
    return personsSafe.filter(p => (p?.name || "").toLowerCase().includes(q));
  }, [personsSafe, search]);

  const visibleDays: string[] = useMemo(
    () => daysSafe.filter((d) => d && d.visible).map((d) => d.dateStr),
    [daysSafe]
  );

  const inactiveDays: Record<string, boolean> = useMemo(() => {
    const m: Record<string, boolean> = {};
    daysSafe.forEach((d) => { if (d?.disabled && d?.dateStr) m[d.dateStr] = true; });
    return m;
  }, [daysSafe]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<PType | null>(null);
  const [dayNoteDate, setDayNoteDate] = useState<string | null>(null);

  const handleNewAthlete = () => setCreateOpen(true);
  const handleClickName = (p: PType) => setEditPerson(p);

  const handleCreate = async (name: string) => {
    if (name?.trim()) await addNewPerson(name.trim());
  };

  const handleSaveEdit = async (patch: { name: string; inactive?: boolean; generalNote?: string; paid?: boolean }) => {
    if (!editPerson) return;
    const id = editPerson.id as string;
    const newName = (patch.name || "").trim();
    if (newName && newName !== editPerson.name) {
      await rename(id, newName);
    }
    if (typeof patch.inactive === "boolean") {
      await setInactive(id, patch.inactive);
    }
    if (typeof patch.paid === "boolean") {
      await setPaid(id, patch.paid);
    }
    if (typeof patch.generalNote === "string" && patch.generalNote !== (editPerson.generalNote || "")) {
      await setGeneralNote(id, patch.generalNote || "");
    }
    setEditPerson(null);
  };

  const maxLen = useMemo(() => Math.max(4, ...personsFiltered.map((p) => (p?.name || "").length)), [personsFiltered]);
  const nameColWidth = useMemo(() => Math.min(420, Math.max(180, maxLen * 8)), [maxLen]);

  const { headerYear, headerWeek } = useMemo(() => {
    let y = info?.year ?? new Date().getFullYear();
    let w = info?.weekNumber ?? 0;
    if (typeof weekId === "string") {
      const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
      if (m) { y = parseInt(m[1], 10); w = parseInt(m[2], 10); }
    }
    return { headerYear: y, headerWeek: w };
  }, [weekId, info?.year, info?.weekNumber]);

  const dayToggles = useMemo(() => daysSafe.map((d) => ({ key: d.key, name: d.name, visible: !!d.visible })), [daysSafe]);

  const onToggleDay = (key: string, next: boolean) => {
    const current = new Set<string>(dayToggles.filter(x => x.visible).map(x => x.key));
    if (next) current.add(key); else current.delete(key);
    setActiveDaysForWeek?.(Array.from(current));
  };

  return (
    <div className="kindertraining kt-shell compact-top">
      <div className="kt-card">
        <KTHeader
          year={headerYear}
          weekNumber={headerWeek}
          onPrevWeek={prevWeek}
          onNextWeek={nextWeek}
          dayToggles={dayToggles}
          onToggleDay={onToggleDay}
          sortOrder={sortOrder}
          onChangeSort={setSortOrder}
          showInactive={!!showInactive}
          onToggleShowInactive={(v) => setShowInactive?.(!!v)}
          search={search}
          onSearch={setSearchLocal} onAdd={handleNewAthlete}
        />

        <div className="kt-list">
          <PersonList sortOrder={sortOrder}
            persons={personsFiltered}
            visibleDays={visibleDays}
            getAttendanceById={getAttendanceById}
            toggleAttendanceById={toggleAttendanceById}
            onClickName={handleClickName}
            nameColWidth={nameColWidth}
            inactiveDays={inactiveDays}
            setInactiveForDate={(d, val) => setInactiveForDate?.(d, val)}
            onOpenDayNote={(d) => setDayNoteDate(d)}
          />
        </div>
      </div>

      <NamePopup
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <NamePopup
        mode="edit"
        isOpen={!!editPerson}
        onClose={() => setEditPerson(null)}
        person={editPerson || undefined}
        onSaveEdit={handleSaveEdit}
      />
      <NotePopup
        isOpen={!!dayNoteDate}
        onClose={() => setDayNoteDate(null)}
        initialText={dayNoteDate ? (getDayNote?.(dayNoteDate) || "") : ""}
        onSave={(txt) => { if (dayNoteDate) setNote?.(dayNoteDate, txt); }}
        title="Tagesnotiz"
      />
    </div>
  );
}
