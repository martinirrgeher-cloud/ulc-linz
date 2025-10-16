// src/pages/UserLogin.tsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../routes";
import { getAccessToken } from "../lib/googleAuth";
import { validateUser } from "../lib/users";
import { setCurrentUser } from "../lib/userSession";
import logo from "../assets/logo.png";
import styles from "./UserLogin.module.css"; // 👈 eigene CSS-Datei

export default function UserLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Ohne Google-Token zurück zu Stufe 1
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await validateUser(username.trim(), password);
      if (!u) {
        setError("Benutzername oder Passwort ist falsch.");
        return;
      }
      setCurrentUser({
        username: u.username,
        role: u.role || "trainer",
        modules: Array.isArray(u.modules) ? u.modules : [],
      });
      const dest = (location.state as any)?.from?.pathname || ROUTES.MENU;
      navigate(dest, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Fehler bei der Anmeldung.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Logo */}
        <img src={logo} alt="Logo" className={styles.logo} />

        {/* Titel */}
        <h1 className={styles.title}>
          🔐 Interner Login
          <br />
          <span className={styles.subtitle}>(Stufe 2)</span>
        </h1>

        {/* Formular */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Benutzername"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={styles.input}
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />

         <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Anmeldung..." : "Module freischalten"}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
