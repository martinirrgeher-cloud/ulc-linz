// src/modules/uebungskatalog/components/MediaViewerModal.tsx
import React, { useEffect, useState } from "react";
import { toPreviewIframeUrl } from "../services/mediaUrl";
import { extractFileIdFromUrl } from "@/lib/utils/extractFileIdFromUrl";

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

    async function run() {
      setMode("loading"); setSrc(""); setMsg("");

      const fidProp = fileId || "";
      const urlProp = url || "";

      try {
        // 1) Drive-ID ermitteln (entweder direkt, aus einer Drive-URL oder aus einer "nackten" ID)
        let driveId = fidProp;

        if (!driveId && urlProp) {
          if (urlProp.includes("drive.google.com")) {
            // klassischer geteilter Drive-Link
            driveId = extractFileIdFromUrl(urlProp) || "";
          } else {
            // Falls die URL wie eine nackte ID aussieht (keine Slashes, kein Protokoll),
            // dann behandeln wir sie als Drive-File-ID.
            const looksLikeId =
              !urlProp.includes("://") &&
              !urlProp.startsWith("/") &&
              !urlProp.startsWith("./") &&
              !urlProp.startsWith("../");
            if (looksLikeId) {
              driveId = urlProp;
            }
          }
        }

        // 2) Wenn wir eine Drive-ID haben → immer Drive-Preview verwenden
        if (driveId) {
          if (!alive) return;
          const preview = toPreviewIframeUrl(driveId);
          setSrc(preview);
          setMode("iframe");
          return;
        }

        // 3) Fallback: echte externe URL (nur http/https)
        if (urlProp && /^https?:\/\//.test(urlProp)) {
          if (!alive) return;
          setSrc(urlProp);
          setMode("iframe");
          return;
        }

        setMode("error");
        setMsg("Keine gültige Medienquelle vorhanden.");
      } catch (e: any) {
        if (!alive) return;
        setMode("error");
        setMsg(e?.message || "Medienvorschau fehlgeschlagen");
      }
    }

    if (open) run(); else { setMode("loading"); setSrc(""); setMsg(""); }

    return () => {
      alive = false;
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
