import React from "react";
import styles from "../Athleten.module.css";
import { Athlete } from "../types/athleten";

interface Props {
  athlete: Athlete;
}

export default function AthleteStats({ athlete }: Props) {
  const totalWeeks = athlete.anmeldung.length;
  const yes = athlete.anmeldung.reduce((acc, w) => acc + Object.values(w.anmeldung).filter(v => v === "Ja").length, 0);
  const all = athlete.anmeldung.reduce((acc, w) => acc + Object.values(w.anmeldung).length, 0);
  const ratio = all ? Math.round(100 * yes / all) : 0;

  return (
    <div className={styles.card}>
      <div className={styles.statGrid}>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>Wochen erfasst</div>
          <div className={styles.statValue}>{totalWeeks}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>„Ja“-Quote</div>
          <div className={styles.statValue}>{ratio}%</div>
        </div>
      </div>
    </div>
  );
}
