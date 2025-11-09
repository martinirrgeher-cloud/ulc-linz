import React from "react";
import { revokeAndClear as clearGoogleToken } from "@/lib/googleAuth";
import { useAuth } from "@/store/AuthContext";

export default function AppHeader() {
  const { user, logout } = useAuth();
  return (
    <header className="app-header">
      <a href="/" className="app-header__brand">ULC Linz</a>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {user && <span className="app-header__user">👤 {user.username || user.name}</span>}
        <button
          onClick={() => { clearGoogleToken(); logout(); }}
          className="border rounded px-2 py-1"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
