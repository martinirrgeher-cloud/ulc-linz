import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { env } from "@/lib/env";
import { useAuth } from "@/features/auth/AuthContext";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isAuthenticated, configurationError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      const destination =
        typeof location.state === "object" &&
        location.state &&
        "from" in location.state &&
        typeof location.state.from === "string"
          ? location.state.from
          : "/";
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(
        diagnosticErrorMessage(submitError, "Anmeldung fehlgeschlagen.", "auth.login"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img src="/logo.png" alt="ULC Linz Oberbank" className="auth-logo" />
        <div className="auth-heading">
          <p className="eyebrow">Vereins-App</p>
          <h1>Anmelden</h1>
          <p>Mit deiner E-Mail-Adresse und deinem persönlichen Passwort.</p>
        </div>

        {configurationError && <div className="alert error">{configurationError}</div>}
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
              disabled={Boolean(configurationError)}
            />
          </label>

          <label className="ui-labeled-field">
            <span className="ui-field-label">Passwort</span>
            <span className="password-field ui-field-control-wrap">
              <input className="ui-field-control"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                disabled={Boolean(configurationError)}
              />
              <button
                type="button"
                className="icon-button icon-button--inline password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                title={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                disabled={Boolean(configurationError)}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </span>
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting || Boolean(configurationError)}
          >
            {submitting ? "Anmeldung läuft …" : "Anmelden"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/passwort-vergessen">Passwort vergessen?</Link>
          {env.allowSelfSignup && <Link to="/registrieren">Ersteinrichtung</Link>}
        </div>
      </section>
    </main>
  );
}
