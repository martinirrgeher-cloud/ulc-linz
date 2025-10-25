import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Home } from "lucide-react";
import { useAthleten } from "@/modules/athleten/hooks/useAthleten";
import { useAnmeldung } from "./hooks/useAnmeldung";
import "./styles/Anmeldung.css"; // ⬅️ normaler CSS Import

export default function Anmeldung() {
  const navigate = useNavigate();
  const { athletes = [], loading: loadingAthleten, error: errorAthleten } = useAthleten();
  const {
    tage,
    kw,
    jahr,
    getStatus,
    setStatus,
    notizen,
    setNotiz,
    nextWeek,
    prevWeek,
  } = useAnmeldung();

  const [selectedAthletId, setSelectedAthletId] = useState("");
  const [activeNotizTag, setActiveNotizTag] = useState<string | null>(null);

  if (loadingAthleten) return <div>Lade Athleten...</div>;
  if (errorAthleten) return <div>Fehler beim Laden der Athleten: {errorAthleten}</div>;

  const selectedAthlet = athletes.find((a) => a.id === selectedAthletId);

  const cycleStatus = (current: "?" | "Ja" | "Nein" | null) => {
    if (current === "?") return "Ja";
    if (current === "Ja") return "Nein";
    return "?";
  };

  return (
    <div className="anmeldung-container">
      {/* Header */}
      <header className="anmeldung-header">
        <button className="icon-button" onClick={() => navigate("/dashboard")}>
          <Home size={22} />
        </button>
        <h1>Anmeldung</h1>
        <button className="icon-button" onClick={() => console.log("Einstellungen öffnen")}>
          <Settings size={22} />
        </button>
      </header>

      {/* Kalendernavigation */}
      <div className="kalender-nav">
        <button className="nav-button" onClick={prevWeek}>
          &lt;
        </button>
        <span>KW {kw} – {jahr}</span>
        <button className="nav-button" onClick={nextWeek}>
          &gt;
        </button>
      </div>

      {/* Dropdown Athleten */}
      <div className="athlet-dropdown">
        <label htmlFor="athlet">Athlet:</label>
        <select
          id="athlet"
          value={selectedAthletId}
          onChange={(e) => setSelectedAthletId(e.target.value)}
        >
          <option value="">Bitte auswählen</option>
          {(athletes ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tagesliste */}
      <div className="tage-liste">
        {tage.map((datum) => {
          const d = new Date(datum);
          const wochentag = d.toLocaleDateString("de-DE", { weekday: "long" });
          const status = selectedAthletId ? getStatus(selectedAthletId, datum) : "?";
          const notiz = selectedAthletId ? notizen[`${selectedAthletId}_${datum}`] || "" : "";

          return (
            <div key={datum} className="tag-row">
              <div className="tag-label">
                {wochentag} ({d.toLocaleDateString("de-DE")})
              </div>
              <div className="tag-actions">
                <button
                  className={`status-button ${
                    status === "Ja" ? "green" : status === "Nein" ? "red" : ""
                  }`}
                  disabled={!selectedAthlet}
                  onClick={() =>
                    selectedAthletId &&
                    setStatus(selectedAthletId, datum, cycleStatus(status) as any)
                  }
                >
                  {status === "Ja" ? "✅" : status === "Nein" ? "❌" : "?"}
                </button>

                <button
                  className={`notiz-button ${notiz ? "filled" : ""}`}
                  disabled={!selectedAthlet}
                  onClick={() => setActiveNotizTag(datum)}
                >
                  📝
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notiz-Modal */}
      {activeNotizTag && (
        <div className="notiz-modal">
          <div className="notiz-content">
            <textarea
              value={notizen[`${selectedAthletId}_${activeNotizTag}`] || ""}
              onChange={(e) => setNotiz(selectedAthletId, activeNotizTag, e.target.value)}
              placeholder="Notiz eingeben..."
            />
            <div className="modal-actions">
              <button onClick={() => setActiveNotizTag(null)}>Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
