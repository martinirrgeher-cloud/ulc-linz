import React from "react";
import "../styles/Anmeldung.css";
import { Link } from "react-router-dom";

type Props = {
  weekLabel: string;
  weekRangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
};

export const Navigation: React.FC<Props> = ({
  weekLabel,
  weekRangeLabel,
  onPrev,
  onNext,
}) => {
  return (
    <div className="headerBar">
      <div className="headerLeft">
        <Link to="/dashboard" className="homeBtn" aria-label="Zum Dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-6v-7H10v7H4a1 1 0 0 1-1-1v-10.5z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        </Link>
        <div>
          <div className="kw">{weekLabel}</div>
          <div className="range">{weekRangeLabel}</div>
        </div>
      </div>
      <div className="navButtons">
        <button className="navBtn" onClick={onPrev} aria-label="Vorige Woche">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        </button>
        <button className="navBtn" onClick={onNext} aria-label="Nächste Woche">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
