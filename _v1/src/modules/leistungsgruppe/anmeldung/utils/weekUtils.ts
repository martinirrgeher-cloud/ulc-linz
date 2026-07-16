// src/modules/leistungsgruppe/anmeldung/utils/weekUtils.ts
export function startOfISOWeek(input?: Date): Date {
  const d = input ? new Date(input) : new Date();
  const day = d.getDay() || 7; // Sunday=7
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getISOWeekYear(date?: Date): number {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  return d.getFullYear();
}

export function getISOWeek(date?: Date): number {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the week
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDaysOfWeek(weekStart?: Date): { date: Date; isoDate: string; label: string; weekdayShort: string }[] {
  const base = startOfISOWeek(weekStart);
  const names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const res = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    res.push({
      date: d,
      isoDate: toIsoDate(d),
      label: `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}.`,
      weekdayShort: names[i],
    });
  }
  return res;
}
