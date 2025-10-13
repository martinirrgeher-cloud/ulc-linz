// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAccessToken,
  restoreAccessToken,
  signInWithGoogle,
} from "../lib/googleAuth";
import { ROUTES } from "../routes";

export default function Login() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        restoreAccessToken();
        if (getAccessToken()) {
          navigate(ROUTES.MENU, { replace: true });
          return;
        }
      } catch (err: any) {
        console.warn("Silent Login fehlgeschlagen:", err?.message ?? err);
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  async function handleGoogleLogin() {
    setError("");
    try {
      await signInWithGoogle();
      navigate(ROUTES.MENU, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Google Login fehlgeschlagen.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ display: "grid", gap: "0.5rem", textAlign: "center" }}>
        <h1>🔐 Login</h1>
        {checking ? (
          <p>⏳ Prüfe Anmeldung…</p>
        ) : (
          <button onClick={handleGoogleLogin}>Mit Google anmelden</button>
        )}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}
