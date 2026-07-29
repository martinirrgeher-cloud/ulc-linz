import { LogIn } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

export function NoAccessPage() {
  const navigate = useNavigate();
  const { signOut, contextError } = useAuth();
  const [busy, setBusy] = useState(false);

  async function returnToLogin() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } catch {
      // signOut bereinigt den lokalen Sitzungsstand auch dann, wenn Supabase
      // vorübergehend nicht erreichbar ist. Der Login bleibt daher erreichbar.
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <main className="status-page">
      <section className="status-card status-card-compact">
        <LogIn aria-hidden="true" />
        <h1>Kein Zugriff</h1>
        <p>
          {contextError ??
            "Mit diesem Konto ist derzeit kein Zugriff auf die Vereins-App möglich. Kehre zur Anmeldung zurück und melde dich mit einem berechtigten Konto an."}
        </p>
        <button
          type="button"
          className="primary-button status-login-button"
          onClick={() => void returnToLogin()}
          disabled={busy}
        >
          <LogIn aria-hidden="true" />
          {busy ? "Abmeldung läuft …" : "Zurück zum Login"}
        </button>
      </section>
    </main>
  );
}
