import React, { useMemo, useState } from "react";
import { FileIcon, ImageIcon, VideoIcon } from "lucide-react";
import "../Uebungskatalog.css";
import { MediaViewerModal } from "./MediaViewerModal";
import type { Exercise, MediaItem } from "../types/exercise";
import { extractFileIdFromUrl } from "@/lib/utils/extractFileIdFromUrl";

type Props = {
  exercise: Exercise;
};

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <div
    className="ex-card-stars"
    style={{ marginLeft: "auto", textAlign: "right", whiteSpace: "nowrap" }}
  >
    {"★".repeat(value)}
  </div>
);

function pickFirstMedia(exercise: Exercise): MediaItem | null {
  if (!exercise.media || exercise.media.length === 0) return null;
  return exercise.media[0];
}

export default function UebungCard({ exercise }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false);

  const media = useMemo(() => pickFirstMedia(exercise), [exercise]);

  const rawFileId = media ? extractFileIdFromUrl(media.url) : undefined;
  const fileId: string | undefined = rawFileId ?? undefined;
  const mediaUrl = media?.url;
  const mediaType: "image" | "video" =
    media?.type === "video" ? "video" : "image";

  const mengeEinheit =
    exercise.menge != null && exercise.einheit
      ? `${exercise.menge} ${exercise.einheit}`
      : exercise.menge != null
      ? String(exercise.menge)
      : exercise.einheit ?? "";

  const hasMedia = !!media;

  return (
    <>
      <div className="ex-card">
        <div className="ex-card-head row">
          <div className="ex-card-head-left">
            <div
              className="ex-card-title-row"
              style={{ display: "flex", alignItems: "center" }}
            >
              <div className="ex-card-title">{exercise.name}</div>
              {exercise.difficulty && <Stars value={exercise.difficulty} />}
            </div>

            <div className="ex-card-body-row">
              <div className="ex-card-body-left">
                <div className="ex-card-sub">
                  {exercise.hauptgruppe}
                  {exercise.hauptgruppe && exercise.untergruppe && " • "}
                  {exercise.hauptgruppe
                    ? exercise.untergruppe
                    : exercise.untergruppe || ""}
                </div>
                {mengeEinheit && (
                  <div className="ex-card-amount">{mengeEinheit}</div>
                )}
              </div>

              {hasMedia && media && (
                <button
                  type="button"
                  className={"ex-media-icon " + media.type}
                  title={media.name}
                  aria-label="Medienvorschau öffnen"
                  onClick={() => setViewerOpen(true)}
                >
                  {media.type === "video" ? (
                    <VideoIcon size={18} />
                  ) : media.type === "image" ? (
                    <ImageIcon size={18} />
                  ) : (
                    <FileIcon size={18} />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <MediaViewerModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        name={exercise.name}
        fileId={fileId}
        url={mediaUrl}
        type={mediaType}
      />
    </>
  );
}
