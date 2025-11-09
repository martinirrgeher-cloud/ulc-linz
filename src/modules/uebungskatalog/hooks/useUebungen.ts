// Robust typed hook for Exercises: validation, duplicate checks, transactional media replace
import { useCallback, useEffect, useMemo, useState } from "react";
import { Exercise } from "@/modules/uebungskatalog/types/ExerciseTypes";
import { loadUebungen, saveUebungen, uploadMedia, removeFile } from "@/modules/uebungskatalog/services/UebungenStore";
import { extractFileIdFromUrl } from "@/lib/utils/extractFileIdFromUrl";
import { normalize, validateExerciseDraft, isDuplicateName } from "@/lib/utils/forms";
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";

const FILE_ID = import.meta.env.VITE_DRIVE_UEBUNGEN_FILE_ID as string;
const MEDIA_FOLDER_ID = import.meta.env.VITE_DRIVE_MEDIA_FOLDER_ID as string;

function requireEnv(name: string, val: unknown): asserts val {
  if (!val || typeof val !== "string" || (val as string).trim() === "") {
    throw new Error(`❌ .env fehlt/leer: ${name}`);
  }
}

requireEnv("VITE_DRIVE_UEBUNGEN_FILE_ID", FILE_ID);
requireEnv("VITE_DRIVE_MEDIA_FOLDER_ID", MEDIA_FOLDER_ID);

export function useUebungen() {
  const [uebungen, setUebungen] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await downloadJson(FILE_ID);
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setUebungen(list as Exercise[]);
    } catch (e: any) {
      // nicht redirecten: Fehler anzeigen, damit der Nutzer versteht, was los ist
      setError(e?.message || "Fehler beim Laden der Übungen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byId = useMemo(() => {
    const m = new Map<string, Exercise>();
    uebungen.forEach(u => m.set(u.id, u));
    return m;
  }, [uebungen]);

  // --- upload helper ---
  const uploadMedia = useCallback(async (file: File): Promise<{id: string; url: string; type: "image"|"video"; name: string}> => {
    const res = await uploadMedia(file);
    const mime = (file.type || "").toLowerCase();
    const type: "image"|"video" = mime.startsWith("image/") ? "image" : "video";
    return { id: res.id, url: res.url, type, name: res.name };
  }, []);

  // --- add ---
  const addUebung = useCallback(async (ex: Exercise): Promise<Exercise> => {
    setSaving(true);
    setError(null);
    try {
      const draft = { ...ex, name: normalize(ex.name), hauptgruppe: normalize(ex.hauptgruppe), untergruppe: normalize(ex.untergruppe) };
      const errs = validateExerciseDraft(draft);
      if (errs.length) throw new Error(errs.join(" "));

      if (isDuplicateName(uebungen, draft.name!, draft.hauptgruppe!, draft.untergruppe!)) {
        throw new Error("Doppelte Übung in derselben (Haupt-, Unter-)Gruppe.");
      }

      const now = new Date().toISOString();
      const newItem: Exercise = { ...draft, createdAt: now, updatedAt: now } as Exercise;
      const next = [...uebungen, newItem];
      await overwriteJsonContent(FILE_ID, next);
      setUebungen(next);
      return newItem;
    } catch (e: any) {
      setError(e?.message || "Fehler beim Anlegen");
      throw e;
    } finally {
      setSaving(false);
    }
  }, [uebungen]);

  // --- update ---
  type UpdatePayload = Partial<Omit<Exercise,"id">> & { id: string; replaceMediaWithFile?: File | null };

  const updateUebung = useCallback(async (payload: UpdatePayload): Promise<Exercise> => {
    setSaving(true);
    setError(null);
    try {
      const current = byId.get(payload.id);
      if (!current) throw new Error("Übung nicht gefunden");

      // Normalisierte nächste Basiswerte
      const nextName = normalize(payload.name ?? current.name);
      const nextH = normalize(payload.hauptgruppe ?? current.hauptgruppe);
      const nextU = normalize(payload.untergruppe ?? current.untergruppe);

      // Validierung
      const draft: Partial<Exercise> = {
        ...current,
        ...payload,
        name: nextName,
        hauptgruppe: nextH,
        untergruppe: nextU
      };
      const errs = validateExerciseDraft(draft);
      if (errs.length) throw new Error(errs.join(" "));

      // Duplikat prüfen
      if (isDuplicateName(uebungen, nextName!, nextH!, nextU!, current.id)) {
        throw new Error("Doppelte Übung in derselben (Haupt-, Unter-)Gruppe.");
      }

      // Medienersatz (transaktional)
      let newMedia: Partial<Exercise> = {};
      let oldMediaIdToDelete: string | null = null;

      if (payload.replaceMediaWithFile instanceof File) {
        const up = await uploadMedia(payload.replaceMediaWithFile);
        newMedia = {
          mediaId: up.id,
          mediaUrl: up.url,
          mediaType: up.type,
          mediaName: up.name
        };
        const oldId = current.mediaId || extractFileIdFromUrl(current.mediaUrl || "");
        if (oldId && oldId !== up.id) oldMediaIdToDelete = oldId;
      } else if ("mediaId" in payload || "mediaUrl" in payload || "mediaName" in payload || "mediaType" in payload) {
        // Falls nur Metadaten editiert werden (kein neuer Upload)
        newMedia = {
          mediaId: payload.mediaId,
          mediaUrl: payload.mediaUrl,
          mediaName: payload.mediaName,
          mediaType: payload.mediaType
        };
      }

      const now = new Date().toISOString();
      const merged: Exercise = { ...current, ...payload, ...newMedia, name: nextName, hauptgruppe: nextH, untergruppe: nextU, updatedAt: now };

      const next = uebungen.map(u => (u.id === merged.id ? merged : u));
      await overwriteJsonContent(FILE_ID, next);
      setUebungen(next);

      if (oldMediaIdToDelete) {
        try { await removeFile(oldMediaIdToDelete); } catch {}
      }
      return merged;
    } catch (e: any) {
      setError(e?.message || "Fehler beim Aktualisieren");
      throw e;
    } finally {
      setSaving(false);
    }
  }, [uebungen, byId, uploadMedia]);

  return { uebungen, loading, saving, error, refresh, addUebung, updateUebung, uploadMedia };
}
