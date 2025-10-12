// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { validateUser } from "../lib/users";
import { setCurrentUser } from "../lib/authStore";
import {
  hasAccessToken,
  signInWithGoogle,
  signInSilentWithGoogle,
} from "../lib/googleAuth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const ensureGoogleToken = async () => {
    if (hasAccessToken()) return;

    const silentToken = await signInSilentWithGoogle();
    if (silentToken) {
      console.log("✅ Silent Login erfolgreich");
      return;
    }

    console.log("🔐 Silent Login fehlgeschlagen – Popup Login…");
    await signInWithGoogle();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await ensureGoogleToken(); // Token sicherstellen
      const user = await validateUser(username, password);
      if (!user) {
        setError("❌ Benutzername oder Passwort ist ungültig");
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      navigate(ROUTES.MENU);
    } catch (err) {
      console.error("❌ Login Fehler:", err);
      setError("Fehler beim Login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 400, margin: "0 auto" }}>
      <h1>🔐 Login</h1>
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="text"
          placeholder="Benutzername (E-Mail)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div style={{ color: "red" }}>{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Anmelden..." : "Login"}
        </button>
      </form>
    </div>
  );
}
