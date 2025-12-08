import React, { useMemo, useState } from "react";
import "../styles/Trainingsplanung.css";
import type { BlockTemplate } from "../../trainingsbloecke/services/TrainingsbloeckeStore";

type BlockTemplatePickerProps = {
  open: boolean;
  onClose: () => void;
  templates: BlockTemplate[];
  loading: boolean;
  error: string | null;
  onSelectTemplate: (tpl: BlockTemplate) => void;
};

function BlockTemplatePicker({
  open,
  onClose,
  templates,
  loading,
  error,
  onSelectTemplate,
}: BlockTemplatePickerProps) {
  const hasTemplates = templates && templates.length > 0;

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (t.group) set.add(t.group);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [templates]);


  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) =>
      (a.title ?? "").localeCompare(b.title ?? "", "de-AT", {
        sensitivity: "base",
      })
    );
  }, [templates]);

  const visibleTemplates = useMemo(() => {
    if (!groupFilter) return sortedTemplates;
    const key = groupFilter;
    return sortedTemplates.filter((t) => (t.group || "Allgemein") === key);
  }, [sortedTemplates, groupFilter]);

  const [openTemplateIds, setOpenTemplateIds] = useState<
    Record<string, boolean>
  >({});

  const toggleTemplateOpen = (id: string) => {
    setOpenTemplateIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!open) return null;

  const handleBackdropClick: React.MouseEventHandler<HTMLDivElement> = (
    e
  ) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="tp-picker-overlay" onClick={handleBackdropClick}>
      <div className="tp-picker-dialog">
        <div className="tp-picker-header">
          <div className="tp-picker-title">Block aus Vorlage wählen</div>
          <button
            type="button"
            className="tp-btn tp-btn-sm"
            onClick={onClose}
          >
            Schließen
          </button>
        </div>
        <div className="tp-picker-body">
          {loading && (
            <div className="tp-picker-empty">
              Blockvorlagen werden geladen ...
            </div>
          )}
          {error && (
            <div className="tp-error" style={{ marginBottom: 8 }}>
              {error}
            </div>
          )}
          {!loading && !hasTemplates && !error && (
            <div className="tp-picker-empty">
              Es sind noch keine Blockvorlagen angelegt.
            </div>
          )}
          {!loading && hasTemplates && (
            <>
              {groups.length > 0 && (
                <div className="tp-picker-subtitle">
                  <span>Blocktypen:</span>{" "}
                  <button
                    type="button"
                    className={
                      "tp-picker-filter-btn" +
                      (!groupFilter ? " tp-picker-filter-btn--active" : "")
                    }
                    onClick={() => setGroupFilter(null)}
                  >
                    Alle
                  </button>
                  {groups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={
                        "tp-picker-filter-btn" +
                        (groupFilter === g
                          ? " tp-picker-filter-btn--active"
                          : "")
                      }
                      onClick={() => setGroupFilter(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
              <div className="tp-template-list">
                {visibleTemplates.map((tpl) => {
                  const isOpen = !!openTemplateIds[tpl.id];
                  const items = (tpl as any).items as any[] | undefined;

                  return (
                    <div
                      key={tpl.id}
                      className="tp-template-btn"
                      onClick={() => onSelectTemplate(tpl)}
                    >
                      <div className="tp-template-header">
                        <div>
                          <div className="tp-template-title">
                            {tpl.title}
                          </div>
                          <div className="tp-template-meta">
                            {tpl.group || "Allgemein"} ·{" "}
                            {tpl.items.length} Übungen
                            {typeof tpl.defaultDurationMin === "number" &&
                              ` · ~${tpl.defaultDurationMin} min`}
                          </div>
                          {tpl.description && (
                            <div className="tp-picker-note">
                              {tpl.description}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="tp-icon-button tp-template-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTemplateOpen(tpl.id);
                          }}
                          aria-label={
                            isOpen
                              ? "Übungen ausblenden"
                              : "Übungen anzeigen"
                          }
                        >
                          {isOpen ? "▴" : "▾"}
                        </button>
                      </div>

                      {isOpen && items && items.length > 0 && (
                        <div className="tp-template-details">
                          <ul className="tp-template-details-list">
                            {items.map((rawItem, index) => {
                              const item = rawItem as any;
                              const label =
                                item.name ??
                                item.exerciseName ??
                                item.exerciseId ??
                                `Übung ${index + 1}`;
                              return (
                                <li
                                  key={
                                    item.id ??
                                    item.exerciseId ??
                                    index
                                  }
                                >
                                  {label}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlockTemplatePicker;
