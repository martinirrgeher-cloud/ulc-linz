import { useRef, useState, useMemo } from "react";
import { FileImage, PlayCircle, Paperclip } from "lucide-react";
import { deleteFile } from "@/lib/drive/DriveClient";

type UploadResult = {
  id: string;
  url: string;
  type: "image" | "video" | string;
  name?: string; // optional – falls du es in uploadFile mitgeben willst
};

interface Props {
  // Wird aufgerufen, wenn eine Datei erfolgreich hochgeladen wurde
  onUploaded: (result: UploadResult) => void;
  // Wird aufgerufen, nachdem eine vorhandene Datei entfernt wurde
  onCleared: () => void;
  // aktueller Zustand aus dem Formular (z. B. beim Bearbeiten)
  mediaUrl: string;
  mediaType: string;
  // Optional: wenn du den Dateinamen nach Speichern mitbehältst, kannst du ihn hier reinreichen
  mediaName?: string;
  // Hochladefunktion; in deinem Fall nutzt du in der Seite uploadFile(file)
  onUpload: (file: File) => Promise<UploadResult>;
}

export function UploadField({
  onUploaded,
  onCleared,
  mediaUrl,
  mediaType,
  mediaName,
  onUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [lastUploadId, setLastUploadId] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | undefined>(mediaName);

  // Versuche File-ID aus mediaUrl zu extrahieren (uc?id=FILEID)
  const fileIdFromUrl = useMemo(() => {
    if (!mediaUrl) return null;
    const m = mediaUrl.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
    return m?.[1] ?? null;
  }, [mediaUrl]);

  const hasMedia = Boolean(mediaUrl && mediaUrl.trim() !== "");

  const renderIcon = () => {
    if (mediaType === "video") return <PlayCircle size={22} />;
    if (mediaType === "image") return <FileImage size={22} />;
    return <Paperclip size={22} />;
  };

  const handlePick = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // UI sofort mit Namen versorgen
      setLocalFileName(file.name);

      const result = await onUpload(file);
      setLastUploadId(result.id ?? null);
      // result.name ist optional – wenn dein uploadFile das mitschickt, nutzen wir es,
      // sonst bleibt localFileName der „Wahrheit“
      if (result.name) setLocalFileName(result.name);

      onUploaded(result);
    } catch (err) {
      console.error("Upload fehlgeschlagen:", err);
      // Rollback Name-Anzeige, wenn der Upload schiefging
      if (!hasMedia) setLocalFileName(undefined);
      alert("Upload fehlgeschlagen. Details in der Konsole.");
    } finally {
      setUploading(false);
      // Input zurücksetzen, damit dieselbe Datei erneut ausgewählt werden kann
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    const idToDelete = lastUploadId ?? fileIdFromUrl;
    if (!idToDelete) {
      // Kein ID-Wert auffindbar – URL ohne ID? Dann nur lokal leeren.
      onCleared();
      setLocalFileName(undefined);
      setLastUploadId(null);
      return;
    }
    try {
      await deleteFile(idToDelete);
    } catch (err) {
      console.error("Löschen fehlgeschlagen:", err);
      alert("Datei konnte auf Google Drive nicht gelöscht werden.");
      return;
    }
    // UI leeren
    onCleared();
    setLocalFileName(undefined);
    setLastUploadId(null);
  };

  return (
    <div className="upload-field">
      <div className="upload-controls" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!hasMedia ? (
          <button
            type="button"
            className="primary-button"
            onClick={handlePick}
            disabled={uploading}
          >
            {uploading ? "Upload…" : "Datei auswählen"}
          </button>
        ) : (
          <button
            type="button"
            className="danger-button"
            onClick={handleRemove}
            disabled={uploading}
            title="Hochgeladene Datei entfernen"
          >
            Datei entfernen
          </button>
        )}

        {/* Dateiname / Status rechts daneben */}
        <div className="upload-fileinfo" title={fileIdFromUrl ?? ""} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {hasMedia ? (
            <>
              <span className="upload-icon">{renderIcon()}</span>
              <span>
                {localFileName
                  ? localFileName
                  : fileIdFromUrl
                  ? `Datei vorhanden (ID: ${fileIdFromUrl})`
                  : "Datei vorhanden"}
              </span>
            </>
          ) : uploading ? (
            <span>Upload läuft…</span>
          ) : (
            <span>Keine Datei ausgewählt</span>
          )}
        </div>
      </div>

      {/* Verstecktes File-Input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleChange}
      />

      {/* Vorschau (optional – kann bleiben) */}
      {hasMedia && (
        <div className="upload-preview-element" style={{ marginTop: 8 }}>
          {mediaType === "video" ? (
            <video controls src={mediaUrl} style={{ maxWidth: "100%", borderRadius: 6 }} />
          ) : (
            <img src={mediaUrl} alt="Vorschau" style={{ maxWidth: "100%", borderRadius: 6 }} />
          )}
        </div>
      )}
    </div>
  );
}
