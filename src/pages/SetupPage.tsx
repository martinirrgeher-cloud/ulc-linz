import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function SetupPage() {
  const {
    appContext,
    needsBootstrap,
    isInitialized,
    bootstrapOrganization,
    signOut,
  } = useAuth();
  const [organizationName, setOrganizationName] = useState("ULC Linz");
  const [slug, setSlug] = useState("ulc-linz");
  const [displayName, setDisplayName] = useState(
    appContext?.profile?.displayName ?? "",
  );
  const [slugManuallyChanged, setSlugManuallyChanged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugManuallyChanged) setSlug(normalizeSlug(organizationName));
  }, [organizationName, slugManuallyChanged]);

  if (isInitialized && appContext?.membership) return <Navigate to="/" replace />;
  if (isInitialized === true && !needsBootstrap) return <Navigate to="/kein-zugriff" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await bootstrapOrganization(organizationName, slug, displayName);
    } catch (submitError) {
      setError(
        diagnosticErrorMessage(
          submitError,
          "Die Einrichtung konnte nicht abgeschlossen werden.",
          "organization.setup",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="setup-page">
      <section className="setup-card">
        <p className="eyebrow">Einmalige Systemeinrichtung</p>
        <h1>Vereinsumgebung anlegen</h1>
        <p>
          Das erste bestätigte Benutzerkonto wird zum Administrator. Dieser Vorgang ist nur
          möglich, solange noch kein Verein angelegt wurde.
        </p>

        {error && <div className="alert error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            Vereinsname
            <input
              type="text"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              required
              minLength={2}
            />
          </label>

          <label>
            Technische Kurzbezeichnung
            <input
              type="text"
              value={slug}
              onChange={(event) => {
                setSlugManuallyChanged(true);
                setSlug(normalizeSlug(event.target.value));
              }}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
            <small>Wird intern verwendet und später nicht laufend geändert.</small>
          </label>

          <label>
            Dein Anzeigename
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              minLength={2}
            />
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Einrichtung läuft …" : "Verein einrichten"}
          </button>
          <button type="button" className="text-button" onClick={() => void signOut()}>
            Abmelden
          </button>
        </form>
      </section>
    </main>
  );
}
