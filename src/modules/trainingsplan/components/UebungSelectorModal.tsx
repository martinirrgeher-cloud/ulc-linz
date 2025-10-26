import styles from "../styles/Trainingsplan.module.css";

export default function UebungSelectorModal({ onSelect, onClose }: any) {
  const katalog = [
    { id: "ueb001", titel: "Hürdenlauf" },
    { id: "ueb002", titel: "Sprint" }
  ];

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <h3>Übung auswählen</h3>
        <ul>
          {katalog.map((u) => (
            <li key={u.id} onClick={() => onSelect(u)}>{u.titel}</li>
          ))}
        </ul>
        <button onClick={onClose}>Abbrechen</button>
      </div>
    </div>
  );
}
