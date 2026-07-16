// Lightweight date helpers (ISO week friendly where needed)
export function toISODate(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function weekRangeFrom(isoStart: string): string[] {
  return Array.from({length:7}, (_,i)=>addDays(isoStart, i));
}

export function startOfISOWeek(d: Date): string {
  const day = d.getDay() || 7; // Sun -> 0 => 7
  const start = new Date(d);
  start.setDate(d.getDate() - (day - 1));
  return toISODate(start);
}
