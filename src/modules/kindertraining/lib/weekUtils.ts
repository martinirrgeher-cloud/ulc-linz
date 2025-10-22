import { startOfISOWeek, addDays, format } from "date-fns";

/**
 * Liefert den aktuellen ISO-Kalenderwochen-String im Format YYYY-KWNN.
 */
export function getCurrentWeek(): string {
  const now = new Date();
  return formatIsoWeekString(now);
}

/**
 * Liefert alle Trainingsdaten (yyyy-MM-dd) einer bestimmten ISO-KW und Wochentage.
 */
export function getDatesForWeekdays(weekdays: string[], week: string): string[] {
  const [yearStr, weekStr] = week.split("-KW");
  const year = parseInt(yearStr);
  const weekNumber = parseInt(weekStr);

  // Montag der ISO-Woche berechnen
  const monday = startOfISOWeek(new Date(year, 0, 4 + (weekNumber - 1) * 7));

  const map: Record<string, number> = {
    Montag: 0,
    Dienstag: 1,
    Mittwoch: 2,
    Donnerstag: 3,
    Freitag: 4,
    Samstag: 5,
    Sonntag: 6,
  };

  return weekdays.map((wd) => {
    const offset = map[wd];
    const d = addDays(monday, offset);
    return format(d, "yyyy-MM-dd");
  });
}

/**
 * Hilfsfunktion: Konvertiert ein Datum in das ISO-KW-Format (YYYY-KWNN)
 */
export function formatIsoWeekString(date: Date): string {
  // ISO Woche und Jahr
  const jan4 = new Date(date.getFullYear(), 0, 4);
  const start = startOfISOWeek(jan4);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const weekNumber = Math.floor(diff / oneWeek) + 1;

  const isoYear = getIsoYear(date);
  return `${isoYear}-KW${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Ermittelt das ISO-Jahr eines Datums korrekt.
 */
function getIsoYear(date: Date): number {
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() - ((date.getDay() + 6) % 7) + 3);
  return target.getFullYear();
}
