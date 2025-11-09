import React, { useEffect, useRef, useState } from "react";
import { Home, Settings, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export default function AppHeader({
  title,
  showHome = true,
  showSettings = false,
  onBack,
  rightSlot,
  leftSlot,
}: AppHeaderProps) {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
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
          <button className="btn--icon" aria-label="Home" onClick={() => nav("/")}>
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
            <button className="btn--icon" aria-label="Einstellungen" onClick={() => setMenuOpen((v) => !v)}>
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
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
