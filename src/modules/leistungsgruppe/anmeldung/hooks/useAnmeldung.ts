import { useState, useEffect } from "react";

// ISO-Kalenderwoche (Montag als Wochenbeginn)
const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Liefert die 7 Datums-Strings (YYYY-MM-DD) der ISO-Woche, beginnend am Montag
const getDatesOfWeek = (week: number, year: number): string[] => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const monday = new Date(mondayOfWeek1);
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
};

// Ermittelt die Anzahl ISO-Wochen eines Jahres
const getISOWeeksInYear = (year: number): number => {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  return getISOWeek(dec28);
};

export function useAnmeldung() {
  const today = new Date();
  const [kw, setKw] = useState(getISOWeek(today));
  const [jahr, setJahr] = useState(today.getFullYear());
  const [tage, setTage] = useState<string[]>([]);
  const [anmeldungen, setAnmeldungen] = useState<Record<string, any>>({});
  const [notizen, setNotizen] = useState<Record<string, string>>({});

  useEffect(() => {
    setTage(getDatesOfWeek(kw, jahr));
  }, [kw, jahr]);

  const nextWeek = () => {
    const maxWeeks = getISOWeeksInYear(jahr);
    if (kw < maxWeeks) {
      setKw(kw + 1);
    } else {
      setKw(1);
      setJahr(jahr + 1);
    }
  };

  const prevWeek = () => {
    if (kw > 1) {
      setKw(kw - 1);
    } else {
      const prevYear = jahr - 1;
      setJahr(prevYear);
      setKw(getISOWeeksInYear(prevYear));
    }
  };

  const getStatus = (athletId: string, datum: string) => {
    return anmeldungen[`${athletId}_${datum}`] || "?";
  };

  const setStatus = (athletId: string, datum: string, status: "?" | "Ja" | "Nein") => {
    setAnmeldungen((prev) => ({
      ...prev,
      [`${athletId}_${datum}`]: status,
    }));
  };

  const setNotiz = (athletId: string, datum: string, text: string) => {
    setNotizen((prev) => ({
      ...prev,
      [`${athletId}_${datum}`]: text,
    }));
  };

  return {
    kw,
    jahr,
    tage,
    getStatus,
    setStatus,
    notizen,
    setNotiz,
    nextWeek,
    prevWeek,
  };
}
