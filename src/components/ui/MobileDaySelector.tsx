type MobileDayOption = {
  id: string;
  label: string;
  dateLabel: string;
  meta?: string;
};

type Props = {
  label: string;
  options: MobileDayOption[];
  value: string;
  onChange: (value: string) => void;
};

export function MobileDaySelector({ label, options, value, onChange }: Props) {
  return (
    <div className="mobile-day-selector" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={value === option.id ? "active" : ""}
          onClick={() => onChange(option.id)}
          key={option.id}
        >
          <strong>{option.label}</strong>
          <small>{option.dateLabel}</small>
          {option.meta && <span>{option.meta}</span>}
        </button>
      ))}
    </div>
  );
}
