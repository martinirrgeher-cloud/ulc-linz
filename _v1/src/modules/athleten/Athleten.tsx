// src/modules/athleten/Athleten.tsx
import { useAthleten } from "./hooks/useAthleten";
import AthleteList from "./components/AthleteList";
import "./Athleten.css";

export default function AthletenPage() {
  const {
    loading, error, athleten, add, update,
    sortMode, setSortMode,
    showInactive, setShowInactive,
  } = useAthleten();

  const createEmpty = () => ({
    id: crypto.randomUUID(),
    firstName: "",
    lastName: "",
    name: "",
    active: true,
    anmeldung: [],
    plaene: [],
    feedback: [],
  });

  return (
    <div className="kt-container">
      <div className="kt-toolbar kt-toolbar--compact">
        <div className="kt-filter">
          <label className="kt-field kt-field--sm">
            <span>Sortieren</span>
            <select
              className="kt-select-sm"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              aria-label="Sortierreihenfolge"
            >
              <option value="NACHNAME">Nachname</option>
              <option value="VORNAME">Vorname</option>
              <option value="JAHR_AUF">Jahrgang ↑</option>
              <option value="JAHR_AB">Jahrgang ↓</option>
            </select>
          </label>

          <label className={`kt-chip ${showInactive ? "is-active" : ""}`}>
            <input
              type="checkbox"
              checked={!!showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>Inaktive</span>
          </label>
        </div>
      </div>

      {loading && <div className="kt-info">Lade…</div>}
      {error && <div className="kt-error">Fehler: {error}</div>}
      {!loading && !error && (
        <AthleteList
          items={athleten}
          onAdd={add}
          onUpdate={update}
          createEmptyAthlete={createEmpty}
          sortMode={sortMode as any}
        />
      )}
    </div>
  );
}
