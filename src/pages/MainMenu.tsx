// src/pages/MainMenu.tsx
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { forceLogout } from "../lib/googleAuth";
import { getCurrentUser, getGrantedModules, clearCurrentUser } from "../lib/userSession";
import UserLogin from "./UserLogin";

const MODULES = [
  { key: "KINDERTRAINING", label: "🏃 Kindertraining", route: ROUTES.KINDERTRAINING },
  { key: "U12", label: "👶 U12", route: ROUTES.U12 },
  { key: "U14", label: "🏃‍♂️ U14", route: ROUTES.U14 },
  { key: "LEISTUNGSGRUPPE", label: "🏋️ Leistungsgruppe", route: ROUTES.LEISTUNGSGRUPPE },
  { key: "STATISTIK", label: "📊 Statistik", route: ROUTES.STATISTIK },
  { key: "EINSTELLUNGEN", label: "⚙️ Einstellungen", route: ROUTES.EINSTELLUNGEN },
];

export default function MainMenu() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const granted = getGrantedModules();

  function handleLogoutAll() {
    clearCurrentUser();
    forceLogout(); // löscht auch Google Token und leitet auf /login
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🏠 Hauptmenü</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => navigate(ROUTES.MENU)}>Neu laden</button>
          <button onClick={handleLogoutAll}>Logout</button>
        </div>
      </header>

      {!user && (
        <div style={{ marginTop: "1rem" }}>
          <p>✅ Google-Login erfolgreich. Melde dich jetzt zusätzlich mit Benutzername & Passwort an, um deine Module freizuschalten.</p>
          <UserLogin onLoginSuccess={() => navigate(ROUTES.MENU)} />
        </div>
      )}

      {user && (
        <>
          <section style={{ margin: "1rem 0" }}>
            <p>Angemeldet als <strong>{user.username}</strong> ({user.role})</p>
          </section>

          <nav style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "0.75rem" }}>
            {MODULES.filter(m => granted.includes(m.key)).map(m => (
              <Link key={m.key} to={m.route} style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 12, textDecoration: "none" }}>
                {m.label}
              </Link>
            ))}
          </nav>

          {granted.length === 0 && (
            <p style={{ marginTop: "1rem" }}>Du hast noch keine Module freigeschaltet. Bitte prüfe deine Benutzerrechte in der <code>users.json</code> auf Google Drive.</p>
          )}

          {user.role === "admin" && (
            <div style={{ marginTop: "1rem" }}>
              <Link to={ROUTES.ADMIN}>🛠️ Adminbereich</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
