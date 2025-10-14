import { Link } from "react-router-dom";
import { useTrainingData } from "./hooks/useTrainingData";
import { useState, useMemo, useRef, useEffect } from "react";
import { Chart } from "chart.js/auto";
import styles from "./Kindertraining.module.css";

export default function Statistik() {
  const { data, update } = useTrainingData();
  const [statsTab, setStatsTab] = useState<"person" | "day">("day");

  // 🧭 hiddenDays persistieren
  const [hiddenDays, setHiddenDays] = useState<string[]>(data.hiddenDays ?? []);
  useEffect(() => {
    if (JSON.stringify(data.hiddenDays) !== JSON.stringify(hiddenDays)) {
      setHiddenDays(data.hiddenDays ?? []);
    }
  }, [data.hiddenDays]);

  const [statsStartMonth, setStatsStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statsEndMonth, setStatsEndMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const startDate = new Date(statsStartMonth + "-01");
  const endDate = new Date(statsEndMonth + "-01");
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(0);

  const visibleRecords = Object.entries(data.records).filter(([date]) => {
    const d = new Date(date);
    return d >= startDate && d <= endDate && !hiddenDays.includes(date);
  });

  const monthsInRange: string[] = useMemo(() => {
    const arr: string[] = [];
    const t = new Date(startDate);
    t.setDate(1);
    while (t <= endDate) {
      arr.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`);
      t.setMonth(t.getMonth() + 1);
    }
    return arr;
  }, [statsStartMonth, statsEndMonth]);

  // 📊 Statistik pro Person
  const statsPerPerson = useMemo(() => {
    const byPerson: Record<string, Record<string, number>> = {};
    data.people.forEach((p) => (byPerson[`${p.firstName} ${p.lastName}`.trim()] = {}));
    visibleRecords.forEach(([date, day]: any) => {
      const mKey = date.slice(0, 7);
      Object.entries(day).forEach(([name, checked]) => {
        if (!checked) return;
        byPerson[name] = byPerson[name] || {};
        byPerson[name][mKey] = (byPerson[name][mKey] || 0) + 1;
      });
    });
    return byPerson;
  }, [data.people, visibleRecords]);

  const totalsPerPerson = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(statsPerPerson).forEach(([name, months]) => {
      totals[name] = Object.values(months).reduce((a: number, b: number) => a + b, 0);
    });
    return totals;
  }, [statsPerPerson]);

  const maxTotal = useMemo(() => Math.max(0, ...Object.values(totalsPerPerson)), [totalsPerPerson]);

  // 📅 Statistik pro Tag
  const statsPerDay = useMemo(() => {
    const result: { date: string; count: number; note?: string }[] = [];
    visibleRecords.forEach(([date, day]: any) => {
      result.push({
        date,
        count: Object.values(day).filter(Boolean).length,
        note: data.notes?.[date],
      });
    });
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [visibleRecords, data.notes]);

  // 📈 Chart
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  useEffect(() => {
    if (statsTab === "day" && chartRef.current) {
      if (chartInstance.current) chartInstance.current.destroy();
      const labels = statsPerDay.map((r) => r.date);
      const values = statsPerDay.map((r) => r.count);
      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "Teilnehmer pro Training", data: values, backgroundColor: "#0b5cff" }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }
    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
      chartInstance.current = null;
    };
  }, [statsTab, statsPerDay]);

  // 🧭 Ausblenden speichern
  const hideDay = (date: string) => {
    const updated = [...new Set([...hiddenDays, date])];
    setHiddenDays(updated);
    update((d) => ({ ...d, hiddenDays: updated }));
  };

  const restoreDay = (date: string) => {
    const updated = hiddenDays.filter((d) => d !== date);
    setHiddenDays(updated);
    update((d) => ({ ...d, hiddenDays: updated }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.statistikHeader}>
        <Link to="/kindertraining">← Zurück</Link>

        <div className={styles.statistikDateFilter}>
          <label>Start:</label>
          <input type="month" value={statsStartMonth} onChange={(e) => setStatsStartMonth(e.target.value)} />
          <label>Ende:</label>
          <input type="month" value={statsEndMonth} onChange={(e) => setStatsEndMonth(e.target.value)} />
        </div>

        <div className={styles.statistikTabs}>
          <button onClick={() => setStatsTab("person")} className={statsTab === "person" ? "note-active" : ""}>
            Pro Person
          </button>
          <button onClick={() => setStatsTab("day")} className={statsTab === "day" ? "note-active" : ""}>
            Pro Tag
          </button>
        </div>
      </div>

      {/* 📊 PRO PERSON */}
      {statsTab === "person" && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.nameColSmall}>Name</th>
                <th>∑</th>
                {monthsInRange.map((m) => (
                  <th key={m}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(statsPerPerson)
                .sort((a, b) => (totalsPerPerson[b] || 0) - (totalsPerPerson[a] || 0))
                .map((name) => (
                  <tr key={name}>
                    <td className={styles.nameColSmall}>
                      {name} {totalsPerPerson[name] === maxTotal && maxTotal > 0 ? "⭐" : ""}
                    </td>
                    <td>{totalsPerPerson[name] || 0}</td>
                    {monthsInRange.map((m) => (
                      <td key={m}>{statsPerPerson[name][m] || 0}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 📅 PRO TAG */}
      {statsTab === "day" && (
        <div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>∑</th>
                  <th style={{ textAlign: "left" }}>Notiz</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {statsPerDay.map(({ date, note, count }) => (
                  <tr key={date}>
                    <td>{date}</td>
                    <td>{count}</td>
                    <td style={{ textAlign: "left" }}>
                      {note || <span style={{ opacity: 0.6 }}>(keine Notiz)</span>}
                    </td>
                    <td>
                      <button onClick={() => hideDay(date)} title="Training ausblenden">
                        👁️‍🗨️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20, height: 280 }}>
            <canvas ref={chartRef}></canvas>
          </div>

          {hiddenDays.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4>Ausgeblendete Trainings:</h4>
              <ul>
                {hiddenDays.sort().map((d) => (
                  <li key={d} style={{ display: "flex", justifyContent: "space-between", maxWidth: "300px" }}>
                    <span>{d}</span>
                    <button onClick={() => restoreDay(d)}>➕ Einblenden</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
