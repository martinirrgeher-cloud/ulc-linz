import { LockKeyhole, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";

export function NoAccessPage() {
  const { accessError, refreshContext, signOut } = useAuth();

  return (
    <main className="status-page">
      <section className="status-card">
        <LockKeyhole aria-hidden="true" />
        <h1>Noch kein Zugriff</h1>
        <p>
          {accessError ??
            "Dein Konto besitzt derzeit keine aktive Vereinszuordnung oder nicht die benötigte Berechtigung."}
        </p>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => void refreshContext()}>
            <RefreshCw aria-hidden="true" />
            Erneut prüfen
          </button>
          <button type="button" className="secondary-button" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
            Abmelden
          </button>
        </div>
      </section>
    </main>
  );
}
