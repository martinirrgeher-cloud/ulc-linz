import { Construction } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { getModuleDefinition } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthContext";

export function ModulePlaceholderPage() {
  const { moduleKey } = useParams();
  const module = getModuleDefinition(moduleKey);
  const { canViewModule, canEditModule } = useAuth();

  if (!module) return <Navigate to="/" replace />;
  if (!canViewModule(module.key)) return <Navigate to="/kein-zugriff" replace />;

  return (
    <section className="module-placeholder">
      <div className="placeholder-card">
        <Construction aria-hidden="true" />
        <p className="eyebrow">Architektur steht</p>
        <h1>{module.title}</h1>
        <p>
          Dieses Modul wird als Nächstes auf das neue Datenmodell migriert. Der Zugriff ist
          bereits über Supabase Auth und die Datenbankberechtigungen abgesichert.
        </p>
        <div className="permission-badge">
          Deine Berechtigung: {canEditModule(module.key) ? "Lesen und Bearbeiten" : "Nur Lesen"}
        </div>
      </div>
    </section>
  );
}
