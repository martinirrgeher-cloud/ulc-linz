// Uebungskatalog.tsx – zentrale Seite des Übungskatalogs
import { useEffect, useMemo, useState } from "react";
import type { Exercise } from "./types/exercise";
import { loadExercises } from "./services/exercisesStore";
import { loadKategorien } from "./services/categoriesStore";
import UebungCard from "./components/UebungCard";
import "./Uebungskatalog.css";

export default function UebungskatalogPage() {
  const [all, setAll] = useState<Exercise[]>([]);
  const [cats, setCats] = useState<Record<string, string[]> | null>(null);

  const [q, setQ] = useState("");
  const [haupt, setHaupt] = useState("");
  const [unter, setUnter] = useState("");
  const [onlyWithMedia, setOnlyWithMedia] = useState(false);
  const [difficulty, setDifficulty] = useState<number | null>(null);

  const [err, setErr] = useState<string | null>(null);

  // -------------------------------------------------------
  // Laden der Daten von Drive
  // -------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [ex, kat] = await Promise.all([loadExercises(), loadKategorien()]);
        setAll(ex);
        setCats(kat?.hauptgruppen ?? null);
      } catch (e: any) {
        setErr(e?.message || "Laden des Übungskatalogs fehlgeschlagen.");
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Auswahl-Listen für Haupt- und Untergruppen
  // -------------------------------------------------------
  const hauptgruppen = useMemo(() => {
    if (cats) {
      return Object.keys(cats).sort((a, b) =>
        a.localeCompare(b, "de", { sensitivity: "base" })
      );
    }

    return Array.from(
      new Set(all.map((e) => e.hauptgruppe).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [all, cats]);

  const untergruppen = useMemo(() => {
    if (cats && haupt && cats[haupt]) {
      return cats[haupt].slice().sort((a, b) =>
        a.localeCompare(b, "de", { sensitivity: "base" })
      );
    }

    const base = haupt ? all.filter((e) => e.hauptgruppe === haupt) : all;

    return Array.from(
      new Set(base.map((e) => e.untergruppe).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [all, cats, haupt]);

  // -------------------------------------------------------
  // Gefilterte & sortierte Liste
  // -------------------------------------------------------
  const list = useMemo(() => {
    let x = all.filter((e) => e.active !== false);

    if (haupt) x = x.filter((e) => e.hauptgruppe === haupt);
    if (unter) x = x.filter((e) => e.untergruppe === unter);
    if (onlyWithMedia) x = x.filter((e) => (e.media || []).length > 0);
    if (difficulty) x = x.filter((e) => e.difficulty === difficulty);

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      x = x.filter(
        (e) =>
          (e.name || "").toLowerCase().includes(s) ||
          (e.info || "").toLowerCase().includes(s)
      );
    }

    return x.sort((a, b) =>
      a.name.localeCompare(b.name, "de", { sensitivity: "base" })
    );
  }, [all, q, haupt, unter, onlyWithMedia, difficulty]);

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div className="ex-container">
      <div className="ex-toolbar">
        <div className="ex-row-inline between">
          <input
            className="ex-input flex1"
            placeholder="Suchen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="ex-toggle ml-auto">
            <input
              type="checkbox"
              checked={onlyWithMedia}
              onChange={(e) => setOnlyWithMedia(e.target.checked)}
            />
            mit Medien
          </label>
        </div>

        <div className="ex-row-3-inline">
          <select
            className="ex-select"
            value={haupt}
            onChange={(e) => {
              setHaupt(e.target.value);
              setUnter("");
            }}
          >
            <option value="">Hauptgruppe</option>
            {hauptgruppen.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          <select
            className="ex-select"
            value={unter}
            onChange={(e) => setUnter(e.target.value)}
          >
            <option value="">Untergruppe</option>
            {untergruppen.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            className="ex-select"
            value={difficulty ? String(difficulty) : ""}
            onChange={(e) =>
              setDifficulty(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">alle Level</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="ex-error">Fehler: {err}</div>}

      <div className="ex-cards">
        {list.map((ex) => (
          <UebungCard key={ex.id} exercise={ex} />
        ))}
      </div>
    </div>
  );
}
