import {
  BarChart3,
  BookOpenText,
  CalendarCheck,
  ClipboardCheck,
  Dumbbell,
  ListChecks,
  Settings2,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavigationGuardController } from "@/components/layout/NavigationGuardContext";
import {
  MORE_NAVIGATION_KEYS,
  PRIMARY_NAVIGATION_KEYS,
  getNavigationGroup,
  getNavigationGroupForPath,
  type AppNavigationGroupKey,
} from "@/config/navigation";
import { useAuth } from "@/features/auth/AuthContext";

const primaryIcons: Record<AppNavigationGroupKey, ReactNode> = {
  registration: <CalendarCheck aria-hidden="true" />,
  planning: <ListChecks aria-hidden="true" />,
  documentation: <ClipboardCheck aria-hidden="true" />,
  exercises: <Dumbbell aria-hidden="true" />,
  masterData: <Settings2 aria-hidden="true" />,
  statistics: <BarChart3 aria-hidden="true" />,
  useful: <Timer aria-hidden="true" />,
};

type PanelKey = AppNavigationGroupKey | "more" | null;

function routeIsActive(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function BottomNavigation() {
  const { canViewModule } = useAuth();
  const { runGuard } = useNavigationGuardController();
  const navigate = useNavigate();
  const location = useLocation();
  const activeGroup = getNavigationGroupForPath(location.pathname);
  const [panel, setPanel] = useState<PanelKey>(null);

  const visibleGroups = useMemo(() => {
    return new Map(
      [...PRIMARY_NAVIGATION_KEYS, ...MORE_NAVIGATION_KEYS].map((key) => {
        const group = getNavigationGroup(key);
        return [key, group.entries.filter((entry) => canViewModule(entry.moduleKey))] as const;
      }),
    );
  }, [canViewModule]);

  const visiblePrimaryKeys = PRIMARY_NAVIGATION_KEYS.filter((key) => (visibleGroups.get(key)?.length ?? 0) > 0);

  useEffect(() => {
    setPanel(null);
  }, [location.pathname]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function goTo(route: string) {
    if (!(await runGuard())) return;
    setPanel(null);
    navigate(route);
  }

  async function openCentralHelp() {
    if (!(await runGuard())) return;
    const returnPath = `${location.pathname}${location.search}`;
    navigate(`/hilfe?from=${encodeURIComponent(returnPath)}`);
  }

  function togglePanel(key: PanelKey) {
    setPanel((current) => (current === key ? null : key));
  }

  const submenuGroup = panel && panel !== "more" ? getNavigationGroup(panel) : null;
  const submenuEntries = submenuGroup ? visibleGroups.get(submenuGroup.key) ?? [] : [];
  const moreIsActive = activeGroup ? MORE_NAVIGATION_KEYS.includes(activeGroup) : false;
  const morePanelOpen =
    panel === "more" ||
    (submenuGroup !== null && MORE_NAVIGATION_KEYS.includes(submenuGroup.key));

  return (
    <nav className="app-bottom-navigation" aria-label="Hauptnavigation">
      {submenuGroup && submenuEntries.length > 0 && (
        <div className="app-bottom-submenu" role="navigation" aria-label={`${submenuGroup.label} Untermenü`}>
          <div className="app-bottom-submenu-scroll">
            {submenuEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`app-bottom-submenu-link ${routeIsActive(location.pathname, entry.route) ? "active" : ""}`}
                onClick={() => void goTo(entry.route)}
                aria-current={routeIsActive(location.pathname, entry.route) ? "page" : undefined}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === "more" && (
        <div className="app-bottom-more-menu" role="menu" aria-label="Weitere Bereiche">
          {MORE_NAVIGATION_KEYS.map((key) => {
            const group = getNavigationGroup(key);
            const entries = visibleGroups.get(key) ?? [];
            if (entries.length === 0) return null;
            return (
              <button
                type="button"
                role="menuitem"
                className="app-bottom-more-item"
                key={key}
                onClick={() => setPanel(key)}
              >
                <span className="app-bottom-more-icon">{primaryIcons[key]}</span>
                <span>{group.label}</span>
                <small>{entries.length}</small>
              </button>
            );
          })}
          <button type="button" role="menuitem" className="app-bottom-more-item" onClick={() => void openCentralHelp()}>
            <span className="app-bottom-more-icon"><BookOpenText aria-hidden="true" /></span>
            <span>Hilfe</span>
          </button>
        </div>
      )}

      <div className="app-bottom-navigation-bar">
        {visiblePrimaryKeys.map((key) => {
          const group = getNavigationGroup(key);
          const active = activeGroup === key;
          const expanded = panel === key;
          return (
            <button
              key={key}
              type="button"
              className={`app-bottom-navigation-button ${active || expanded ? "active" : ""}`}
              onClick={() => togglePanel(key)}
              aria-expanded={expanded}
              aria-label={group.label}
            >
              {primaryIcons[key]}
              <span>{group.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={`app-bottom-navigation-button ${moreIsActive || morePanelOpen ? "active" : ""}`}
          onClick={() => togglePanel("more")}
          aria-expanded={morePanelOpen}
          aria-label="Weitere Bereiche"
        >
          <span className="app-bottom-more-dots" aria-hidden="true">•••</span>
          <span>Mehr</span>
        </button>
      </div>
    </nav>
  );
}
