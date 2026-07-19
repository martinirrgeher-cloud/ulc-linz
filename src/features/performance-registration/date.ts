export const PERFORMANCE_WEEKDAY_LABELS: Record<number, string> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
  7: "So",
};

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

export function startOfIsoWeek(value: Date | string): string {
  const date = typeof value === "string" ? parseIsoDate(value) : new Date(value);
  date.setHours(12, 0, 0, 0);
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (weekday - 1));
  return isoDate(date);
}

export function addDays(value: string, amount: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

export function addWeeks(value: string, amount: number): string {
  return addDays(value, amount * 7);
}

export function formatWeekRange(weekStart: string): string {
  const weekEnd = parseIsoDate(addDays(weekStart, 6));
  const start = parseIsoDate(weekStart);
  const sameMonth = start.getMonth() === weekEnd.getMonth();
  const startText = new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    ...(sameMonth ? {} : { month: "short" }),
  }).format(start);
  const endText = new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(weekEnd);
  return `${startText}–${endText}`;
}

export function formatTrainingDate(value: string): string {
  return new Intl.DateTimeFormat("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(parseIsoDate(value));
}

export function isoWeekNumber(value: string): number {
  const date = parseIsoDate(value);
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function isCurrentWeek(weekStart: string): boolean {
  return weekStart === startOfIsoWeek(new Date());
}
