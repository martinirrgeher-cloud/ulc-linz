import React, { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "info";
export type ToastMsg = { id: string; kind: ToastKind; text: string };

type ToastCtx = {
  toasts: ToastMsg[];
  add: (kind: ToastKind, text: string) => void;
  clear: () => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const add = useCallback((kind: ToastKind, text: string) => {
    const t = { id: Math.random().toString(36).slice(2), kind, text };
    setToasts(prev => [...prev, t]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id));
    }, 3500);
  }, []);
  const clear = useCallback(() => setToasts([]), []);
  return (
    <Ctx.Provider value={{ toasts, add, clear }}>
      {children}
      <div style={{ position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 2000 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: t.kind === "error" ? "#ffebee" : t.kind === "success" ? "#e8f5e9" : "#e3f2fd",
            color: "#111",
            boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            border: "1px solid rgba(0,0,0,0.08)",
            maxWidth: 420
          }}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
};
