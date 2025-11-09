import React from "react";

export type Props = {
  open: boolean;
  onClose: () => void;
  fileId?: string;
  mediaUrl: string;
  title?: string;
};

export function MediaViewerModal({ open, onClose, mediaUrl, title }: Props) {
  if (!open) return null;
  const isVideo = /\.(mp4|webm)(\?|$)/i.test(mediaUrl);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-4 max-w-3xl w-[90%]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{title || "Vorschau"}</h3>
          <button onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        <div className="w-full">
          {isVideo ? (
            <video controls style={{width: "100%"}} src={mediaUrl} />
          ) : (
            <iframe title="preview" src={mediaUrl.replace("/uc?export=download&", "/file/d/").replace("id=", "") + "/preview"} style={{width: "100%", height: "70vh"}} />
          )}
        </div>
      </div>
    </div>
  );
}
