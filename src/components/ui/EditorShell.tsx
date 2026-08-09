import { LoaderCircle, Save, X } from "lucide-react";
import type { ReactNode } from "react";
import "@/styles/editor-shell.css";

type EditorShellProps = {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  canEdit: boolean;
  busy: boolean;
  canSave?: boolean;
  saveLabel?: string;
  closeLabel?: string;
  saveTestId?: string;
  className?: string;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
};

export function EditorShell({
  eyebrow,
  title,
  meta,
  canEdit,
  busy,
  canSave = true,
  saveLabel = "Änderungen speichern",
  closeLabel = "Bearbeitung schließen",
  saveTestId,
  className,
  onSave,
  onClose,
  children,
}: EditorShellProps) {
  return (
    <section className={`editor-shell${className ? ` ${className}` : ""}`} aria-label={title}>
      <header className="editor-shell-header">
        <div className="editor-shell-copy">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          {meta && <div className="editor-shell-meta">{meta}</div>}
        </div>
        <div className="editor-shell-actions" aria-label="Bearbeitungsaktionen">
          {canEdit && (
            <button
              type="button"
              className="icon-button editor-shell-save"
              onClick={onSave}
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
            title={closeLabel}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="editor-shell-body">{children}</div>
    </section>
  );
}
