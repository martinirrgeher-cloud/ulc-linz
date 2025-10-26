// Gibt die ISO-Kalenderwoche für ein Datum zurück
export function getCurrentWeek(date: Date = new Date()): number {
  // ISO-Wochenstandard: Montag = 1. Tag
  const temp = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - dayNumber + 3);
  const firstThursday = temp.valueOf();
  temp.setMonth(0, 1);
  if (temp.getDay() !== 4) {
    temp.setMonth(0, 1 + ((4 - temp.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - temp.valueOf()) / 604800000);
}