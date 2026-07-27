import { Component, type ErrorInfo, type ReactNode } from "react";
import { Home, LogIn, RefreshCw, TriangleAlert } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null; reference: string | null };

function errorReference(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reference: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, reference: errorReference() };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unbehandelter App-Fehler", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.assign("/");
  };

  private goToLogin = () => {
    window.location.assign("/login");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert">
        <section className="app-error-card">
          <TriangleAlert aria-hidden="true" />
          <p className="eyebrow">Technischer Fehler</p>
          <h1>Diese Ansicht konnte nicht geladen werden.</h1>
          <p>
            Deine bereits am Server gespeicherten Daten bleiben erhalten. Lade die App neu. Falls
            der Fehler wiederkommt, melde die unten angeführte Referenz.
          </p>
          <small>Fehlerreferenz: {this.state.reference}</small>
          <div className="app-error-actions">
            <button type="button" className="primary-button" onClick={this.reload}>
              <RefreshCw aria-hidden="true" />Neu laden
            </button>
            <button type="button" className="secondary-button" onClick={this.goHome}>
              <Home aria-hidden="true" />Zur Übersicht
            </button>
            <button type="button" className="secondary-button" onClick={this.goToLogin}>
              <LogIn aria-hidden="true" />Zur Anmeldung
            </button>
          </div>
        </section>
      </main>
    );
  }
}
