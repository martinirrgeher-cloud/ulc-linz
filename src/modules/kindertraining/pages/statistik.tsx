import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";


export default function Statistik() {
  const [mode, setMode] = useState<"perChild" | "perTraining">("perChild");
  const [trainingData, setTrainingData] = useState<any>(null);
  const navigate = useNavigate();

  // 🟡 Daten aus Google Drive laden
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("google_access_token");
        const fileId = import.meta.env.VITE_DRIVE_KINDERTRAINING_FILE_ID;

        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) throw new Error(`Fehler beim Laden: ${res.status}`);
        const data = await res.json();
        setTrainingData(data);
      } catch (err) {
        console.error("Fehler beim Laden der Statistikdaten", err);
      }
    };

    fetchData();
  }, []);

  // 🧒 Auswertung: Teilnahmen pro Kind
  const attendancePerChild = useMemo(() => {
    if (!trainingData) return [];
    const counts: Record<string, number> = {};

    Object.values(trainingData.personsByWeek || {}).forEach((week: any) => {
      week.forEach((entry: any) => {
        const attendedDays = Object.values(entry.attendance).filter(Boolean).length;
        counts[entry.name] = (counts[entry.name] ?? 0) + attendedDays;
      });
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [trainingData]);

  // 📅 Auswertung: Trainingsübersicht
  const attendancePerTraining = useMemo(() => {
    if (!trainingData) return [];
    const map: Record<string, { sum: number; note: string }> = {};

    Object.entries(trainingData.personsByWeek || {}).forEach(([_, weekEntries]) => {
      (weekEntries as any[]).forEach((entry) => {
        Object.entries(entry.attendance).forEach(([day, present]) => {
          if (present) {
            if (!map[day]) map[day] = { sum: 0, note: "" };
            map[day].sum += 1;
          }
        });
      });
    });

    Object.entries(trainingData.weekMeta || {}).forEach(([_, meta]: any) => {
      Object.entries(meta.dayNotes || {}).forEach(([day, note]) => {
        if (!map[day]) map[day] = { sum: 0, note };
        else map[day].note = note;
      });
    });

    return Object.entries(map)
      .map(([day, { sum, note }]) => ({ day, sum, note }))
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [trainingData]);

  return (
    <div className="statistics-page">
      {/* 📌 Sticky Header */}
      <div className="stats-header-sticky">
        <button className="back-btn" onClick={() => navigate("/kindertraining")}>
          &lt;
        </button>
        <div className="stats-header">
          <button
            className={mode === "perChild" ? "active" : ""}
            onClick={() => setMode("perChild")}
          >
            🧒 Teilnahmen pro Kind
          </button>
          <button
            className={mode === "perTraining" ? "active" : ""}
            onClick={() => setMode("perTraining")}
          >
            📅 Trainingsübersicht
          </button>
        </div>
      </div>

      {!trainingData && <p>Daten werden geladen …</p>}

      {mode === "perChild" && trainingData && (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Anzahl Teilnahmen</th>
            </tr>
          </thead>
          <tbody>
            {attendancePerChild.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {mode === "perTraining" && trainingData && (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Anwesende Kinder</th>
              <th>Notiz</th>
            </tr>
          </thead>
          <tbody>
            {attendancePerTraining.map((row) => (
              <tr key={row.day}>
                <td>{row.day}</td>
                <td>{row.sum}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
