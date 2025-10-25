import React, { useEffect, useState } from "react";
import { initGoogleAuth } from "@/lib/googleAuth";
import { useAuth } from "@/store/AuthContext";
import "@/styles/login.css";
import logo from "@/assets/logo.png";

export default function Login1() {
  const { loginGoogle } = useAuth();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initGoogleAuth()
      .then(() => setReady(true))
      .catch((err) => {
        console.error("Google Auth konnte nicht initialisiert werden:", err);
        setError("Fehler bei der Google-Initialisierung");
      });
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await loginGoogle();
    } catch (err) {
      console.error("Fehler beim Google Login:", err);
      setError("Fehler beim Google Login");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logo} alt="Logo" className="login-logo" />
        <h1 className="login-title">ULC Linz Login</h1>

        {!ready && !error && <p className="login-info">Lade Google Login ...</p>}
        {error && <p className="login-error">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={!ready || loading}
          className="login-button"
        >
          {loading ? "Anmeldung läuft..." : "Mit Google anmelden"}
        </button>
      </div>
    </div>
  );
}
