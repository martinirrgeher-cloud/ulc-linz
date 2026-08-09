import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
export function ResetPasswordPage() {
  const { updatePassword, isAuthenticated } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (submitError) {
      setError(
        diagnosticErrorMessage(
          submitError,
          "Das Passwort konnte nicht geändert werden.",
          "auth.password_update",
        ),
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
          <h1>Neues Passwort</h1>
          <p>Vergib ein neues persönliches Passwort.</p>
        </div>
        {!isAuthenticated && (
          <div className="alert error">
            Der Link ist ungültig oder abgelaufen. Fordere einen neuen Link an.
          </div>
        )}
        {error && <div className="alert error">{error}</div>}
        {success ? (
          <div className="alert success">Das Passwort wurde erfolgreich geändert.</div>
        ) : (
          <form onSubmit={handleSubmit} className="form-stack">
            <label className="ui-labeled-field">
              <span className="ui-field-label">Neues Passwort</span>
              <input className="ui-field-control"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={10}
                required
                disabled={!isAuthenticated}
              />
            </label>
            <label className="ui-labeled-field">
              <span className="ui-field-label">Passwort wiederholen</span>
              <input className="ui-field-control"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={10}
                required
                disabled={!isAuthenticated}
              />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !isAuthenticated}
            >
              {submitting ? "Wird gespeichert …" : "Passwort speichern"}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link to="/">Zur App</Link>
        </div>
      </section>
    </main>
  );
}
