import { Link } from "react-router-dom";
import { useTrainingData } from "./hooks/useTrainingData";
import { getMonthKey } from "./utils/dateUtils";
import { useMemo, useState } from "react";

export default function Wochentage() {
  const { data, update } = useTrainingData();

  // optional: Monat wählbar machen (Standard: aktueller Monat)
  const [monthStart, setMonthStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const currentMonthKey = useMemo(() => getMonthKey(monthStart), [monthStart]);

  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const mapping = [1, 2, 3, 4, 5, 6, 0];

  const selected = data.weekdaysByMonth?.[currentMonthKey] ?? [2];

  const toggle = (day: number) => {
    const newDays = selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day];
    update((prev) => ({
      ...prev,
      weekdaysByMonth: { ...(prev.weekdaysByMonth || {}), [currentMonthKey]: newDays.sort() },
    }));
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h1>🗓️ Wochentage konfigurieren</h1>
        <Link to="/kindertraining" className="ghost">⬅️ Zurück</Link>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <label><strong>Monat wählen:</strong> </label>
        <input
          type="month"
          value={`${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setMonthStart(new Date(y, m - 1, 1));
          }}
        />
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {labels.map((l, i) => {
            const d = mapping[i];
            return (
              <label key={d} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
                {l}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
