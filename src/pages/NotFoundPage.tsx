import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="status-page">
      <section className="status-card">
        <h1>Seite nicht gefunden</h1>
        <p>Die angeforderte Seite existiert nicht.</p>
        <Link to="/" className="primary-button link-button">
          Zur Startseite
        </Link>
      </section>
    </main>
  );
}
