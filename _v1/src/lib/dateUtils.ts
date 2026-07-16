// src/lib/dateUtils.ts
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Lokale Datumsarithmetik – korrekt für ISO-Strings (YYYY-MM-DD)
export function addDaysLocal(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ISO 8601: Montag = 1, KW 1 ist die Woche mit dem 4. Januar
export function getISOWeekYear(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Donnerstag der aktuellen Woche als Referenz
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((+d - +yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return { year, week };
}

export function toWeekKey(year: number, week: number): string {
  return `${year}-W${pad2(week)}`;
}

export function parseWeekKey(weekKey: string): { year: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) throw new Error(`Ungültiges WeekKey-Format: ${weekKey}`);
  return { year: Number(m[1]), week: Number(m[2]) };
}

export function shiftWeek(weekKey: string, delta: number): string {
  const { year, week } = parseWeekKey(weekKey);
  // Montag der Zielwoche bestimmen:
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - (dow - 1)); // auf Montag
  monday.setUTCDate(monday.getUTCDate() + delta * 7); // Wochen verschieben
  const r = getISOWeekYear(monday);
  return toWeekKey(r.year, r.week);
}

export function getPreviousWeek(weekKey: string): string {
  return shiftWeek(weekKey, -1);
}
export function getNextWeek(weekKey: string): string {
  return shiftWeek(weekKey, +1);
}
