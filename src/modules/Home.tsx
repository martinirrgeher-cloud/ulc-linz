import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="container" style={{ textAlign: "center", paddingTop: "3rem" }}>
      <h1>🏠 Hauptmenü</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "2rem" }}>
        <Link to="/training" className="ghost big">👶 Kindertraining</Link>
        <Link to="/leistungsgruppe" className="ghost big">🏋️ Leistungsgruppe</Link>
        <Link to="/u12" className="ghost big">👦 U12</Link>
        <Link to="/u14" className="ghost big">👧 U14</Link>
        <Link to="/uebungskatalog" className="ghost big">📚 Übungskatalog</Link>
      </div>
    </div>
  );
}
