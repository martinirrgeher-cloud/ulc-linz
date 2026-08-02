import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { env } from "@/lib/env";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
export function RegisterPage() {
  const { signUp, isAuthenticated, configurationError } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!env.allowSelfSignup) return <Navigate to="/login" replace />;
  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signUp(email.trim(), password, displayName);
      setSuccess(true);
    } catch (submitError) {
      setError(
        diagnosticErrorMessage(submitError, "Registrierung fehlgeschlagen.", "auth.register"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img src="/logo.png" alt="ULC Linz" className="auth-logo" />
        <div className="auth-heading">
          <p className="eyebrow">Einmalige Ersteinrichtung</p>
          <h1>Administratorkonto erstellen</h1>
          <p>
            Diese Registrierung wird nach der Einrichtung deaktiviert. Weitere Benutzer
            werden später über die Benutzerverwaltung eingeladen.
          </p>
        </div>

        {configurationError && <div className="alert error">{configurationError}</div>}
        {error && <div className="alert error">{error}</div>}
        {success ? (
          <div className="alert success">
            Konto erstellt. Prüfe deine E-Mails und bestätige die Adresse. Danach kannst du
            dich anmelden.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-stack">
            <label>
              Anzeigename
              <input
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
            <label>
              E-Mail-Adresse
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Passwort
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={10}
                required
              />
              <small>Mindestens 10 Zeichen.</small>
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || Boolean(configurationError)}
            >
              {submitting ? "Konto wird erstellt …" : "Konto erstellen"}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link to="/login">Zur Anmeldung</Link>
        </div>
      </section>
    </main>
  );
}
