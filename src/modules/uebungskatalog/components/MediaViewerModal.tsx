// components/MediaViewerModal.tsx
import React, { useEffect, useState } from "react";
import { buildMediaUrl, toPreviewIframeUrl } from "../services/mediaUrl";

type Props = {
  open: boolean;
  onClose: () => void;
  name?: string;
  url?: string;
  type?: "image" | "video";
};

export const MediaViewerModal: React.FC<Props> = ({ open, onClose, name, url, type }) => {
  const [state, setState] = useState<{ mode: "loading" | "blob" | "iframe" | "error"; src?: string; msg?: string; hint?: string; diag?: any }>({
    mode: "loading",
  });

  useEffect(() => {
    let revoked: string | null = null;
    if (!open) return;
    setState({ mode: "loading" });
    (async () => {
      const r = await buildMediaUrl(url || "");
      if (r.kind === "blob") {
        setState({ mode: "blob", src: r.url });
        revoked = r.url;
      } else if (r.kind === "iframe") {
        setState({ mode: "iframe", src: r.url });
      } else {
        setState({ mode: "error", msg: r.message, hint: r.hint, diag: r.diag });
        console.warn("Media preview error:", r);
      }
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [open, url]);

  if (!open) return null;
  return (
    <div className="ex-modal" onClick={onClose}>
      <div className="ex-modal-content" onClick={(e)=>e.stopPropagation()}>
        <button className="ex-modal-close" onClick={onClose} aria-label="Schließen">×</button>
        <div className="ex-modal-caption">{name || "Medienvorschau"}</div>

        {state.mode === "loading" && <div className="ex-info">Lade Medien…</div>}
        {state.mode === "error" && (
          <div className="ex-error">
            {state.msg}
            {state.hint ? <div className="ex-muted" style={{marginTop:8}}>{state.hint}</div> : null}
            {state.diag?.tokeninfo ? (
              <pre className="ex-muted" style={{marginTop:8, whiteSpace:"pre-wrap", fontSize:12}}>
{JSON.stringify(state.diag.tokeninfo, null, 2)}
              </pre>
            ) : null}
            <div style={{marginTop:10}}>
              <a href={toPreviewIframeUrl(url)} target="_blank" rel="noreferrer">In Drive öffnen</a>
            </div>
          </div>
        )}
        {state.mode === "iframe" && (
          <iframe className="ex-modal-media" src={state.src} allow="autoplay" />
        )}
        {state.mode === "blob" && (
          type === "image" ?
            <img src={state.src} alt={name} className="ex-modal-media" /> :
            <video className="ex-modal-media" src={state.src} controls autoPlay playsInline preload="metadata" />
        )}
      </div>
    </div>
  );
};
