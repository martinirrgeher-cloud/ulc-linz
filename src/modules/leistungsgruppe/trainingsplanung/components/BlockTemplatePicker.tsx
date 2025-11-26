import React, { useMemo } from "react";
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
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [templates]);

  if (!open) return null;

  const handleOverlayClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    onClose();
  };

  const handleDialogClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="tp-picker-overlay" onClick={handleOverlayClick}>
      <div className="tp-picker-dialog" onClick={handleDialogClick}>
        <div className="tp-picker-header">
          <div className="tp-picker-title">Block aus Vorlage</div>
          <button
            type="button"
            className="tp-btn tp-btn-secondary"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="tp-picker-body">
          {loading && (
            <div className="tp-picker-empty">Blockvorlagen werden geladen ...</div>
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
              {groups.length > 1 && (
                <div className="tp-picker-subtitle">
                  {groups.join(" · ")}
                </div>
              )}
              <div className="tp-template-list">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="tp-template-btn"
                    onClick={() => onSelectTemplate(tpl)}
                  >
                    <div className="tp-template-title">{tpl.title}</div>
                    <div className="tp-template-meta">
                      {tpl.group || "Allgemein"} · {tpl.items.length} Übungen
                      {typeof tpl.defaultDurationMin === "number" &&
                        ` · ~${tpl.defaultDurationMin} min`}
                    </div>
                    {tpl.description && (
                      <div className="tp-picker-note">{tpl.description}</div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlockTemplatePicker;
