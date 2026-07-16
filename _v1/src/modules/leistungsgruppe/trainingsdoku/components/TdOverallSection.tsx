// src/modules/leistungsgruppe/trainingsdoku/components/TdOverallSection.tsx
import React from "react";

type TdOverallSectionProps = {
  overallRpe: number;
  overallMood: string;
  overallNote: string;
  onChangeMood: (value: string) => void;
  onChangeNote: (value: string) => void;
};

const TdOverallSection: React.FC<TdOverallSectionProps> = ({
  overallMood,
  overallNote,
  onChangeMood,
  onChangeNote,
}: TdOverallSectionProps) => {
  return (
    <section className="td-overall">
      <h2 className="td-section-title">Tagesfeedback</h2>
      <div className="td-overall-row">
        <label>Tagesverfassung</label>
        <select
          value={overallMood}
          onChange={(e) => onChangeMood(e.target.value)}
        >
          <option value="">–</option>
          <option value="great">😊 gut</option>
          <option value="ok">😐 ok</option>
          <option value="tired">🥱 müde</option>
        </select>
      </div>

      <div className="td-overall-row">
        <label>Tagesnotiz</label>
        <textarea
          rows={3}
          value={overallNote}
          onChange={(e) => onChangeNote(e.target.value)}
        />
      </div>
    </section>
  );
};

export default TdOverallSection;
