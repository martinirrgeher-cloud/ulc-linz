// src/pages/Dashboard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { clearStorage } from "@/lib/googleAuth";
import { useAuth } from "@/store/AuthContext";
import "../assets/styles/GlobalStyles.css";

export default function Dashboard() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const modules = user?.modules || [];

  // ➖ Kompletter Logout (Google & User)
  const handleLogoutGoogle = () => {
    logout();
    nav("/login1", { replace: true });
  };

  // 🔁 Nur Benutzer wechseln (Token bleibt erhalten)
  const handleLogoutUser = () => {
    nav("/login2", { replace: true });
  };

  // 🧭 Navigation zu Modulen
  const handleModuleClick = (moduleName: string) => {
    switch (moduleName) {
      case "KINDERTRAINING":
        nav("/kindertraining");
        break;
      case "LEISTUNGSGRUPPE":
        nav("/leistungsgruppe");
        break;
      case "STATISTIK":
        nav("/statistik");
        break;
      default:
        console.warn(`Unbekanntes Modul: ${moduleName}`);
    }
  };

  return (
    <div className="container">
      {/* 🧭 Kopfzeile */}
      <header className="header">
        <button onClick={handleLogoutUser} className="switchButton">
          Benutzer wechseln
        </button>

        <div className="userBox">
          <span className="username">{user?.username || "Unbekannt"}</span>
          <button onClick={handleLogoutGoogle} className="logoutButton">
            Logout
          </button>
        </div>
      </header>

      {/* 📌 Module */}
      <div className="moduleTitle">Freigeschaltete Module</div>

      {modules.length > 0 ? (
        <div className="moduleList">
          {modules.map((m: string) => (
            <div
              key={m}
              className="moduleCard"
              onClick={() => handleModuleClick(m)}
              style={{ cursor: "pointer" }}
            >
              <div className="moduleLabel">{m}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="noModules">
          Für diesen Benutzer sind keine Module freigeschaltet.
        </div>
      )}
    </div>
  );
}
