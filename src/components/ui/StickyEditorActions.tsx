import { CircleHelp, LoaderCircle, Save, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavigationGuardController } from "@/components/layout/NavigationGuardContext";
import { buildHelpHref } from "@/features/help/help-context";

type StickyEditorActionsProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  formId: string;
  busy: boolean;
  canEdit: boolean;
  canSave: boolean;
  onClose: () => void;
};

export function StickyEditorActions({
  eyebrow,
  title,
  description,
  formId,
  busy,
  canEdit,
  canSave,
  onClose,
}: StickyEditorActionsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { runGuard } = useNavigationGuardController();

  async function openHelp() {
    if (!(await runGuard())) return;
    navigate(buildHelpHref(`${location.pathname}${location.search}`));
  }

  return (
    <div className="management-editor-sticky-header">
      <div className="management-editor-sticky-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="management-editor-sticky-actions" aria-label="Bearbeitungsaktionen">
        <button
          type="button"
          className="icon-button"
          onClick={() => void openHelp()}
          aria-label="Hilfe für diese Seite"
          title="Hilfe für diese Seite"
        >
          <CircleHelp aria-hidden="true" />
        </button>
        <button
          type="submit"
          form={formId}
          className="icon-button editor-save-button"
          disabled={!canEdit || !canSave || busy}
          aria-label={busy ? "Änderungen werden gespeichert" : "Änderungen speichern"}
          data-testid="editor-save"
          title={
            busy
              ? "Speichert …"
              : !canEdit
                ? "Speichern ist erst nach erfolgreicher Bearbeitungsreservierung möglich"
                : "Speichern"
          }
        >
          {busy ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <Save aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Bearbeitung schließen"
          data-testid="editor-close"
          title="Bearbeitung schließen"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
