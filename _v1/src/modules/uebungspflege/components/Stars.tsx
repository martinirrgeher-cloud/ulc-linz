import React from "react";

type Props = {
  value: number;
  onChange: (v: number) => void;
  max?: number;
};

const Star: React.FC<{ filled: boolean; onClick: () => void; label: string }> = ({ filled, onClick, label }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="btn btn--tiny"
    style={{ border: "none", background: "transparent", padding: 2, lineHeight: 1, cursor: "pointer" }}
  >
    <span style={{ fontSize: 20 }}>{filled ? "★" : "☆"}</span>
  </button>
);

export default function Stars({ value, onChange, max = 5 }: Props) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    const filled = i <= (value || 0);
    stars.push(<Star key={i} filled={filled} onClick={() => onChange(i)} label={`${i} von ${max}`} />);
  }
  return <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{stars}</div>;
}
