import { Link } from "react-router-dom";
import { useTrainingData } from "./hooks/useTrainingData";
import { useState, useMemo, useRef, useEffect } from "react";
import { Chart } from "chart.js/auto";

export default function Statistik() {
  const { data } = useTrainingData();

  const [statsStartMonth, setStatsStartMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statsEndMonth, setStatsEndMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statsTab, setStatsTab] = useState<"person" | "day">("person");

  const startDate = new Date(statsStartMonth + "-01");
  const endDate = new Date(statsEndMonth + "-01");
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(0);

  const filteredRecords = Object.entries(data.records).filter(([date]) => {
    const d = new Date(date);
    return d >= startDate && d <= endDate;
  });

  // Monate im Zeitraum
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

  // Statistik pro Person (Gesamt + je Monat)
  const statsPerPerson = useMemo(() => {
    const byPerson: Record<string, Record<string, number>> = {};
    data.people.forEach((p) => (byPerson[`${p.firstName} ${p.lastName}`.trim()] = {}));
    filteredRecords.forEach(([date, day]: any) => {
      const mKey = date.slice(0, 7);
      Object.entries(day).forEach(([name, checked]) => {
        if (checked) byPerson[name][mKey] = (byPerson[name][mKey] || 0) + 1;
      });
    });
    return byPerson;
  }, [data, statsStartMonth, statsEndMonth]);

  const totalsPerPerson = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(statsPerPerson).forEach(([name, months]) => {
      totals[name] = Object.values(months).reduce((a: number, b: number) => a + b, 0);
    });
    return totals;
  }, [statsPerPerson]);

  const maxTotal = useMemo(() => Math.max(0, ...Object.values(totalsPerPerson)), [totalsPerPerson]);

  // Statistik pro Tag (+ Notiz)
  const statsPerDay = useMemo(() => {
    const result: { date: string; count: number; note?: string }[] = [];
    filteredRecords.forEach(([date, day]: any) => {
      result.push({
        date,
        count: Object.values(day).filter(Boolean).length,
        note: data.notes?.[date],
      });
    });
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, statsStartMonth, statsEndMonth]);

  // Chart.js für Tagesansicht
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
        options: { responsive: true, plugins: { legend: { display: false } } },
      });
    }
  }, [statsTab, statsPerDay]);

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h1>📊 Statistik</h1>
        <Link to="/kindertraining" className="ghost">⬅️ Zurück</Link>
      </div>

      {/* Zeitraum */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label>Von Monat:</label>
            <input type="month" value={statsStartMonth} onChange={(e) => setStatsStartMonth(e.target.value)} />
          </div>
          <div>
            <label>Bis Monat:</label>
            <input type="month" value={statsEndMonth} onChange={(e) => setStatsEndMonth(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className={`ghost ${statsTab === "person" ? "note-active" : ""}`} onClick={() => setStatsTab("person")}>
            👤 pro Person
          </button>
          <button className={`ghost ${statsTab === "day" ? "note-active" : ""}`} onClick={() => setStatsTab("day")}>
            📅 pro Tag
          </button>
        </div>
      </div>

      {/* Ansicht pro Person: Gesamt + je Monat, ⭐ für Bestwert */}
      {statsTab === "person" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Gesamt</th>
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
                    <td>
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

      {/* Ansicht pro Tag: inkl. Notizen */}
      {statsTab === "day" && (
        <div className="card">
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Teilnehmer</th>
              </tr>
            </thead>
            <tbody>
              {statsPerDay.map(({ date, count, note }) => (
                <tr key={date}>
                  <td>
                    {date}
                    {note && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#555",
                          background: "#f0f4ff",
                          padding: "6px 8px",
                          marginTop: 6,
                          borderRadius: 6,
                          border: "1px solid #d7e2ff",
                          lineHeight: 1.35,
                        }}
                      >
                        📝 {note}
                      </div>
                    )}
                  </td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 20 }}>
            <canvas ref={chartRef}></canvas>
          </div>
        </div>
      )}
    </div>
  );
}
