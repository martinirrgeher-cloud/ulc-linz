// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAccessToken, restoreAccessToken, signInWithGoogle } from "../lib/googleAuth";
import { getCurrentUser } from "../lib/userSession";
import { ROUTES } from "../routes";
import logo from "../assets/logo.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await restoreAccessToken();
      } catch {}
      const token = getAccessToken();
      const user = getCurrentUser();
      if (token && user) {
        const dest = (location.state as any)?.from?.pathname || ROUTES.MENU;
        navigate(dest, { replace: true });
      } else if (token && !user) {
        // 👇 Falls Token vorhanden aber noch kein interner Login → zu Login 2
        navigate(ROUTES.LOGIN_INTERNAL, { replace: true });
      } else {
        setChecking(false);
      }
    })();
  }, [navigate, location.state]);

  async function handleGoogleLogin() {
    setError("");
    try {
      await signInWithGoogle();
      // 👇 Hier liegt der Knackpunkt:
      // Nach erfolgreichem Google Login explizit weiterleiten zur Callback-Route
      window.location.href = ROUTES.AUTH_CALLBACK;
    } catch (err: any) {
      setError(err?.message || "Google-Anmeldung fehlgeschlagen.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ display: "grid", gap: "0.5rem", textAlign: "center" }}>
        <img src={logo} alt="ULC Linz" style={{ width: 240, margin: "0 auto 0.5rem" }} />
        <h1>🔐 Google Login (Stufe 1)</h1>
        {checking ? <p>⏳ Prüfe Anmeldung…</p> : <button onClick={handleGoogleLogin}>Mit Google anmelden</button>}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}
