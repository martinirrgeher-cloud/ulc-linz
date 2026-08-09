import { CircleHelp, LoaderCircle, Save, X } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavigationGuardController } from "@/components/layout/NavigationGuardContext";
import { buildHelpHref } from "@/features/help/help-context";
import "@/styles/editor-shell.css";

type EditorActionHeaderProps = {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  className?: string;
  canEdit: boolean;
  busy: boolean;
  canSave?: boolean;
  showHelp?: boolean;
  saveLabel?: string;
  closeLabel?: string;
  saveTestId?: string;
  closeTestId?: string;
  saveFormId?: string;
  onSave?: () => void;
  onClose: () => void;
};

export function EditorActionHeader({
  eyebrow,
  title,
  meta,
  className,
  canEdit,
  busy,
  canSave = true,
  showHelp = true,
  saveLabel = "Änderungen speichern",
  closeLabel = "Bearbeitung schließen",
  saveTestId,
  closeTestId,
  saveFormId,
  onSave,
  onClose,
}: EditorActionHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { runGuard } = useNavigationGuardController();

  async function openHelp() {
    if (!(await runGuard())) return;
    navigate(buildHelpHref(`${location.pathname}${location.search}`));
  }

  return (
    <header className={`editor-action-header${className ? ` ${className}` : ""}`}>
      <div className="editor-action-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {meta && <div className="editor-action-meta">{meta}</div>}
      </div>
      <div className="editor-action-actions" aria-label="Bearbeitungsaktionen">
        {showHelp && (
          <button
            type="button"
            className="icon-button"
            onClick={() => void openHelp()}
            aria-label="Hilfe für diese Seite"
            title="Hilfe für diese Seite"
          >
            <CircleHelp aria-hidden="true" />
          </button>
        )}
        {canEdit && (
          <button
            type={saveFormId ? "submit" : "button"}
            form={saveFormId}
            className="icon-button icon-button--save"
            onClick={saveFormId ? undefined : onSave}
            disabled={busy || !canSave}
            aria-label={busy ? "Änderungen werden gespeichert" : saveLabel}
            data-testid={saveTestId}
            title={busy ? "Speichert …" : saveLabel}
          >
            {busy ? <LoaderCircle className="spin-icon" aria-hidden="true" /> : <Save aria-hidden="true" />}
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label={closeLabel}
          data-testid={closeTestId}
          title={closeLabel}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
