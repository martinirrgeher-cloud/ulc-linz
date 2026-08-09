import { EditorActionHeader } from "@/components/ui/EditorActionHeader";

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
  return (
    <EditorActionHeader
      eyebrow={eyebrow}
      title={title}
      meta={description}
      className="management-editor-sticky-header"
      canEdit={canEdit}
      busy={busy}
      canSave={canSave}
      saveFormId={formId}
      saveTestId="editor-save"
      closeTestId="editor-close"
      onClose={onClose}
    />
  );
}
