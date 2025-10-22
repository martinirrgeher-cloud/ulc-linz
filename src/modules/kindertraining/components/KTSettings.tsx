

type SortOrder = "vorname" | "nachname";
const ALL_DAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"] as const;

interface Props {
  sortOrder: SortOrder;
  setSortOrder: (v: SortOrder) => void;
  trainingDays: string[];
  setTrainingDays: (days: string[]) => void;
  showInactive: boolean;
  setShowInactive: (v: boolean) => void;
  onClose: () => void;
}

export default function KTSettings({
  sortOrder, setSortOrder,
  trainingDays, setTrainingDays,
  showInactive, setShowInactive,
  onClose
}: Props) {
  const toggleDay = (d: string) => {
    setTrainingDays(trainingDays.includes(d) ? trainingDays.filter(x => x !== d) : [...trainingDays, d]);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Einstellungen</div>

        <div className="modal-section">
          <div className="modal-label">Sortierreihenfolge:</div>
          <div className="sort-row">
            <label><input type="radio" name="sort" checked={sortOrder === "vorname"} onChange={() => setSortOrder("vorname")} /> Vorname</label>
            <label><input type="radio" name="sort" checked={sortOrder === "nachname"} onChange={() => setSortOrder("nachname")} /> Nachname</label>
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-label">Wochentage (sichtbar):</div>
          <div className="day-checkbox-grid">
            {ALL_DAYS.map(d => (
              <label key={d} className="day-checkbox-item">
                <span className="day-label">{d.slice(0,2)}</span>
                <input type="checkbox" checked={trainingDays.includes(d)} onChange={() => toggleDay(d)} />
              </label>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <label className="toggle-line">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Inaktive Personen anzeigen
          </label>
        </div>

        <div className="modal-actions">
          <button className="primary-btn" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
