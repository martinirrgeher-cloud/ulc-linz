// src/modules/shared/services/mediaUrl.ts
// Robuste Drive-Medien-Helfer mit Authorization-Header und Token-Fallback.

import { getGoogleAccessTokenFromStorage, tokenExpired, requireGoogleTokenOrRedirect } from "@/lib/googleTokenAdapter";
import { useEffect, useState } from "react";

/** IFrame-Preview für Bilder/PDFs etc. (kein Auth-Header nötig) */
export function toPreviewIframeUrl(fileId: string) {
  if (!fileId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

/**
 * Holt den Dateiinhalt via Drive v3 alt=media mit Bearer-Token
 * und gibt eine temporäre Object-URL zurück. Geeignet für <video src=> oder <img src=>.
 */
export async function buildDriveBlobObjectUrl(fileId: string): Promise<string> {
  if (!fileId) return "";
  const token = getGoogleAccessTokenFromStorage?.();
  if (!token || tokenExpired?.()) {
    try { requireGoogleTokenOrRedirect?.(); } catch {}
    throw new Error("Kein gültiges Google-Access-Token (bitte neu anmelden).");
  }

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    try { requireGoogleTokenOrRedirect?.(); } catch {}
    throw new Error("401 Unauthorized – Token ungültig oder abgelaufen.");
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Download fehlgeschlagen: ${res.status} ${txt}`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** React-Hook: lädt eine Drive-Datei als Blob-URL und räumt korrekt auf. */
export function useDriveObjectUrl(fileId: string) {
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    let currentUrl: string | null = null;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const u = await buildDriveBlobObjectUrl(fileId);
        if (!alive) return;
        currentUrl = u;
        setSrc(u);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || String(e));
        setSrc("");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (fileId) {
      run();
    } else {
      setSrc("");
      setError("");
    }

    return () => {
      alive = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [fileId]);

  return { src, error, loading };
}
