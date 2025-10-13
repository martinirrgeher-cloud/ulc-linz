// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { handleGoogleRedirectCallback } from "../lib/googleAuth";

export default function AuthCallback() {
  useEffect(() => {
    const ok = handleGoogleRedirectCallback();
    if (!ok) {
      console.error("❌ Kein Access Token empfangen");
      window.location.replace("/login");
    }
  }, []);

  return <div>🔄 Anmeldung wird verarbeitet...</div>;
}
