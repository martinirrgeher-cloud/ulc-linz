import React, { useState } from "react";
import { useAuth } from "@/store/AuthContext";
import "@/styles/login.css";
import logo from "@/assets/logo.png";

export default function Login2() {
  const { loginUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const success = await loginUser(username, password);
    if (!success) {
      setError("Benutzername oder Passwort falsch");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logo} alt="Logo" className="login-logo" />
        <h1 className="login-title">Login</h1>

        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <input
            className="login-input"
            placeholder="Benutzername"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Anmeldung läuft..." : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}
