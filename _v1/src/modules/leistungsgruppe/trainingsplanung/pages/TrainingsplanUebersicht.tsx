// src/modules/leistungsgruppe/trainingsplanung/pages/TrainingsplanUebersicht.tsx
import React, { useEffect, useMemo, useState } from "react";
import "../styles/Trainingsplanung.css";
import {
  startOfISOWeek as startOfISOWeekStr,
  weekRangeFrom,
  addDays,
} from "../../common/date";
import { loadAthleten } from "../../../athleten/services/AthletenStore";
import type { Athlete } from "../../../athleten/types/athleten";
import {
  loadAnmeldung,
  DayStatus,
  AnmeldungData,
} from "../../anmeldung/services/AnmeldungStore";
import {
  loadPlans,
  type PlanDay,
  type PlanBlock,
  type PlansByAthlete,
} from "../services/TrainingsplanungStore";

type AthleteLite = {
  id: string;
  name: string;
  active?: boolean;
};

function startOfISOWeek(date: Date): string {
  return startOfISOWeekStr(date);
}

function formatAthleteName(a: Athlete): string {
  if (a.firstName || a.lastName) {
    return `${a.lastName ?? ""} ${a.firstName ?? ""}`.trim();
  }
  return a.name ?? a.id;
}

function toAthleteLite(a: Athlete): AthleteLite {
  return {
    id: a.id,
    name: formatAthleteName(a),
    active: a.active ?? true,
  };
}

function computeTotalMinutes(day: PlanDay | null | undefined): number {
  if (!day || !day.blocks || !day.blockOrder) return 0;

  return day.blockOrder.reduce((sum, id) => {
    const blk: PlanBlock | undefined = day.blocks![id];
    const val = blk?.targetDurationMin;
    if (val == null || Number.isNaN(val)) return sum;
    return sum + Number(val);
  }, 0);
}

function statusClassForCell(s: DayStatus | null | undefined): string {
  if (!s) return "tp-overview-cell none";

  const v = s.toString().toUpperCase();

  if (v === "YES") return "tp-overview-cell yes"; // JA → grün
  if (v === "NO") return "tp-overview-cell no"; // NEIN → rot
  if (v === "MAYBE" || v === "?") return "tp-overview-cell maybe"; // ? → grau

  return "tp-overview-cell none";
}

const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TrainingsplanUebersicht: React.FC = () => {
  const [athletes, setAthletes] = useState<AthleteLite[]>([]);
  const [plansByAthlete, setPlansByAthlete] = useState<PlansByAthlete>({});
  const [anmeldung, setAnmeldung] = useState<AnmeldungData | null>(null);

  const [weekStartISO, setWeekStartISO] = useState<string>(() =>
    startOfISOWeek(new Date())
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);

        // Athleten
        try {
          const ath = await loadAthleten();
          if (!cancelled) {
            const lite = ath
              .map(toAthleteLite)
              .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
            setAthletes(lite);
          }
        } catch (err) {
          console.error("Trainingsplan Übersicht: loadAthleten fehlgeschlagen", err);
        }

        // Pläne
        try {
          const data = await loadPlans();
          if (!cancelled) {
            setPlansByAthlete(data.plansByAthlete ?? {});
          }
        } catch (err) {
          console.error("Trainingsplan Übersicht: loadPlans fehlgeschlagen", err);
          if (!cancelled) {
            setPlansByAthlete({});
          }
        }

        // Anmeldung
        try {
          const a = await loadAnmeldung();
          if (!cancelled) setAnmeldung(a);
        } catch (err) {
          console.error("Trainingsplan Übersicht: loadAnmeldung fehlgeschlagen", err);
        }
      } catch (err) {
        console.error("Trainingsplan Übersicht: Unerwarteter Fehler", err);
        if (!cancelled) setError("Fehler beim Laden der Daten.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();

    return () => {
      cancelled = true;
    };
  }, []);

  const weekDates: string[] = useMemo(
    () => weekRangeFrom(weekStartISO),
    [weekStartISO]
  );

  const weekLabel = useMemo(() => {
    const d = new Date(weekStartISO + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "";

    const jan1 = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - jan1.getTime();
    const day = Math.floor(diff / (1000 * 60 * 60 * 24));
    const kw = Math.floor((day + jan1.getDay()) / 7) + 1;
    return `KW${kw.toString().padStart(2, "0")} - ${d.getFullYear()}`;
  }, [weekStartISO]);

  const handlePrevWeek = () => {
    setWeekStartISO(
      startOfISOWeek(new Date(addDays(weekStartISO, -7) + "T00:00:00"))
    );
  };

  const handleNextWeek = () => {
    setWeekStartISO(
      startOfISOWeek(new Date(addDays(weekStartISO, 7) + "T00:00:00"))
    );
  };

  const statusMap = useMemo(() => {
    const result: Record<string, DayStatus | null | undefined> = {};
    if (!anmeldung) return result;
    const statuses = (anmeldung as any).statuses ?? {};
    for (const [key, val] of Object.entries(statuses)) {
      if (typeof val === "string" || val === null) {
        result[key] = val as DayStatus | null;
      }
    }
    return result;
  }, [anmeldung]);

  if (loading) {
    return (
      <div className="tp-root">
        <div className="tp-info">Trainingsplan Übersicht wird geladen …</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tp-root">
        <div className="tp-info">{error}</div>
      </div>
    );
  }

  return (
    <div className="tp-root">
      <div className="tp-header">
        <div className="tp-week-nav">
          <button type="button" className="tp-btn" onClick={handlePrevWeek}>
            ◀
          </button>
          <div className="tp-week-label">{weekLabel}</div>
          <button type="button" className="tp-btn" onClick={handleNextWeek}>
            ▶
          </button>
        </div>
      </div>

      <div className="tp-body">
        <div className="tp-overview-wrapper">
          <table className="tp-overview-table">
            <thead>
              <tr>
                <th className="tp-overview-athlete-col">Athlet</th>
                {weekDates.map((d, idx) => {
                  const dateObj = new Date(d + "T00:00:00");
                  const weekdayIndex = (dateObj.getDay() + 6) % 7; // Mo=0
                  const label = weekdayLabels[weekdayIndex] ?? "";
                  const day = dateObj.getDate().toString().padStart(2, "0");
                  const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
                  return (
                    <th key={d}>
                      {label} <br />
                      {day}.{month}.
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {athletes.map((a) => (
                <tr key={a.id}>
                  <td className="tp-overview-athlete-cell">
                    {a.name}
                    {a.active === false ? " (inaktiv)" : ""}
                  </td>
                  {weekDates.map((d) => {
                    const key = `${a.id}:${d}`;
                    const status = statusMap[key];
                    const dayPlan: PlanDay | undefined =
                      plansByAthlete[a.id]?.[d];
                    const minutes = computeTotalMinutes(dayPlan);

                    return (
                      <td key={d} className={statusClassForCell(status)}>
                        {minutes > 0 ? minutes : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrainingsplanUebersicht;
