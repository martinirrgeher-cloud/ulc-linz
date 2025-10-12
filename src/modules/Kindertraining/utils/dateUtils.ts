export function fmtISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getISOWeek(date: Date) {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getSessionsForMonth(firstOfMonth: Date, weekdays: number[]) {
  const d0 = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1);
  const d1 = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0);
  const result: Date[] = [];
  for (const weekday of weekdays) {
    const shift = (weekday - d0.getDay() + 7) % 7;
    const first = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + shift);
    for (let d = new Date(first); d <= d1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      result.push(new Date(d));
    }
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}
