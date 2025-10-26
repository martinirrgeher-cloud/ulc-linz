import styles from "../styles/Trainingsplan.module.css";
import { useState } from "react";
import UebungSelectorModal from "./UebungSelectorModal";

export default function TagesPlan({ tag, onChange }: any) {
  const [showModal, setShowModal] = useState(false);

  const addUebung = (uebung: any) => {
    const updated = { ...tag, uebungen: [...tag.uebungen, uebung] };
    onChange(updated);
    setShowModal(false);
  };

  return (
    <div className={styles.tag}>
      <div className={styles.tagHeader}>
        <h3>{tag.datum}</h3>
        <button onClick={() => setShowModal(true)}>+ Übung</button>
      </div>
      <ul className={styles.uebungList}>
        {tag.uebungen.map((u: any, idx: number) => (
          <li key={idx}>{u.titel}</li>
        ))}
      </ul>
      <textarea
        placeholder="Notizen"
        value={tag.notizen || ""}
        onChange={(e) => onChange({ ...tag, notizen: e.target.value })}
      />
      {showModal && <UebungSelectorModal onSelect={addUebung} onClose={() => setShowModal(false)} />}
    </div>
  );
}
