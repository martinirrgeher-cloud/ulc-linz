import type { ReactNode } from "react";
import { EditorActionHeader } from "@/components/ui/EditorActionHeader";
import "@/styles/editor-shell.css";

type EditorShellProps = {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  canEdit: boolean;
  busy: boolean;
  canSave?: boolean;
  showHelp?: boolean;
  saveLabel?: string;
  closeLabel?: string;
  saveTestId?: string;
  closeTestId?: string;
  saveFormId?: string;
  className?: string;
  onSave?: () => void;
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
  showHelp = true,
  saveLabel = "Änderungen speichern",
  closeLabel = "Bearbeitung schließen",
  saveTestId,
  closeTestId,
  saveFormId,
  className,
  onSave,
  onClose,
  children,
}: EditorShellProps) {
  return (
    <section className={`editor-shell${className ? ` ${className}` : ""}`} aria-label={title}>
      <EditorActionHeader
        eyebrow={eyebrow}
        title={title}
        meta={meta}
        className="editor-shell-header"
        canEdit={canEdit}
        busy={busy}
        canSave={canSave}
        showHelp={showHelp}
        saveLabel={saveLabel}
        closeLabel={closeLabel}
        saveTestId={saveTestId}
        closeTestId={closeTestId}
        saveFormId={saveFormId}
        onSave={onSave}
        onClose={onClose}
      />
      <div className="editor-shell-body">{children}</div>
    </section>
  );
}
