// src/pages/Unauthorized.tsx
import { Link } from "react-router-dom";
import { ROUTES } from "../routes";

export default function Unauthorized() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Zugriff verweigert</h1>
        <p style={{ marginBottom: 16 }}>
          Du hast keine Berechtigung, dieses Modul zu öffnen.
        </p>
        <Link to={ROUTES.MENU} style={{ textDecoration: "underline" }}>
          Zurück zum Hauptmenü
        </Link>
      </div>
    </div>
  );
}
