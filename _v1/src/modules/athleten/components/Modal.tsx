import { ReactNode } from "react";
export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; }) {
  if (!open) return null;
  return (
    <div className="kt-modal-backdrop" onClick={onClose}>
      <div className="kt-modal" onClick={e => e.stopPropagation()}>
        {title && <div className="kt-modal-title">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}
