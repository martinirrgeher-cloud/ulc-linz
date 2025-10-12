// src/pages/MainMenu.tsx
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { getCurrentUser, logout } from "../lib/authStore";
import logo from "../assets/logo.png"; // Vereinslogo

function hasModule(modules: string[] | undefined, name: string) {
  return modules?.some((m) => m.toLowerCase() === name.toLowerCase()) ?? false;
}

export default function MainMenu() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  if (!user) return null;

  return (
    <div
      className="container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      {/* 🖼 Logo + Überschrift */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <img src={logo} alt="Vereinslogo" style={{ height: 80, objectFit: "contain" }} />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>🏠 Modulübersicht</h1>
      </div>

      {/* 👤 Userinfo + Logout */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 0",
        }}
      >
        <span>
          👤 {user.username} ({user.role})
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            color: "#444",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "0.9rem",
          }}
        >
          Logout
        </button>
      </div>

      {/* 📚 Modul-Links */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hasModule(user.modules, "KINDERTRAINING") && (
          <Link to={ROUTES.KINDERTRAINING}>🏃 Kindertraining</Link>
        )}
        {hasModule(user.modules, "U12") && <Link to={ROUTES.U12}>👶 U12</Link>}
        {hasModule(user.modules, "U14") && <Link to={ROUTES.U14}>🏃‍♂️ U14</Link>}
        {hasModule(user.modules, "LEISTUNGSGRUPPE") && (
          <Link to={ROUTES.LEISTUNGSGRUPPE}>🏋️ Leistungsgruppe</Link>
        )}
        {user.role === "admin" && <div>⚙️ Adminbereich</div>}
      </nav>
    </div>
  );
}
