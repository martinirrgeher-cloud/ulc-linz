import { Component, type ErrorInfo, type ReactNode } from "react";
import { ClipboardCopy, Home, LogIn, RefreshCw, TriangleAlert } from "lucide-react";

import { copySupportInformation, reportTechnicalError } from "@/lib/diagnostics";
import { env } from "@/lib/env";
type Props = { children: ReactNode };
type State = { error: Error | null; reference: string | null; copied: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reference: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    const diagnostic = reportTechnicalError(error, "react.render");
    return { error, reference: diagnostic.reference, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportTechnicalError(error, "react.component", { componentStack: info.componentStack });
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

  private copyDiagnostics = async () => {
    try {
      await copySupportInformation();
      this.setState({ copied: true });
    } catch (error) {
      reportTechnicalError(error, "error_boundary.copy_diagnostics");
    }
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
          <small>Fehler-ID: {this.state.reference}</small>
          <small>App-Stand: {env.appBuildLabel}</small>
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
            <button type="button" className="secondary-button" onClick={() => void this.copyDiagnostics()}>
              <ClipboardCopy aria-hidden="true" />
              {this.state.copied ? "Diagnose kopiert" : "Diagnose kopieren"}
            </button>
          </div>
        </section>
      </main>
    );
  }
}
