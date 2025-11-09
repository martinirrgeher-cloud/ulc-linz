import React, { useEffect, useState } from "react";

type Person = { id?: string; name: string; inactive?: boolean; paid?: boolean; generalNote?: string };

export default function NamePopup(props: {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (name: string) => void | Promise<void>;
  onSaveEdit?: (patch: { name: string; inactive?: boolean; paid?: boolean; generalNote?: string }) => void | Promise<void>;
  person?: Person;
}) {
  const { mode, isOpen, onClose, onCreate, onSaveEdit, person } = props;
  const [name, setName] = useState(person?.name || "");
  const [inactive, setInactive] = useState<boolean>(!!person?.inactive);
  const [paid, setPaid] = useState<boolean>(!!person?.paid);
  const [generalNote, setGeneralNote] = useState<string>(person?.generalNote || "");

  useEffect(() => {
    setName(person?.name || "");
    setInactive(!!person?.inactive);
    setPaid(!!person?.paid);
    setGeneralNote(person?.generalNote || "");
  }, [person, isOpen]);

  if (!isOpen) return null;

  const save = async () => {
    if (mode === "create" && onCreate) {
      await onCreate(name.trim());
      onClose();
      return;
    }
    if (mode === "edit" && onSaveEdit) {
      await onSaveEdit({ name: name.trim(), inactive, paid, generalNote });
      onClose();
    }
  };

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ fontWeight: 600 }}>{mode === "create" ? "Neuer Athlet" : "Athlet bearbeiten"}</div>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Schließen">×</button>
        </div>

        <div style={bodyStyle}>
          <label style={rowStyle}>
            <span style={labelStyle}>Name</span>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
          </label>

          {mode === "edit" && (
            <>
              <label style={rowStyle}>
                <span style={labelStyle}>Inaktiv</span>
                <input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} />
              </label>
              <label style={rowStyle}>
                <span style={labelStyle}>Bezahlt</span>
                <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} />
              </label>
              <label style={rowStyle}>
                <span style={labelStyle}>Notiz</span>
                <textarea style={textareaStyle} value={generalNote} onChange={e => setGeneralNote(e.target.value)} />
              </label>
            </>
          )}
        </div>

        <div style={footerStyle}>
          <button onClick={onClose}>Abbrechen</button>
          <button onClick={save}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// Inline styles
const backdropStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modalStyle: React.CSSProperties = { background: "#fff", borderRadius: 12, width: "min(520px, 92vw)", boxShadow: "0 16px 40px rgba(0,0,0,.16)" };
const headerStyle: React.CSSProperties = { padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const bodyStyle: React.CSSProperties = { padding: "8px 16px 4px", display: "flex", flexDirection: "column", gap: 10 };
const footerStyle: React.CSSProperties = { padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 };
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
const labelStyle: React.CSSProperties = { width: 120, fontSize: 14, color: "#334155" };
const inputStyle: React.CSSProperties = { flex: 1 };
const textareaStyle: React.CSSProperties = { flex: 1, minHeight: 80, fontFamily: "inherit", fontSize: 14 };
const closeBtnStyle: React.CSSProperties = { background: "transparent", border: "none", fontSize: 18, cursor: "pointer", lineHeight: 1 };
export {};
