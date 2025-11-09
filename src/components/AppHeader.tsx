import React, { useEffect, useRef, useState } from "react";
import { Home, Settings, LogOut, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";
import { revokeAndClear as clearGoogleToken } from "@/lib/googleAuth";
import "./AppHeader.css";

export type AppHeaderProps = {
  title: string;
  showHome?: boolean;
  showSettings?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
};

type KindertrainingSettings = {
  module: "kindertraining";
  sortOrder: "vorname" | "nachname";
  setSortOrder: (v: "vorname" | "nachname") => void;
  showInactive: boolean;
  setShowInactive: (v: boolean) => void;
  getActiveDays: () => string[];
  setActiveDaysForWeek: (days: string[]) => void;
};

export default function AppHeader({
  title,
  showHome = true,
  showSettings = false,
  onBack,
  rightSlot,
  leftSlot,
}: AppHeaderProps) {
  const nav = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 🟢 Kindertraining Settings state
  const [ktSettings, setKtSettings] = useState<KindertrainingSettings | null>(null);
  const [ktDays, setKtDays] = useState<string[]>([]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // 🔸 Athleten-Steuerung bleibt wie bisher
  const isAthleten = location.pathname.startsWith("/athleten");
  const isKindertraining = location.pathname.startsWith("/kindertraining");

  const [athSort, setAthSort] = useState<string>(() => {
    try {
      return localStorage.getItem("ATHLETEN_SORT") || "nach";
    } catch {
      return "nach";
    }
  });
  const [athInactive, setAthInactive] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ATHLETEN_SHOWINACTIVE") === "1";
    } catch {
      return false;
    }
  });

  function setAthletenSort(mode: "vor" | "nach") {
    setAthSort(mode);
    try {
      localStorage.setItem("ATHLETEN_SORT", mode);
    } catch {}
    const mapped = mode === "nach" ? "NACHNAME" : "VORNAME";
    window.dispatchEvent(new CustomEvent("athleten:set-sort", { detail: mapped }));
  }

  function setAthletenShowInactive(val: boolean) {
    setAthInactive(val);
    try {
      localStorage.setItem("ATHLETEN_SHOWINACTIVE", val ? "1" : "0");
    } catch {}
    window.dispatchEvent(new CustomEvent("athleten:set-inactive", { detail: val }));
  }

  // 🔹 Kindertraining Settings vom Modul empfangen
  useEffect(() => {
    function onSettings(e: any) {
      const d = e.detail;
      if (d?.module === "kindertraining") {
        setKtSettings(d);
        setKtDays(d.getActiveDays ? d.getActiveDays() : []);
      }
    }
    function onClear() {
      setKtSettings(null);
      setKtDays([]);
    }
    window.addEventListener("appheader:settings", onSettings);
    window.addEventListener("appheader:settings:clear", onClear);
    return () => {
      window.removeEventListener("appheader:settings", onSettings);
      window.removeEventListener("appheader:settings:clear", onClear);
    };
  }, []);

  const handleToggleDay = (day: string) => {
    if (!ktSettings?.setActiveDaysForWeek) return;
    const next = ktDays.includes(day)
      ? ktDays.filter((d) => d !== day)
      : [...ktDays, day];
    setKtDays(next);
    ktSettings.setActiveDaysForWeek(next);
  };

  useEffect(() => {
    const mapped = athSort === "nach" ? "NACHNAME" : "VORNAME";
    window.dispatchEvent(new CustomEvent("athleten:set-sort", { detail: mapped }));
  }, []);

  function handleBenutzerWechseln() {
    logout();
    setMenuOpen(false);
    nav("/login2", { replace: true });
  }
  function handleAbmelden() {
    logout();
    clearGoogleToken();
    setMenuOpen(false);
    nav("/login1", { replace: true });
  }

  return (
    <header className="app-header" role="banner">
      <div className="app-header__left">
        {leftSlot ? (
          leftSlot
        ) : showHome ? (
          <button className="btn btn--icon" aria-label="Home" onClick={() => nav("/")}>
            <Home size={20} />
          </button>
        ) : (
          <span className="btn-placeholder" />
        )}
      </div>

      <div className="app-header__center" aria-live="polite">
        <h1 className="app-header__title">{title}</h1>
      </div>

      <div className="app-header__right">
        {user && <span className="app-header__user">👤 {user.username}</span>}
        {rightSlot}

        {showSettings && (
          <div className="settings-wrapper" ref={menuRef}>
            <button className="btn btn--icon" aria-label="Einstellungen" onClick={() => setMenuOpen((v) => !v)}>
              <Settings size={20} />
            </button>

            {menuOpen && (
              <div className="settings-menu">
                <div className="settings-menu__user">
                  Eingeloggt als <strong>{user?.username}</strong>
                </div>
                <hr />
                <button className="menu-btn" onClick={handleBenutzerWechseln}>
                  <User size={16} /> Benutzer wechseln
                </button>
                <button className="menu-btn logout" onClick={handleAbmelden}>
                  <LogOut size={16} /> Abmelden
                </button>

                {/* Athleten-Optionen */}
                {isAthleten && (
                  <>
                    <hr />
                    <div className="settings-menu__section">
                      <div className="settings-menu__label">Sortierreihenfolge</div>
                      <div className="sortButtonRow">
                        <button
                          className={`sortButton ${athSort === "nach" ? "activeSortButton" : ""}`}
                          onClick={() => setAthletenSort("nach")}
                        >
                          Nachname
                        </button>
                        <button
                          className={`sortButton ${athSort === "vor" ? "activeSortButton" : ""}`}
                          onClick={() => setAthletenSort("vor")}
                        >
                          Vorname
                        </button>
                      </div>
                      <label
                        className="settings-menu__checkbox"
                        style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}
                      >
                        <input
                          type="checkbox"
                          checked={athInactive}
                          onChange={(e) => setAthletenShowInactive(e.target.checked)}
                        />
                        Inaktive anzeigen
                      </label>
                    </div>
                  </>
                )}

                {/* Kindertraining-Optionen */}
                {isKindertraining && ktSettings && (
                  <>
                    <hr />
                    <div className="settings-menu__section">
                      <div className="settings-menu__label">Sortierreihenfolge</div>
                      <div className="sortButtonRow">
                        <button
                          className={`sortButton ${
                            ktSettings.sortOrder === "nachname" ? "activeSortButton" : ""
                          }`}
                          onClick={() => ktSettings.setSortOrder("nachname")}
                        >
                          Nachname
                        </button>
                        <button
                          className={`sortButton ${
                            ktSettings.sortOrder === "vorname" ? "activeSortButton" : ""
                          }`}
                          onClick={() => ktSettings.setSortOrder("vorname")}
                        >
                          Vorname
                        </button>
                      </div>
                      <label
                        className="settings-menu__checkbox"
                        style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}
                      >
                        <input
                          type="checkbox"
                          checked={!!ktSettings.showInactive}
                          onChange={(e) => ktSettings.setShowInactive(e.target.checked)}
                        />
                        Inaktive anzeigen
                      </label>

                      <div className="settings-menu__label" style={{ marginTop: 8 }}>
                        Trainingstage
                      </div>
                      <div className="sortButtonRow" style={{ flexWrap: "wrap" }}>
                        {["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map((d) => (
                          <button
                            key={d}
                            className={`sortButton ${ktDays.includes(d) ? "activeSortButton" : ""}`}
                            onClick={() => handleToggleDay(d)}
                          >
                            {d.slice(0, 2)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
