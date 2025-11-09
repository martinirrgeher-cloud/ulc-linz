import React, { useMemo, useState } from "react";
import { toPreviewIframeUrl, buildDriveBlobObjectUrl } from "./services/mediaUrl";
import { MediaViewerModal } from "./components/MediaViewerModal";
import { useUebungen } from "./hooks/useUebungen";

export default function Uebungskatalog() {
  const { items } = useUebungen();
  const [viewer, setViewer] = useState<{open:boolean; url:string; title:string}>({open:false, url:"", title:""});

  const openViewer = (fileId?: string, title?: string) => {
    if (!fileId) return;
    const url = toPreviewIframeUrl(fileId) || buildDriveBlobObjectUrl(fileId);
    setViewer({ open: true, url, title: title || "Vorschau" });
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Übungskatalog</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(u => (
          <div key={u.id} className="rounded-xl shadow p-3">
            <div className="font-medium mb-2">{u.name}</div>
            <button className="underline" onClick={() => openViewer(u.mediaId, u.name)} disabled={!u.mediaId}>
              Medien ansehen
            </button>
          </div>
        ))}
      </div>
      <MediaViewerModal
        open={viewer.open}
        onClose={() => setViewer(v => ({...v, open:false}))}
        mediaUrl={viewer.url}
        title={viewer.title}
      />
    </div>
  );
}
