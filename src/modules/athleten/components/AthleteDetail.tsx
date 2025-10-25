import React, { useMemo, useState } from "react";
import styles from "../Athleten.module.css";
import { Athlete, TrainingsplanEinheit } from "../types/athleten";

type Tab = "anmeldung" | "plan" | "feedback" | "statistik";

interface Props {
  athlete: Athlete;
  week: string;
  onWeekChange: (week: string) => void;
  onBack: () => void;
  onRemove: (id: string) => void;
  onUpdateWeek: (changes: {
    anmeldung?: any;
    plan?: any;
    feedback?: any;
  }) => void;
  onRename: (patch: Partial<Athlete>) => void;
}

function incWeek(week: string, delta: number) {
  // expects "YYYY-WW"
  const [y, w] = week.split("-").map(Number);
  const total = y * 100 + w + delta;
  let ny = Math.floor(total / 100);
  let nw = total % 100;
  if (nw <= 0) { ny -= 1; nw = 52 + nw; }
  if (nw > 53) { ny += Math.floor((nw-1)/52); nw = ((nw-1) % 52) + 1; }
  return `${ny}-${String(nw).padStart(2,"0")}`;
}

export default function AthleteDetail({
  athlete, week, onWeekChange, onBack, onRemove, onUpdateWeek, onRename
}: Props) {
  const [tab, setTab] = useState<Tab>("anmeldung");
  const days = ["Mo","Di","Mi","Do","Fr","Sa","So"] as const;

  const anmeldung = useMemo(() => athlete.anmeldung.find(w => w.week === week), [athlete, week]);
  const plan = useMemo(() => athlete.plaene.find(w => w.week === week), [athlete, week]);
  const feedback = useMemo(() => athlete.feedback.find(w => w.week === week), [athlete, week]);

  const [editName, setEditName] = useState(athlete.name);

  return (
    <div className={styles.detailWrap}>
      <div className={styles.detailHeader}>
        <button className={styles.ghostBtn} onClick={onBack}>← Zurück</button>
        <div className={styles.titleArea}>
          <input className={styles.titleInlineInput} value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => editName && editName !== athlete.name && onRename({ name: editName.trim() })} />
          <div className={styles.subtitle}>{athlete.leistungsgruppe ?? "—"} · {athlete.geburtsjahr ?? "—"}</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.dangerGhostBtn} onClick={() => onRemove(athlete.id)}>Löschen</button>
        </div>
      </div>

      <div className={styles.weekNav}>
        <button className={styles.ghostBtn} onClick={() => onWeekChange(incWeek(week, -1))}>‹</button>
        <span className={styles.weekLabel}>KW {week}</span>
        <button className={styles.ghostBtn} onClick={() => onWeekChange(incWeek(week, 1))}>›</button>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tabBtn} ${tab==="anmeldung" ? styles.tabActive : ""}`} onClick={() => setTab("anmeldung")}>Anmeldung</button>
        <button className={`${styles.tabBtn} ${tab==="plan" ? styles.tabActive : ""}`} onClick={() => setTab("plan")}>Trainingsplan</button>
        <button className={`${styles.tabBtn} ${tab==="feedback" ? styles.tabActive : ""}`} onClick={() => setTab("feedback")}>Rückmeldung</button>
        <button className={`${styles.tabBtn} ${tab==="statistik" ? styles.tabActive : ""}`} onClick={() => setTab("statistik")}>Statistik</button>
      </div>

      {tab === "anmeldung" && (
        <div className={styles.card}>
          <table className={styles.anmeldungTable}>
            <thead>
              <tr>
                {days.map(d => <th key={d}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map(d => {
                  const val = anmeldung?.anmeldung[d] ?? "?";
                  const note = anmeldung?.notizen?.[d] ?? "";
                  return (
                    <td key={d}>
                      <div className={styles.choiceGroup}>
                        <select
                          value={val}
                          onChange={(e) => onUpdateWeek({ anmeldung: { anmeldung: { [d]: e.target.value as "?"|"Ja"|"Nein" } } })}
                        >
                          <option value="?">?</option>
                          <option value="Ja">Ja</option>
                          <option value="Nein">Nein</option>
                        </select>
                        <button
                          className={`${styles.noteBtn} ${note ? styles.noteActive : ""}`}
                          title={note ? note : "Notiz hinzufügen"}
                          onClick={() => {
                            const next = prompt(`${d} Notiz`, note ?? "");
                            if (next !== null) {
                              onUpdateWeek({ anmeldung: { notizen: { [d]: next } } });
                            }
                          }}
                        >📝</button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "plan" && (
        <div className={styles.card}>
          <div className={styles.planList}>
            {(plan?.einheiten ?? []).map((e, idx) => (
              <div key={idx} className={styles.planRow}>
                <input
                  className={styles.dayInput}
                  value={e.tag}
                  onChange={(ev) => {
                    const copy: TrainingsplanEinheit[] = [...(plan?.einheiten ?? [])];
                    copy[idx] = { ...copy[idx], tag: ev.target.value };
                    onUpdateWeek({ plan: { einheiten: copy } });
                  }}
                  placeholder="Tag (z.B. Mo)"
                />
                <input
                  className={styles.flexInput}
                  value={e.inhalt}
                  onChange={(ev) => {
                    const copy: TrainingsplanEinheit[] = [...(plan?.einheiten ?? [])];
                    copy[idx] = { ...copy[idx], inhalt: ev.target.value };
                    onUpdateWeek({ plan: { einheiten: copy } });
                  }}
                  placeholder="Inhalt"
                />
                <input
                  className={styles.smallInput}
                  value={e.umfang ?? ""}
                  onChange={(ev) => {
                    const copy: TrainingsplanEinheit[] = [...(plan?.einheiten ?? [])];
                    copy[idx] = { ...copy[idx], umfang: ev.target.value };
                    onUpdateWeek({ plan: { einheiten: copy } });
                  }}
                  placeholder="Umfang"
                />
                <button className={styles.iconBtn} onClick={() => {
                  const copy = (plan?.einheiten ?? []).filter((_, i) => i !== idx);
                  onUpdateWeek({ plan: { einheiten: copy } });
                }}>✕</button>
              </div>
            ))}
          </div>
          <div className={styles.formActions}>
            <button className={styles.secondaryBtn} onClick={() => onUpdateWeek({ plan: { einheiten: [ ...(plan?.einheiten ?? []), { tag: "", inhalt: "", umfang: "" } ] } })}>
              + Einheit
            </button>
          </div>
        </div>
      )}

      {tab === "feedback" && (
        <div className={styles.card}>
          <textarea
            className={styles.textarea}
            value={feedback?.eintrag ?? ""}
            placeholder="Rückmeldung zur Woche…"
            onChange={(e) => onUpdateWeek({ feedback: { eintrag: e.target.value } })}
          />
          <div className={styles.ratingRow}>
            <label>Bewertung</label>
            <select
              value={feedback?.bewertung ?? ""}
              onChange={(e) => onUpdateWeek({ feedback: { bewertung: e.target.value ? Number(e.target.value) : undefined } })}
            >
              <option value="">—</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}

      {tab === "statistik" && (
        <div className={styles.card}>
          <div className={styles.statGrid}>
            {/* rudimentäre Kennzahlen */}
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Wochen erfasst</div>
              <div className={styles.statValue}>{athlete.anmeldung.length}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Ø Feedback</div>
              <div className={styles.statValue}>{avg((athlete.feedback ?? []).map(f => f.bewertung ?? 0)).toFixed(1)}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>„Ja“-Quote</div>
              <div className={styles.statValue}>{(yesRatio(athlete) * 100).toFixed(0)}%</div>
            </div>
          </div>
          <p className={styles.muted}>Hinweis: Für erweiterte Diagramme können wir später Recharts integrieren.</p>
        </div>
      )}
    </div>
  );
}

function avg(list: number[]) {
  const vals = list.filter(n => n > 0);
  if (!vals.length) return 0;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}

function yesRatio(a: Athlete) {
  const all = a.anmeldung.flatMap(w => Object.values(w.anmeldung));
  const yes = all.filter(v => v === "Ja").length;
  return all.length ? yes / all.length : 0;
}
