import React, { useMemo, useState } from "react";
import styles from "../Athleten.module.css";
import { Athlete } from "../hooks/useAthleten";
import AthleteForm from "./AthleteForm";

interface Props {
  athletes: Athlete[];
  onCreate: (draft?: Partial<Athlete>) => void;
  onEdit: (id: string, patch: Partial<Athlete>) => void;
  onDelete: (id: string) => void;
  filterPlaceholder?: string;
}

export default function AthleteList({ athletes, onCreate, onEdit, onDelete, filterPlaceholder = "Athlet suchen..." }: Props) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return athletes;
    return athletes.filter(a =>
      a.name.toLowerCase().includes(s) ||
      (a.leistungsgruppe ?? "").toLowerCase().includes(s)
    );
  }, [q, athletes]);

  return (
    <div className={styles.listWrap}>
      <div className={styles.listHeader}>
        <div className={styles.listHeaderInner}>
          <input
            className={styles.searchInput}
            placeholder={filterPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className={styles.primaryBtn} onClick={() => setCreating(v => !v)}>
            + Athlet
          </button>

          {creating && (
            <div className={styles.createMenuDropdown}>
              <h3>Neuer Athlet</h3>
              <AthleteForm
                onCancel={() => setCreating(false)}
                onSave={(data) => {
                  onCreate(data);
                  setCreating(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <ul className={styles.athleteList}>
        {filtered.map(a => (
          <li
            key={a.id}
            className={`${styles.athleteItem} ${a.active === false ? styles.inactiveRow : ""}`}
          >
            <div
              className={styles.athleteRowTop}
              onClick={() => setOpenId(openId === a.id ? null : a.id)}
            >
              <div className={styles.athleteName}>{a.name}</div>
              <div className={styles.athleteMeta}>
                {a.geburtsjahr ? `JG ${a.geburtsjahr}` : "—"} · {a.leistungsgruppe ?? "—"}
              </div>
            </div>

            {openId === a.id && (
              <div className={styles.editMenuDropdown}>
                <AthleteForm
                  key={a.id}
                  initial={a}
                  onCancel={() => setOpenId(null)}
                  onSave={(patch) => {
                    onEdit(a.id, patch);
                    setOpenId(null);
                  }}
                />
                <div className={styles.formRow}>
                  <label>
                    <input
                      type="checkbox"
                      checked={a.active === false}
                      onChange={(e) =>
                        onEdit(a.id, { active: e.target.checked ? false : true })
                      }
                    />
                    Inaktiv
                  </label>
                </div>
              </div>
            )}
          </li>
        ))}

        {filtered.length === 0 && (
          <li className={styles.emptyState}>Keine Treffer.</li>
        )}
      </ul>
    </div>
  );
}
