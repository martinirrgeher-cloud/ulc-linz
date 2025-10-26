import styles from "../Trainingsplan.module.css";
import { ISOWeekDay } from "../types/TrainingsplanTypes";

interface AbsenceEntry {
  day: ISOWeekDay;
  note?: string;
}

const dayLabels: Record<ISOWeekDay, string> = {
  mon: "Montag",
  tue: "Dienstag",
  wed: "Mittwoch",
  thu: "Donnerstag",
  fri: "Freitag",
  sat: "Samstag",
  sun: "Sonntag",
};

interface Props {
  absences: AbsenceEntry[];
}

export default function AbsencesList({ absences }: Props) {
  if (!absences || absences.length === 0) return null;

  return (
    <div className={styles.absences}>
      <strong>Abwesenheiten:</strong>
      <ul>
        {absences.map((a) => (
          <li key={a.day}>
            {dayLabels[a.day]} – {a.note || "keine Notiz"}
          </li>
        ))}
      </ul>
    </div>
  );
}
