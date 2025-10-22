
import { useState } from "react";

type Props = { onAdd: (name: string) => void; };

export default function PersonAddBar({ onAdd }: Props) {
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const n = newName.trim();
    if (!n) return;
    onAdd(n);
    setNewName("");
  };

  return (
    <div className="add-bar">
      <input
        className="add-input"
        placeholder="Neuen Namen eingeben…"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyUp={(e) => { if (e.key === "Enter") handleAdd(); }}
      />
      <button className="add-button" onClick={handleAdd}>
        <span className="add-button-icon">➕</span> Hinzufügen
      </button>
    </div>
  );
}
