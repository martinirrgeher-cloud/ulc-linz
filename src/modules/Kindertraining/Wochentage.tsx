import { Link } from "react-router-dom";
import { useTrainingData } from "./hooks/useTrainingData";
import { getMonthKey } from "./utils/dateUtils";
import { useMemo, useState } from "react";

export default function Wochentage() {
  const { data, update } = useTrainingData();

  const [monthStart, setMonthStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const currentMonthKey = useMemo(() => getMonthKey(monthStart), [monthStart]);

  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const mapping = [1, 2, 3, 4, 5, 6, 0];
  const selected = data.weekdaysByMonth?.[currentMonthKey] ?? [2];

  const toggle = (d: number) => {
    const set = new Set(selected);
    if (set.has(d)) set.delete(d);
    else set.add(d);

    update((prev) => ({
      ...prev,
      weekdaysByMonth: {
        ...(prev.weekdaysByMonth || {}),
        [currentMonthKey]: Array.from(set).sort(),
      },
    }));
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/kindertraining">← Zurück</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}>◀</button>
          <strong>
            {monthStart.toLocaleDateString(undefined, { year: "numeric", month: "long" })}
          </strong>
          <button onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}>▶</button>
        </div>
      </div>

      <div style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 12,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}>
        {labels.map((l, i) => {
          const d = mapping[i];
          return (
            <label key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
              {l}
            </label>
          );
        })}
      </div>
    </div>
  );
}
