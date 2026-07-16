// src/modules/leistungsgruppe/trainingsdoku/components/TdHeader.tsx
import React from "react";

type TdHeaderProps = {
  athletes: { id: string; name: string; active: boolean }[];
  athleteId: string;
  dateISO: string;
  overallStats: { total: number; done: number };
  onAthleteChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const TdHeader: React.FC<TdHeaderProps> = ({
  athletes,
  athleteId,
  dateISO,
  overallStats,
  onAthleteChange,
  onDateChange,
}: TdHeaderProps) => {
  return (
    <>
      <div className="td-top-row">
        <div className="td-athlete-select">
          <label htmlFor="td-athlete">Athlet</label>
          <select
            id="td-athlete"
            value={athleteId}
            onChange={onAthleteChange}
          >
            <option value="">– bitte wählen –</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="td-date-picker">
          <label htmlFor="td-date">Datum</label>
          <input
            id="td-date"
            type="date"
            value={dateISO}
            onChange={onDateChange}
          />
        </div>
      </div>

      <div className="td-summary-row">
        {overallStats.total > 0 ? (
          <span>
            {overallStats.done}/{overallStats.total} Übungen erledigt
          </span>
        ) : (
          <span>Keine Übungen für diesen Tag</span>
        )}
      </div>
    </>
  );
};

export default TdHeader;
