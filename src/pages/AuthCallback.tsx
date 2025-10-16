// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { restoreAccessToken } from "../lib/googleAuth";
import { ROUTES } from "../routes";

export default function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        await restoreAccessToken();
        navigate(ROUTES.LOGIN_INTERNAL, { replace: true });
      } catch (err) {
        console.error("Google Callback Fehler:", err);
        navigate(ROUTES.LOGIN, { replace: true });
      }
    })();
  }, [navigate]);
  return <p style={{ textAlign: "center", marginTop: "3rem" }}>🔄 Anmeldung läuft...</p>;
}
