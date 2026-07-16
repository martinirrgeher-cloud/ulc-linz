// src/modules/kindertraining/lib/weekUtils.ts
// ISO‑Woche mit Montagsstart (ISO‑8601).
// WeekId-Format: "YYYY-Www" (z. B. "2025-W45").

export type WeekId = string;

/** Liefert das ISO WeekId (YYYY-Www) für ein Datum. */
export function getISOWeekId(d: Date): WeekId {
  const { isoYear, isoWeek } = isoYearWeek(d);
  const ww = String(isoWeek).padStart(2, "0");
  return `${isoYear}-W${ww}`;
}

/** Verschiebt eine WeekId um dir Wochen (-1, 0, +1) und liefert die neue WeekId. */
export function moveISOWeek(weekId: WeekId, dir: -1 | 0 | 1): WeekId {
  if (dir === 0) return getISOWeekId(new Date());
  const monday = mondayOfISOWeek(weekId);
  const shifted = addDays(monday, dir * 7);
  return getISOWeekId(shifted);
}

/** Gibt ISO-YYYY-MM-DD für Mo..So der angegebenen WeekId zurück. */
export function datesForISOWeek(weekId: WeekId): string[] {
  const monday = mondayOfISOWeek(weekId);
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));
}

// --------- Internals ---------

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

/** Ermittelt ISO-Jahr und ISO-Wochennummer für ein Datum (ISO‑8601, Montag=1). */
function isoYearWeek(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Donnerstag der aktuellen Woche
  const day = (d.getUTCDay() + 6) % 7; // 0=Montag … 6=Sonntag
  d.setUTCDate(d.getUTCDate() - day + 3);

  // ISO-Jahr ist das Jahr des Donnerstags
  const isoYear = d.getUTCFullYear();

  // Donnerstag der ISO‑Woche 1 (die Woche, die den 4. Januar enthält)
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  jan4.setUTCDate(jan4.getUTCDate() - jan4Day + 3);

  // Kalenderwochen seit ISO‑Woche 1
  const diffDays = Math.round((d.getTime() - jan4.getTime()) / 86400000);
  const isoWeek = 1 + Math.floor(diffDays / 7);

  return { isoYear, isoWeek };
}

/** Liefert das Montag-Datum der übergebenen WeekId. */
function mondayOfISOWeek(weekId: WeekId): Date {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!m) throw new Error(`Ungültige WeekId: ${weekId}`);
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);

  // Montag der ISO‑Woche 1 (die Woche mit dem 4. Januar)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // 0=Montag … 6=Sonntag
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day); // zurück auf Montag

  // Montag der gewünschten Woche
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  // In lokale Zeit umrechnen (damit toISODate lokale YYYY-MM-DD liefert)
  return new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
}
