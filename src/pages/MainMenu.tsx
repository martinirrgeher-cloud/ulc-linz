// src/pages/MainMenu.tsx
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { forceLogout } from "../lib/googleAuth";
import { getCurrentUser, clearCurrentUser, getGrantedModules } from "../lib/userSession";
import logo from "../assets/logo.png";
import styles from "./MainMenu.module.css";

const MODULES = [
  { key: "KINDERTRAINING", label: "🏃 Kindertraining", route: ROUTES.KINDERTRAINING },
  { key: "U12", label: "👶 U12", route: ROUTES.U12 },
  { key: "U14", label: "🏃‍♂️ U14", route: ROUTES.U14 },
  { key: "LEISTUNGSGRUPPE", label: "🏋️ Leistungsgruppe", route: ROUTES.LEISTUNGSGRUPPE },
  { key: "STATISTIK", label: "📊 Statistik", route: ROUTES.STATISTIK },
  { key: "EINSTELLUNGEN", label: "⚙️ Einstellungen", route: ROUTES.EINSTELLUNGEN },
  { key: "ADMIN", label: "🛡️ Admin", route: ROUTES.ADMIN },
];

export default function MainMenu() {
  const nav = useNavigate();
  const user = getCurrentUser();
  const granted = getGrantedModules();
  const isAdmin = user?.role === "admin";

  const visible = isAdmin
    ? MODULES
    : MODULES.filter((m) => granted.includes(m.key));

  function handleLogout() {
    clearCurrentUser();
    forceLogout();
    nav(ROUTES.LOGIN, { replace: true });
  }

  return (
    <div className={styles.container}>
      {/* 🧭 Header mit Logo und Userbox */}
      <header className={styles.header}>
        <img src={logo} alt="ULC Linz" className={styles.logo} />

        {user && (
          <div className={styles.userBox}>
            <span className={styles.username}>
              {user.username} ({user.role})
            </span>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Abmelden
            </button>
          </div>
        )}
      </header>

      {/* 🧭 Hauptbereich mit Modulen */}
      <main className={styles.main}>
  <h1 className={styles.title}>Module</h1>

  <div className={styles.moduleList}>
    {visible.map((m) => (
      <Link key={m.key} to={m.route} className={styles.moduleCard}>
        <div className={styles.moduleIcon}>{m.label.split(" ")[0]}</div>
        <div className={styles.moduleTitle}>{m.label.replace(/^[^\s]+\s*/, "")}</div>
      </Link>
    ))}
  </div>

  {!isAdmin && granted.length === 0 && (
    <p className={styles.warning}>
      Du hast noch keine Benutzerrechte in der <code>users.json</code>.
    </p>
  )}
</main>
    </div>
  );
}
