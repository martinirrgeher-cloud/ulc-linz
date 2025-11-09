import React, { useState, useMemo } from "react";
import { FileIcon, VideoIcon, ImageIcon } from "lucide-react";
import "../styles/Uebungskatalog.css";
import { MediaViewerModal } from "./MediaViewerModal";

interface Uebung {
  id: string;
  name: string;
  hauptgruppe: string;
  untergruppe: string;
  difficulty: number;
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | string;
  active?: boolean;
}

const Stars: React.FC<{ value?: number }> = ({ value = 0 }) => {
  const arr = Array.from({ length: 5 });
  return (
    <div className="uk-stars">
      {arr.map((_, i) => (
        <span key={i} className={i < value ? "on" : ""}>★</span>
      ))}
    </div>
  );
};

export default function UebungCard({ uebung }:{ uebung: Uebung }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const mediaUrl = useMemo(() => uebung.mediaUrl || (uebung.mediaId ? `https://drive.google.com/uc?id=${encodeURIComponent(uebung.mediaId)}&export=download` : ""), [uebung.mediaUrl, uebung.mediaId]);
  const hasMedia = !!(uebung.mediaId || uebung.mediaUrl);

  return (
    <div className={"uk-card" + (!uebung.active ? " inactive" : "")}>
      <div className="uk-head">
        <div className="uk-title">{uebung.name}</div>
        <div className="uk-icons">
          <Stars value={uebung.difficulty} />
          {hasMedia && (
            <span
              className="uk-media-icon"
              role="button"
              title="Vorschau öffnen"
              onClick={() => setViewerOpen(true)}
            >
              {uebung.mediaType === "video" ? <VideoIcon size={16}/> : uebung.mediaType === "image" ? <ImageIcon size={16}/> : <FileIcon size={16}/>}
            </span>
          )}
        </div>
      </div>
      <div className="uk-sub">{uebung.hauptgruppe} • {uebung.untergruppe}</div>

      <MediaViewerModal 
         open={viewerOpen} 
         onClose={() => setViewerOpen(false)} 
         fileId={uebung.mediaId} 
         url={mediaUrl}              // <- statt mediaUrl-Prop
         name={uebung.name}          // <- statt title
         type={"image"}              // oder "video" je nach Kontext 
/>
    </div>
  );
}
