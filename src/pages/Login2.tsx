// src/pages/Login2.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "@/store/AuthContext";
import { isGoogleTokenValid, getValidAccessToken } from "@/lib/googleAuth";
import { useNavigate } from "react-router-dom";
import { syncTokenMirror } from "@/lib/drive/driveAuthBridge";
import "@/styles/login.css";

export default function Login2() {
  const nav = useNavigate();
  const { loginUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("Anmelden…");

  useEffect(() => {
    // Sicherstellen, dass ein gültiges Google-Token vorhanden ist
    if (!isGoogleTokenValid()) {
      setInfo("Kein Google-Login – zurück zu Schritt 1");
      nav("/login", { replace: true });
      return;
    }
    // Drive-Bridge synchronisieren (setzt globale Mirrors + Provider ist schon registriert)
    syncTokenMirror();
    setInfo("Bereit");
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("Prüfe Zugang …");
    try {
      // Erzwinge, dass der Token wirklich gelesen werden kann (Fail-fast)
      await getValidAccessToken();
      await loginUser(username.trim(), password, remember);
      nav("/", { replace: true });
    } catch (err:any) {
      setError(String(err?.message || err));
      setInfo("Fehler");
    }
  };

  return (
    <main className="login-container">
      <h1>Anmelden (Schritt 2: App-Zugang)</h1>
      <form onSubmit={onSubmit} className="login-form">
        <input
          className="login-input"
          placeholder="Benutzername"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="login-input"
          placeholder="Passwort"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Eingeloggt bleiben
        </label>
        <button className="login-btn primary" type="submit">Anmelden</button>
      </form>

      {error && <div className="login-error">Fehler: {error}</div>}
      <div className="login-status">Status: {info}</div>
    </main>
  );
}