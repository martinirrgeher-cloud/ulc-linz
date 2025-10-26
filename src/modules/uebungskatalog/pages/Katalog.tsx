import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Settings, ArrowLeft } from "lucide-react";
import { useUebungen } from "../hooks/useUebungen";
import { useUebungsGruppen } from "../hooks/useUebungsGruppen";
import { KategorieKachel } from "../components/KategorieKachel";
import UebungCard from "../components/UebungCard";
import "../styles/Uebungskatalog.css";

export default function Katalog() {
  const navigate = useNavigate();
  const { uebungen, loading, error } = useUebungen();
  const { gruppen } = useUebungsGruppen();

  const [selectedHaupt, setSelectedHaupt] = useState<string | null>(null);
  const [selectedUnter, setSelectedUnter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const gefiltert = useMemo(() => {
    let list = uebungen;
    if (selectedHaupt && !showDetails) {
      list = list.filter(u => u.hauptgruppe === selectedHaupt);
      if (selectedUnter) {
        list = list.filter(u => u.untergruppe === selectedUnter);
      }
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(s));
    }
    return list;
  }, [uebungen, selectedHaupt, selectedUnter, search, showDetails]);

  const hauptgruppen = useMemo(() => Object.keys(gruppen), [gruppen]);
  const untergruppen = useMemo(() => selectedHaupt ? gruppen[selectedHaupt] || [] : [], [gruppen, selectedHaupt]);

  if (loading) return <div className="uebungskatalog-loading">Lade Übungen...</div>;
  if (error) return <div className="uebungskatalog-error">Fehler: {error}</div>;

  const resetView = () => {
    setSelectedHaupt(null);
    setSelectedUnter(null);
  };

  const handleBack = () => {
    if (selectedUnter) setSelectedUnter(null);
    else if (selectedHaupt) setSelectedHaupt(null);
  };

  return (
    <div className="uebungskatalog-container">
      {/* Header */}
      <header className="uebungskatalog-header">
        <button className="icon-button" onClick={() => navigate("/dashboard")}>
          <Home size={22} />
        </button>
        <h1>Übungskatalog</h1>
        <button className="icon-button">
          <Settings size={22} />
        </button>
      </header>

      {/* Suchleiste */}
      <div className="uebungskatalog-toolbar">
        <input
          type="text"
          placeholder="Übung suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="toolbar-right">
          {(selectedHaupt || selectedUnter) && (
            <button className="icon-button" onClick={handleBack}>
              <ArrowLeft size={20} />
            </button>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => {
                setShowDetails(e.target.checked);
                resetView();
              }}
            />
            Details anzeigen
          </label>
        </div>
      </div>

      {/* Navigationsebene */}
      {!showDetails && !selectedHaupt && (
        <div className="uebungskatalog-grid">
          {hauptgruppen.map((g) => (
            <KategorieKachel key={g} title={g} onClick={() => setSelectedHaupt(g)} />
          ))}
        </div>
      )}

      {!showDetails && selectedHaupt && !selectedUnter && (
        <div className="uebungskatalog-grid">
          {untergruppen.map((g) => (
            <KategorieKachel key={g} title={g} onClick={() => setSelectedUnter(g)} />
          ))}
        </div>
      )}

      {/* Übungen */}
      {(showDetails || selectedUnter || (selectedHaupt && untergruppen.length === 0)) && (
        <div className="uebungskatalog-grid-uebungen">
          {gefiltert.map((u) => (
            <UebungCard
  key={u.id}
  uebung={u}
  onClick={(id) => console.log("Übung geklickt:", id)}
/>
          ))}
          {!gefiltert.length && <p>Keine Übungen gefunden.</p>}
        </div>
      )}
    </div>
  );
}
