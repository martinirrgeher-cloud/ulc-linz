import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { MODULES, AppModule } from "@/modules/registry";
import { useAuth } from "@/store/AuthContext";
import logo from "@/assets/logo.png";

export default function Dashboard() {
  const nav = useNavigate();
  const { user } = useAuth();

  const visibleModules: AppModule[] = useMemo(() => {
    if (!user?.modules?.length) return MODULES;
    return MODULES.filter(m => user.modules.includes(m.key));
  }, [user]);

  const Logo = <img src={logo} alt="Logo" className="dashboard-logo" />;

  return (
    <AppShell title="Hauptmenü" showHome={false} showSettings leftSlot={Logo}>
      <div className="kachel-grid">
        {visibleModules.map(m => (
          <button
            key={m.key}
            className="kachel"
            onClick={() => nav(m.route)}
            aria-label={m.title}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {m.icon}
              <h3 className="kachel__title">{m.title}</h3>
            </div>
            {m.description && <p className="kachel__desc">{m.description}</p>}
          </button>
        ))}
      </div>
    </AppShell>
  );
}
