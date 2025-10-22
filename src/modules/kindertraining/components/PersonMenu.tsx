import React, { useState } from "react";

interface Person {
  name: string;
  paid: boolean;
  inactive: boolean;
}

interface Props {
  person: Person;
  onClose: () => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onEditNote: (name: string, note: string) => void;
  onTogglePaid: (name: string) => void;
  onToggleInactive: (name: string) => void;
}

export default function PersonMenu({
  person,
  onClose,
  onRename,
  onDelete,
  onEditNote,
  onTogglePaid,
  onToggleInactive,
}: Props) {
  const [newName, setNewName] = useState(person.name);
  const [note, setNote] = useState("");

  return (
    <div className="personMenu">
      <div className="menuHeader">
        <strong>{person.name}</strong>
        <button className="closeBtn" onClick={onClose}>
          ✖
        </button>
      </div>

      <div className="menuItem">
        <label>
          <input
            type="checkbox"
            checked={person.paid}
            onChange={() => onTogglePaid(person.name)}
          />
          Beitrag bezahlt
        </label>
      </div>

      <div className="menuItem">
        <label>
          <input
            type="checkbox"
            checked={person.inactive}
            onChange={() => onToggleInactive(person.name)}
          />
          Inaktiv
        </label>
      </div>

      <div className="menuItem">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name ändern"
        />
        <button onClick={() => onRename(person.name, newName)}>Speichern</button>
      </div>

      <div className="menuItem">
        <textarea
          placeholder="Notiz…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button onClick={() => onEditNote(person.name, note)}>Notiz speichern</button>
      </div>

      <div className="menuItem danger">
        <button onClick={() => onDelete(person.name)}>❌ Person löschen</button>
      </div>
    </div>
  );
}
