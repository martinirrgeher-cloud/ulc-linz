import TagesPlan from "./TagesPlan";
import styles from "../styles/Trainingsplan.module.css";
import { useTrainingsplan } from "../hooks/useTrainingsplan";

export default function PlanEditor({ plan, athletId, kw, jahr }: any) {
  const { savePlan } = useTrainingsplan();

  if (!plan) return null;

  const handleChange = (tage: any[]) => {
    savePlan(athletId, kw, jahr, { ...plan, tage });
  };

  return (
    <div className={styles.planEditor}>
      {plan.tage.length === 0 && (
        <p>Keine Tage vorhanden – bitte zuerst über Anmeldung erzeugen oder manuell hinzufügen.</p>
      )}
      {plan.tage.map((tag: any, i: number) => (
        <TagesPlan key={i} tag={tag} onChange={(updated) => {
          const neueTage = [...plan.tage];
          neueTage[i] = updated;
          handleChange(neueTage);
        }} />
      ))}
    </div>
  );
}
