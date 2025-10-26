import { useMemo, useState } from "react";
import { ISOWeekDay, Trainingsplan } from "../types/TrainingsplanTypes";
import styles from "../Trainingsplan.module.css";

interface Props {
  plan: Trainingsplan;
  tageMitJa: { day: ISOWeekDay; note?: string }[];
  selectedAthleteId: string;
}

const dayOrder: ISOWeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayLabels: Record<ISOWeekDay, string> = {
  mon: "Montag",
  tue: "Dienstag",
  wed: "Mittwoch",
  thu: "Donnerstag",
  fri: "Freitag",
  sat: "Samstag",
  sun: "Sonntag",
};

export default function DayView({ plan, tageMitJa }: Props) {
  const [dayIndex, setDayIndex] = useState(0); // Start mit Montag

  const currentDay = useMemo(() => dayOrder[dayIndex], [dayIndex]);
  const dayPlan = plan.days[currentDay];

  const nextDay = () => {
    setDayIndex((idx) => (idx + 1 >= dayOrder.length ? 0 : idx + 1));
  };

  const prevDay = () => {
    setDayIndex((idx) => (idx - 1 < 0 ? dayOrder.length - 1 : idx - 1));
  };

  // Prüfen, ob der Athlet für diesen Tag zugesagt hat
  const zusage = tageMitJa.some((t) => t.day === currentDay);

  return (
    <div className={styles.dayView}>
      {/* Tagesnavigation */}
      <div className={styles.dayNav}>
        <button onClick={prevDay} className={styles.navBtn}>←</button>
        <div className={styles.dayTitle}>
          {dayLabels[currentDay]} <br />
          <span className={styles.dayDate}>{dayPlan.dateISO}</span>
        </div>
        <button onClick={nextDay} className={styles.navBtn}>→</button>
      </div>

      {/* Hinweis wenn keine Zusage */}
      {!zusage && (
        <div className={styles.warning}>
          ⚠️ Der Athlet hat für diesen Tag keine Zusage abgegeben.
        </div>
      )}

      {/* Übungen anzeigen */}
      <div className={styles.exerciseList}>
        {dayPlan.items.length === 0 ? (
          <div className={styles.muted}>Keine Übungen geplant</div>
        ) : (
          dayPlan.items.map((it) => (
            <div key={it.id} className={styles.itemCard}>
              <div className={styles.itemTitle}>{it.name}</div>
              <div className={styles.itemMeta}>
                {it.wiederholungen && <span>WDH: {it.wiederholungen}</span>}
                {it.distanz && <span>Distanz: {it.distanz}</span>}
                {it.dauerSek && <span>Dauer: {it.dauerSek}s</span>}
                {it.stern && <span>{"★".repeat(it.stern)}</span>}
              </div>
              {it.notiz && <div className={styles.itemNote}>{it.notiz}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
