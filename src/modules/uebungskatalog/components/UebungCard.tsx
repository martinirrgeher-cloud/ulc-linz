import React, { useState } from "react";
import { FileIcon, VideoIcon, ImageIcon, X } from "lucide-react";
import "../styles/Uebungskatalog.css";

interface UebungCardProps {
  uebung: {
    id: string;
    name: string;
    hauptgruppe: string;
    untergruppe: string;
    difficulty: number;
    mediaUrl?: string;
    mediaType?: "image" | "video" | string;
  };
  onClick: (id: string) => void;
}

// Google Drive Direktlink für Video
const getDirectDownloadUrl = (url: string) => {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)\//);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return url;
};

export default function UebungCard({ uebung, onClick }: UebungCardProps) {
  const [showVideo, setShowVideo] = useState(false);

  const handleFileOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (uebung.mediaUrl) {
      if (uebung.mediaType === "video") {
        setShowVideo(true);
      } else {
        // Bilder oder sonstige Dateien normal öffnen
        window.open(uebung.mediaUrl, "_blank");
      }
    }
  };

  const renderIcon = () => {
    if (uebung.mediaType === "video") return <VideoIcon size={20} />;
    if (uebung.mediaType === "image") return <ImageIcon size={20} />;
    return <FileIcon size={20} />;
  };

  return (
    <>
      <div className="uebung-card" onClick={() => onClick(uebung.id)}>
        <div className="uebung-card-content">
          <div className="uebung-name">{uebung.name}</div>
          <div className="uebung-gruppe">
            {uebung.hauptgruppe} – {uebung.untergruppe}
          </div>
          <div className="uebung-difficulty">
            {[1, 2, 3].map(level => (
              <span
                key={level}
                className={uebung.difficulty >= level ? "star active" : "star"}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        {uebung.mediaUrl && (
          <button
            type="button"
            className="file-icon-button"
            onClick={handleFileOpen}
            title="Datei öffnen"
          >
            {renderIcon()}
          </button>
        )}
      </div>

      {/* 📽️ Video-Overlay */}
      {showVideo && uebung.mediaUrl && (
        <div className="video-overlay" onClick={() => setShowVideo(false)}>
          <div
            className="video-popup"
            onClick={(e) => e.stopPropagation()} // Klick im Popup soll es nicht schließen
          >
            <button
              className="video-close-button"
              onClick={() => setShowVideo(false)}
              aria-label="Schließen"
            >
              <X size={24} />
            </button>
            <video
              controls
              autoPlay
              src={getDirectDownloadUrl(uebung.mediaUrl)}
              style={{ maxWidth: "100%", maxHeight: "80vh" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
