const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS_MON_FIRST = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Start der ISO-Woche (Montag) für ein Datum
export function startOfISOWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (date.getUTCDay() + 6) % 7; // 0..6 (Mo=0)
  date.setUTCDate(date.getUTCDate() - day);
  return new Date(date);
}

export function getISOWeekYear(d: Date): number {
  const date = startOfISOWeek(d);
  return date.getUTCFullYear();
}

export function getISOWeek(d: Date): number {
  // Algorithmus: https://en.wikipedia.org/wiki/ISO_week_date
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Donnerstag in dieser Woche ermitteln
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return weekNo;
}

type DayInfo = {
  isoDate: string;
  label: string;
  weekdayShort: string;
};

function formatDateLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function toIsoDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export function getDaysOfWeek(startDate: Date): DayInfo[] {
  const start = startOfISOWeek(startDate);
  const out: DayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({
      isoDate: toIsoDate(d),
      label: formatDateLabel(d),
      weekdayShort: WEEKDAYS_MON_FIRST[i],
    });
  }
  return out;
}
