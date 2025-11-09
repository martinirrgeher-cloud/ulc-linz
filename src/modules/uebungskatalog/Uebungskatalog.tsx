// Uebungskatalog.tsx (use token helper, not googleAuth import)
import { useEffect, useMemo, useState } from "react";
import type { Exercise } from "./types/exercise";
import { loadExercises } from "./services/exercisesStore";
import { loadKategorien } from "./services/categoriesStore";
import { toPreviewIframeUrl, buildDriveBlobObjectUrl } from "./services/mediaUrl";
// WICHTIG: getAccessToken wird nicht mehr benötigt, daher entfernt
// import { getAccessToken } from "./services/authToken";
import { extractFileIdFromUrl } from "@/lib/utils/extractFileIdFromUrl";
import "./Uebungskatalog.css";

type MediaItem = NonNullable<Exercise["media"]>[number];

export default function UebungskatalogPage() {
  const [all, setAll] = useState<Exercise[]>([]);
  const [cats, setCats] = useState<Record<string,string[]> | null>(null);
  const [q, setQ] = useState("");
  const [haupt, setHaupt] = useState<string>("");
  const [unter, setUnter] = useState<string>("");
  const [onlyWithMedia, setOnlyWithMedia] = useState(false);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [useIframe, setUseIframe] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [ex, kat] = await Promise.all([loadExercises(), loadKategorien()]);
        setAll(ex);
        setCats(kat?.hauptgruppen ?? null);
      } catch (e:any) {
        setErr(e?.message || "Laden fehlgeschlagen");
      }
    })();
  }, []);

  useEffect(() => {
    let revoked: string | null = null;
    (async () => {
      if (!preview) { setPreviewSrc(null); setUseIframe(false); return; }

      // ---- FIX: 1) fileId robust ermitteln, 2) buildDriveBlobObjectUrl nur mit fileId aufrufen ----
      const url = (preview as any)?.url ?? "";
      const fileIdFromPreview = (preview as any)?.fileId || (preview as any)?.id || "";
      const fileId = fileIdFromPreview || (url ? extractFileIdFromUrl(url) : "");

      // 1. Versuch: echter Blob-Download (wenn wir eine fileId haben)
      if (fileId) {
        const blobUrl = await buildDriveBlobObjectUrl(fileId).catch(() => null);
        if (blobUrl) {
          setPreviewSrc(blobUrl);
          setUseIframe(false);
          revoked = blobUrl;
          return;
        }
      }

      // 2. Fallback: IFrame-Preview (mit fileId oder der Original-URL)
      if (fileId) {
        setPreviewSrc(toPreviewIframeUrl(fileId));
      } else {
        setPreviewSrc(toPreviewIframeUrl(url));
      }
      setUseIframe(true);
      // ---- /FIX ----
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [preview]);

  const hauptgruppen = useMemo(() => {
    if (cats) return Object.keys(cats).sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"}));
    return Array.from(new Set(all.map(e => e.hauptgruppe).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"}));
  }, [all, cats]);

  const untergruppen = useMemo(() => {
    if (cats && haupt && cats[haupt]) return cats[haupt].slice().sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"}));
    const base = haupt ? all.filter(e => e.hauptgruppe === haupt) : all;
    return Array.from(new Set(base.map(e => e.untergruppe).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"}));
  }, [all, cats, haupt]);

  const list = useMemo(() => {
    let x = all.filter(e => e.active !== false);
    if (haupt) x = x.filter(e => e.hauptgruppe === haupt);
    if (unter) x = x.filter(e => e.untergruppe === unter);
    if (onlyWithMedia) x = x.filter(e => (e.media || []).length > 0);
    if (difficulty) x = x.filter(e => e.difficulty === difficulty);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      x = x.filter(e => (e.name||"").toLowerCase().includes(s) || (e.info||"").toLowerCase().includes(s));
    }
    return x.sort((a,b)=>a.name.localeCompare(b.name,"de",{sensitivity:"base"}));
  }, [all, q, haupt, unter, onlyWithMedia, difficulty]);

  const firstMedia = (e: Exercise): MediaItem | null => (e.media && e.media.length ? e.media[0] : null);

  return (
    <div className="ex-container">
      <div className="ex-toolbar">
        <div className="ex-row-inline between">
          <input className="ex-input flex1" placeholder="Suchen…" value={q} onChange={e=>setQ(e.target.value)} />
          <label className="ex-toggle ml-auto">
            <input type="checkbox" checked={onlyWithMedia} onChange={e=>setOnlyWithMedia(e.target.checked)} />
            mit Medien
          </label>
        </div>
        <div className="ex-row-3-inline">
          <select className="ex-select" value={haupt} onChange={e=>{setHaupt(e.target.value); setUnter("");}}>
            <option value="">Hauptgruppe</option>
            {Array.from(new Set(all.map(e => e.hauptgruppe).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"})).map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <select className="ex-select" value={unter} onChange={e=>setUnter(e.target.value)}>
            <option value="">Untergruppe</option>
            {Array.from(new Set((haupt ? all.filter(e=>e.hauptgruppe===haupt) : all).map(e => e.untergruppe).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"})).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select className="ex-select" value={String(difficulty ?? "")} onChange={e=>setDifficulty(e.target.value? Number(e.target.value): null)}>
            <option value="">★</option>
            {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n} ★</option>)}
          </select>
        </div>
      </div>

      {err && <div className="ex-error">Fehler: {err}</div>}

      <div className="ex-cards">
        {list.map(e => {
          const m = firstMedia(e);
          return (
            <div key={e.id} className="ex-card">
              <div className="ex-card-head row">
                <div className="ex-card-head-left">
                  <div className="ex-card-title">{e.name}</div>
                  <div className="ex-card-sub">{e.hauptgruppe} • {e.untergruppe} • {e.difficulty}★</div>
                </div>
                <div className="ex-card-head-right">
                  {m ? (
                    <button
                      className={"ex-media-icon " + m.type}
                      title={m.name}
                      onClick={()=>setPreview(m)}
                      aria-label="Medienvorschau öffnen"
                    >
                      {m.type === "video" ? videoIcon() : imageIcon()}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="ex-modal" onClick={()=>setPreview(null)}>
          <div className="ex-modal-content" onClick={(e)=>e.stopPropagation()}>
            <button className="ex-modal-close" onClick={()=>setPreview(null)} aria-label="Schließen">×</button>
            {!useIframe && previewSrc ? (
              preview.type === "image" ? (
                <img src={previewSrc} alt={preview.name} className="ex-modal-media" />
              ) : (
                <video className="ex-modal-media" src={previewSrc} controls autoPlay playsInline preload="metadata" />
              )
            ) : (
              <iframe className="ex-modal-media" src={previewSrc || ""} allow="autoplay" />
            )}
            <div className="ex-modal-caption">{preview.name}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function imageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 11A2.5 2.5 0 1 1 11 8.5 2.5 2.5 0 0 1 8.5 11Zm-3 7 5-6 4 5 3-4 3 5Z"></path>
    </svg>
  );
}
function videoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M17 10.5V7a2 2 0 0 0-2-2H5A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 2v-7l-4 2Z"></path>
    </svg>
  );
}
