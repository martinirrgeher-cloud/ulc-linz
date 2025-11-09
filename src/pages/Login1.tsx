// src/pages/Login1.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  isGoogleTokenValid,
  getAccessTokenSilent,
  getAccessTokenInteractive,
  getStoredToken,
  clearStoredToken,
} from "@/lib/googleAuth";
import { syncTokenMirror } from "@/lib/drive/driveAuthBridge";
import "@/styles/login.css";

export default function Login1() {
  const nav = useNavigate();
  const loc = useLocation();
  const [status, setStatus] = useState<string>("Bereit");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Wenn schon ein gültiges Token besteht, direkt weiter
    if (isGoogleTokenValid()) {
      syncTokenMirror();
      nav("/login2", { replace: true, state: loc.state });
    }
  }, []);

  // ensure Drive scope; if missing, force interactive consent
async function ensureDriveScope() {
  const t = getStoredToken();
  const scopeStr = Array.isArray((t as any)?.scope) ? (t as any).scope.join(" ") : String((t as any)?.scope || "");
  const hasDrive = /\bhttps:\/\/www\.googleapis\.com\/auth\/drive(\.[a-z]+)?\b/.test(scopeStr);
  if (!hasDrive) {
    await getAccessTokenInteractive();
  }
}
const goNext = async () => {
    try {
      if (!isGoogleTokenValid()) {
        setStatus("Token erneuern …");
        await getAccessTokenSilent().catch(() => getAccessTokenInteractive());
      }
      syncTokenMirror();
      setStatus("Okay – weiter zu Schritt 2");
      nav("/login2", { replace: true, state: loc.state });
    } catch (e:any) {
      setError(String(e?.message || e));
      setStatus("Fehler");
    }
  };

  const onPopup = async () => {
    try {
      setError(""); setStatus("Google Login …");
      await getAccessTokenInteractive();
      syncTokenMirror();
      setStatus("Angemeldet – weiter zu Schritt 2");
      nav("/login2", { replace: true });
    } catch (e:any) {
      setError(String(e?.message || e));
      setStatus("Fehler");
    }
  };

  const onClear = () => { clearStoredToken(); setError(""); setStatus("Sitzung gelöscht."); };

  return (
    <main className="login-container">
      <h1>Anmelden (Schritt 1: Google)</h1>

      <button className="login-btn primary" onClick={onPopup}>Mit Google anmelden</button>
      <button className="login-btn primary" onClick={goNext}>Weiter zu Schritt 2</button>
      <button className="login-btn link" onClick={onClear}>Sitzung löschen</button>

      {error && <div className="login-error">Fehler: {error}</div>}
      <div className="login-status">Status: {status}</div>
    </main>
  );
}