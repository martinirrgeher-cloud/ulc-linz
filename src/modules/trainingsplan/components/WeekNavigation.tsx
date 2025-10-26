import styles from "../Trainingsplan.module.css";
import { WeekKey } from "../types/TrainingsplanTypes";
import { Athlete } from "../types/AthletTypes";

interface Props {
  week: WeekKey;
  onPrev: () => void;
  onNext: () => void;
  athletes: Athlete[];
  selectedAthleteId: string | null;
  onAthleteChange: (id: string | null) => void;
}

export default function WeekNavigation({
  week,
  onPrev,
  onNext,
  athletes,
  selectedAthleteId,
  onAthleteChange,
}: Props) {
  return (
    <div className={styles.weekNav}>
      <button onClick={onPrev} className={styles.navBtn}>←</button>
      <div className={styles.weekTitle}>
        KW {String(week.isoWeek).padStart(2, "0")} · {week.year}
      </div>
      <button onClick={onNext} className={styles.navBtn}>→</button>

      <select
        className={styles.athleteSelect}
        value={selectedAthleteId ?? ""}
        onChange={(e) =>
          onAthleteChange(e.target.value === "" ? null : e.target.value)
        }
      >
        <option value="">– Athlet wählen –</option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
