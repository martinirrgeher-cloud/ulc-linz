import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
export function ForgotPasswordPage() {
  const { requestPasswordReset, configurationError } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await requestPasswordReset(email.trim());
      setMessage(
        "Sofern ein Konto zu dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen versendet.",
      );
    } catch (submitError) {
      setError(
        diagnosticErrorMessage(
          submitError,
          "Die Anfrage konnte nicht gesendet werden.",
          "auth.password_reset_request",
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
          <h1>Passwort zurücksetzen</h1>
          <p>Du erhältst einen sicheren Link per E-Mail.</p>
        </div>
        {configurationError && <div className="alert error">{configurationError}</div>}
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="ui-labeled-field">
            <span className="ui-field-label">E-Mail-Adresse</span>
            <input className="ui-field-control"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={submitting || Boolean(configurationError)}
          >
            {submitting ? "Wird gesendet …" : "Link anfordern"}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Zur Anmeldung</Link>
        </div>
      </section>
    </main>
  );
}
