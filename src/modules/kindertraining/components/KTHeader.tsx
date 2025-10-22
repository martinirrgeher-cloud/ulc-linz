import "@/assets/styles/Header.css";
import React from "react";
import { Link } from "react-router-dom";

type Props = {
  week: string;
  prevWeek: () => void;
  nextWeek: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
};

export default function KTHeader({ week, prevWeek, nextWeek, onOpenSettings, onBack }: Props) {
  return (
    <div className="kt-header">
      {/* --- obere Leiste: Titel & Navigation --- */}
      <div className="kt-header-top">
        <div className="kt-header-left">
          <button className="header-btn" title="Zurück" onClick={onBack}>
            ←
          </button>
        </div>

        <div className="kt-header-center">
          <h2 className="kt-title">Kindertraining</h2>
        </div>

        <div className="kt-header-right">
          <button className="header-btn" title="Einstellungen" onClick={onOpenSettings}>
            ⚙︎
          </button>
        </div>
      </div>

      {/* --- untere Leiste: Kalender mittig, Statistik rechts --- */}
      
<div className="kt-header-bottom">
  <div className="kt-calendar-container">
    {/* Pfeile + Woche */}
    <div className="kt-calendar-row">
      <button className="calendar-btn" onClick={prevWeek} aria-label="Vorherige Woche">
        ‹
      </button>
      <span className="kw-label">Woche: {week}</span>
      <button className="calendar-btn" onClick={nextWeek} aria-label="Nächste Woche">
        ›
      </button>
    </div>

    {/* Statistik darunter */}
    <div className="kt-calendar-statistik">
      <Link to="/kindertraining/statistik" className="header-btn">
        📊 Statistik
      </Link>
    </div>
  </div>
</div>


    </div>
  );
}
