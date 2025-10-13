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
    weekdayShort: string;
  }[] = [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const weekday = getWeekdayNumber(d);
    const weekdayShort = weekdayNames[weekday - 1];

    days.push({
      date: d.toISOString().split("T")[0],
      dayNumber: day,
      weekday,
      weekdayShort,
    });
  }

  return days;
}

/**
 * Hilfsfunktion: Montag = 1 ... Sonntag = 7
 */
export function getWeekdayNumber(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getISOWeek(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getSessionsForMonth(
  startDate: Date,
  weekdays: number[] | Record<number, boolean> | undefined | null
): Date[] {
  const result: Date[] = [];

  // 🧱 Absicherung: wenn nichts da ist → leeres Array zurückgeben
  if (!weekdays) {
    console.warn("⚠️ weekdays ist leer oder undefined → keine Termine erzeugt");
    return result;
  }

  // Kompatibilität sicherstellen
  let days: number[];
  if (Array.isArray(weekdays)) {
    days = weekdays;
  } else if (typeof weekdays === "object" && weekdays !== null) {
    days = Object.keys(weekdays)
      .filter((k) => weekdays[Number(k)] === true)
      .map((k) => Number(k));
  } else {
    console.warn("⚠️ Unerwarteter Typ für weekdays:", weekdays);
    return result;
  }

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
