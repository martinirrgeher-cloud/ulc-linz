// src/lib/dateUtils.ts
// ISO-8601 Kalenderwochen (Montag = Wochenstart). Wochen-Key: "YYYY-Www"

export type ISOWeek = { year: number; week: number };

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

export function toWeekKey(year: number, week: number): string {
  return `${year}-W${pad2(week)}`;
}

export function getISOWeek(date: Date): ISOWeek {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Donnerstag als Anker
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function getCurrentISOWeekKey(): string {
  const { year, week } = getISOWeek(new Date());
  return toWeekKey(year, week);
}

export function shiftWeek(weekKey: string, delta: number): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) throw new Error(`Invalid weekKey: ${weekKey}`);
  let year = parseInt(m[1], 10);
  let week = parseInt(m[2], 10) + delta;
  // Wochenanzahl des Jahres (ISO: Woche 1 ist die Woche mit dem 4. Januar)
  const weeksInYear = (y: number) => {
    const dec28 = new Date(Date.UTC(y, 11, 28));
    return getISOWeek(dec28).week;
  };
  while (week < 1) { year -= 1; week += weeksInYear(year); }
  while (week > weeksInYear(year)) { week -= weeksInYear(year); year += 1; }
  return toWeekKey(year, week);
}

export function getPreviousWeek(weekKey: string): string { return shiftWeek(weekKey, -1); }
export function getNextWeek(weekKey: string): string { return shiftWeek(weekKey, +1); }

// Bequeme Datumsarithmetik auf ISO-Strings (YYYY-MM-DD)
export function addDaysLocal(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
