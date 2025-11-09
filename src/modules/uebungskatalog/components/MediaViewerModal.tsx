// src/modules/uebungskatalog/components/MediaViewerModal.tsx
import React, { useEffect, useState } from "react";
import { buildDriveBlobObjectUrl, toPreviewIframeUrl } from "../services/mediaUrl";

type Props = {
  open: boolean;
  onClose: () => void;
  name?: string;
  // optional beides zulassen
  fileId?: string;
  url?: string;
  type?: "image" | "video";
};

function MediaViewerModalImpl({ open, onClose, name, fileId, url, type }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  const [mode, setMode] = useState<"loading"|"iframe"|"blob"|"error">("loading");
  const [src, setSrc] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;

    async function run() {
      setMode("loading"); setSrc(""); setMsg("");

      const fid = fileId || "";
      const gurl = url || "";

      try {
        if (fid) {
          // echter Download mit Token → Blob
          const u = await buildDriveBlobObjectUrl(fid);
          if (!alive) return;
          if (u) { objectUrl = u; setSrc(u); setMode("blob"); return; }
        }
        // Fallback: IFrame-Preview
        if (fid) {
          setSrc(toPreviewIframeUrl(fid));
          setMode("iframe"); return;
        }
        if (gurl) {
          setSrc(gurl);
          setMode(type === "video" ? "blob" : "iframe"); // heuristik
          return;
        }
        setMode("error"); setMsg("Keine Medienquelle vorhanden.");
      } catch (e: any) {
        if (!alive) return;
        setMode("error"); setMsg(e?.message || "Medienvorschau fehlgeschlagen");
      }
    }

    if (open) run(); else { setMode("loading"); setSrc(""); setMsg(""); }

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, fileId, url, type]);

  if (!open) return null;
  return (
    <div className="ex-modal" onClick={onClose}>
      <div className="ex-modal__content" onClick={e => e.stopPropagation()}>
        <div className="ex-modal__header">
          <strong>{name || "Vorschau"}</strong>
          <button onClick={onClose}>Schließen</button>
        </div>
        {mode === "error" && <div className="ex-error">{msg}</div>}
        {mode === "iframe" && <iframe className="ex-modal-media" src={src} allow="autoplay" />}
        {mode === "blob" && (
          type === "image"
            ? <img className="ex-modal-media" src={src} alt={name} />
            : <video className="ex-modal-media" src={src} controls autoPlay playsInline preload="metadata" />
        )}
      </div>
    </div>
  );
}

export default MediaViewerModalImpl;
export const MediaViewerModal = MediaViewerModalImpl;
