import { ListFilter, RefreshCw, Search, X } from "lucide-react";
import type { ReactNode } from "react";

type ManagementFilterPanelProps = {
  searchLabel: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  open: boolean;
  activeCount: number;
  onToggle: () => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
  onReset: () => void;
  children: ReactNode;
};

export function ManagementFilterPanel({
  searchLabel,
  searchTerm,
  onSearchChange,
  open,
  activeCount,
  onToggle,
  onRefresh,
  refreshDisabled,
  onReset,
  children,
}: ManagementFilterPanelProps) {
  return (
    <div className="masterdata-filter-shell">
      <div className="masterdata-filter-toolbar">
        <label className="ui-search-field masterdata-search-field">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
          />
        </label>
        <button
          type="button"
          className="icon-button masterdata-refresh-button"
          onClick={onRefresh}
          disabled={refreshDisabled}
          aria-label="Stammdaten neu laden"
          title="Daten neu laden"
        >
          <RefreshCw aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button icon-button--toggle masterdata-filter-toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "Filtermenü schließen" : "Filtermenü öffnen"}
          title={open ? "Filtermenü schließen" : "Filtermenü öffnen"}
        >
          <ListFilter aria-hidden="true" />
          {activeCount > 0 && <span>{activeCount}</span>}
        </button>
      </div>

      {open && (
        <section className="masterdata-filter-panel" aria-label="Stammdaten filtern">
          <div className="masterdata-filter-panel-content">{children}</div>
          {activeCount > 0 && (
            <button type="button" className="text-button masterdata-filter-reset" onClick={onReset}>
              <X aria-hidden="true" /> Filter zurücksetzen
            </button>
          )}
        </section>
      )}
    </div>
  );
}
