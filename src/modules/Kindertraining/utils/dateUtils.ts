// src/modules/Kindertraining/utils/dateUtils.ts

export function fmtISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Liefert alle Tage des aktuellen Monats
 */
export function getCurrentMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days: {
    date: string;
    dayNumber: number;
    weekday: number;
  }[] = [];

  const numDays = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= numDays; d++) {
    const day = new Date(year, month, d);
    days.push({
      date: fmtISO(day),
      dayNumber: d,
      weekday: day.getDay(),
    });
  }
  return days;
}

export function getISOWeek(date: Date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
}

/** YYYY-MM */
export function getMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Liefert alle Trainingstermine im Monat, deren weekday (0-6) in `days` enthalten ist */
export function getSessionsForMonth(startDate: Date, days: number[]) {
  const result: Date[] = [];
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const current = new Date(year, month, day);
    const wd = current.getDay(); // 0 = Sonntag, 1 = Montag, ...
    if (days.includes(wd)) {
      result.push(current);
    }
  }

  return result;
}
