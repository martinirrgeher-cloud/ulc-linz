import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../Athleten.module.css";
import AthleteList from "../components/AthleteList";
import { useAthleten } from "../hooks/useAthleten";
import { Athlete } from "../types/athleten";

export default function AthletenPage() {
  const navigate = useNavigate();
  const { loading, error, athletes: rawAthletes = [], addAthlete, updateAthlete, removeAthlete, reload } = useAthleten();

  // 🧭 Fallback → nie undefined
  const athletes = Array.isArray(rawAthletes) ? rawAthletes : [];

  const [showInactive, setShowInactive] = useState(true);
  const [sortBy, setSortBy] = useState<"vor" | "nach">("nach");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sortedAthletes = useMemo(() => {
    const active = athletes.filter(a => (a as any).active !== false);
    const inactive = athletes.filter(a => (a as any).active === false);

    active.sort((a, b) => sortName(a, b, sortBy));
    inactive.sort((a, b) => sortName(a, b, sortBy));

    return showInactive ? [...active, ...inactive] : active;
  }, [athletes, showInactive, sortBy]);

  return (
    <div className={styles.pageWrap}>
      {/* 🧭 Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <button className={styles.iconBtn} onClick={() => navigate("/dashboard")}>🏠</button>
          <h1 className={styles.pageTitle}>Athleten</h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.settingsWrapper}>
            <button className={styles.iconBtn} onClick={() => setSettingsOpen(o => !o)}>⚙️</button>
            {settingsOpen && (
              <div className={styles.settingsMenu}>
                <label className={styles.settingsRow}>
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={() => setShowInactive(v => !v)}
                  />
                  Inaktive Athleten anzeigen
                </label>
                <div className={styles.settingsRow}>
                  Sortierung:
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "vor" | "nach")}
                  >
                    <option value="vor">Vorname</option>
                    <option value="nach">Nachname</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 📋 Layout */}
      <div className={styles.layoutGrid}>
        <div className={styles.colLeft}>
          <AthleteList
            athletes={sortedAthletes}
            onCreate={async (data) => {
              await addAthlete({ ...data, active: true });
              await reload();
            }}
            onEdit={async (id, patch) => {
              await updateAthlete(id, patch);
              await reload();
            }}
            onDelete={async (id) => {
              await removeAthlete(id);
              await reload();
            }}
          />
        </div>

        <div className={styles.colRight}>
          {loading && <div className={styles.muted}>Lade…</div>}
          {error && <div className={styles.errorBox}>Fehler: {error}</div>}
          {!loading && !error && sortedAthletes.length === 0 && (
            <div className={styles.muted}>Keine Athleten gefunden.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function sortName(a: Athlete, b: Athlete, sortBy: "vor" | "nach") {
  const nameA = a.name.trim();
  const nameB = b.name.trim();
  const keyA = sortBy === "nach" ? nameA.split(" ").slice(-1)[0] : nameA.split(" ")[0];
  const keyB = sortBy === "nach" ? nameB.split(" ").slice(-1)[0] : nameB.split(" ")[0];
  return keyA.localeCompare(keyB, "de");
}
