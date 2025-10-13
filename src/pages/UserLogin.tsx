// src/pages/UserLogin.tsx
import { useState } from "react";
import { validateUser } from "../lib/users";
import { setCurrentUser } from "../lib/userSession";

type Props = {
  onLoginSuccess?: () => void;
};

export default function UserLogin({ onLoginSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await validateUser(username, password);
      if (!user) {
        setError("Benutzername oder Passwort ist falsch.");
      } else {
        setCurrentUser(user);
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err: any) {
      setError(err?.message ?? "Unbekannter Fehler beim Benutzer-Login.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
      <h2>🔓 Benutzer-Login</h2>
      <label>
        Benutzername
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Passwort
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Prüfe..." : "Module freischalten"}</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
