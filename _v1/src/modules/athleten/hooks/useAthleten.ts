// src/modules/athleten/hooks/useAthleten.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Athlete } from "../types/athleten";
import { loadAthleten, saveAthleten } from "@/modules/athleten/services/AthletenStore";

type SortMode = "NACHNAME" | "VORNAME" | "JAHR_AUF" | "JAHR_AB";

/**
 * Hook für Athletenliste mit lokaler Sortierung & Inaktiv-Filter
 */
export function useAthleten() {
  const [athleten, setAthleten] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortMode, setSortModeState] = useState<SortMode>(() => {
    try {
      const s = localStorage.getItem("ATHLETEN_SORT") as SortMode | null;
      if (s === "NACHNAME" || s === "VORNAME" || s === "JAHR_AUF" || s === "JAHR_AB") return s;
    } catch {}
    return "NACHNAME";
  });

  const [showInactive, setShowInactive] = useState<boolean>(() => {
    try {
      return localStorage.getItem("ATHLETEN_SHOW_INACTIVE") === "1";
    } catch {}
    return false;
  });

  const getYear = (a: Athlete) => {
    const y = (a as any)?.geburtsjahr;
    return typeof y === "number" ? y : Number(y) || 0;
  };

  const sortFn = useMemo(() => {
    const cmpText = (a: string, b: string) =>
      (a || "").localeCompare(b || "", "de", { sensitivity: "base" });
    if (sortMode === "NACHNAME") {
      return (a: Athlete, b: Athlete) =>
        cmpText(a.lastName || a.name || "", b.lastName || b.name || "");
    }
    if (sortMode === "VORNAME") {
      return (a: Athlete, b: Athlete) =>
        cmpText(a.firstName || "", b.firstName || "");
    }
    if (sortMode === "JAHR_AUF") {
      return (a: Athlete, b: Athlete) => {
        const ay = getYear(a), by = getYear(b);
        return (ay - by) || cmpText(a.lastName || a.name || "", b.lastName || b.name || "");
      };
    }
    // JAHR_AB
    return (a: Athlete, b: Athlete) => {
      const ay = getYear(a), by = getYear(b);
      return (by - ay) || cmpText(a.lastName || a.name || "", b.lastName || b.name || "");
    };
  }, [sortMode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadAthleten();
      setAthleten(data.slice().sort(sortFn));
    } catch (e: any) {
      setError(e?.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [sortFn]);

  useEffect(() => {
    load();
  }, [load]);

  const setSortMode = (m: SortMode) => {
    setSortModeState(m);
    try { localStorage.setItem("ATHLETEN_SORT", m); } catch {}
    setAthleten((arr) => arr.slice().sort(
      m === "NACHNAME"
        ? (a, b) => (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "", "de", { sensitivity: "base" })
        : m === "VORNAME"
          ? (a, b) => (a.firstName || "").localeCompare(b.firstName || "", "de", { sensitivity: "base" })
          : m === "JAHR_AUF"
            ? ((a, b) => {
                const ay = getYear(a), by = getYear(b);
                return (ay - by) || (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "", "de", { sensitivity: "base" });
              })
            : ((a, b) => {
                const ay = getYear(a), by = getYear(b);
                return (by - ay) || (a.lastName || a.name || "").localeCompare(b.lastName || b.name || "", "de", { sensitivity: "base" });
              })
    ));
  };

  const setShowInactiveWrapped = (v: boolean) => {
    setShowInactive(v);
    try { localStorage.setItem("ATHLETEN_SHOW_INACTIVE", v ? "1" : "0"); } catch {}
  };

  const add = useCallback(async (neu: Athlete) => {
    if (!neu.id && typeof crypto !== "undefined" && "randomUUID" in crypto) {
      neu = { ...neu, id: (crypto as any).randomUUID() as string };
    }
    const next = [...athleten, neu];
    setAthleten(next.slice().sort(sortFn));
    await saveAthleten(next);
  }, [athleten, sortFn]);

  const update = useCallback(async (patch: Athlete) => {
    const next = athleten.map((a) => (a.id === patch.id ? { ...a, ...patch } : a));
    setAthleten(next.slice().sort(sortFn));
    await saveAthleten(next);
  }, [athleten, sortFn]);

  return {
    loading,
    error,
    athleten: showInactive ? athleten : athleten.filter((a) => a.active !== false),
    add,
    update,
    sortMode,
    setSortMode,
    showInactive,
    setShowInactive: setShowInactiveWrapped,
    reload: load,
  };
}
