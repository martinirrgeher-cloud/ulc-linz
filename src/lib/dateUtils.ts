function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Lokale Datumsarithmetik – korrekt für ISO-Strings
export function addDaysLocal(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ISO-Kalenderwoche nach ISO 8601 (Montag = Wochenstart)
export function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const diff = d.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

export function getISOWeekYear(date: Date): number {
  const d = new Date(date);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  return d.getFullYear();
}

export function toWeekKey(year: number, week: number): string {
  return `${year}-${pad2(week)}`;
}

export function getCurrentWeek(): string {
  const { year, week } = getISOWeek(new Date());
  return toWeekKey(year, week);
}

export function getWeekLabel(weekKey: string): string {
  const [y, w] = weekKey.split("-");
  return `KW ${w}/${y}`;
}

export function shiftWeek(weekKey: string, delta: number): string {
  const [y, w] = weekKey.split("-").map(Number);
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = new Date(simple);
  const diff = (dow <= 4 ? dow - 1 : dow - 8);
  ISOweekStart.setUTCDate(simple.getUTCDate() - diff);
  ISOweekStart.setUTCDate(ISOweekStart.getUTCDate() + delta * 7);
  const { year, week } = getISOWeek(ISOweekStart);
  return toWeekKey(year, week);
}

export function getPreviousWeek(weekKey: string): string {
  return shiftWeek(weekKey, -1);
}
export function getNextWeek(weekKey: string): string {
  return shiftWeek(weekKey, +1);
}


