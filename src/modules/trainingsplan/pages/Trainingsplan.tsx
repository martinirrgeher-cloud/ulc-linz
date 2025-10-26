import { useContext, useState } from "react";
import useTrainingsplan from "../hooks/useTrainingsplan";
import AuthContext from "@/store/AuthContext";
import useAthleten from "@/modules/athleten/hooks/useAthleten";
import useAnmeldungen from "../hooks/useAnmeldungen";
import WeekNavigation from "../components/WeekNavigation";
import AbsencesList from "../components/AbsencesList";
import DayView from "../components/DayView";
import styles from "../Trainingsplan.module.css";
import { Link } from "react-router-dom";

export default function TrainingsplanPage() {
  const { user } = useContext(AuthContext);
  const { week, plan, goPrevWeek, goNextWeek } = useTrainingsplan();

  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  const { athletes } = useAthleten();
  const { tageMitJa, tageOhneJa } = useAnmeldungen(
    selectedAthleteId,
    week.isoWeek,
    week.year
  );

  if (!user) {
    return <div className={styles.container}>Bitte zuerst einloggen.</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
  <Link to="/dashboard" className={styles.homeIcon}>🏠</Link>
  <div className={styles.headerTitle}>Trainingsplanung</div>
  <span>⚙️</span>
</div>

      {/* Woche + Athlet */}
      <WeekNavigation
        week={week}
        onPrev={goPrevWeek}
        onNext={goNextWeek}
        athletes={athletes}
        selectedAthleteId={selectedAthleteId}
        onAthleteChange={setSelectedAthleteId}
      />

      {/* Abwesenheiten */}
      {selectedAthleteId && <AbsencesList absences={tageOhneJa} />}

      {/* Hinweis */}
      {!selectedAthleteId && (
        <div className={styles.placeholder}>
          Bitte einen Athleten auswählen.
        </div>
      )}

      {/* Tagesansicht */}
      {selectedAthleteId && plan && (
        <DayView
          plan={plan}
          tageMitJa={tageMitJa}
          selectedAthleteId={selectedAthleteId}
        />
      )}
    </div>
  );
}
