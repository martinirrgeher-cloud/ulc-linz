// src/modules/leistungsgruppe/trainingsdoku/utils/format.ts
export function formatTarget(target: any | null | undefined): string {
  if (!target) return "";
  const parts: string[] = [];

  const sets = target.sets;
  const reps = target.reps;
  const menge = target.menge;
  const einheit = target.einheit;

  let combinedMengeWithSets = false;

  // 1) Sätze × Wiederholungen
  if (sets != null && reps != null) {
    // Klassischer Fall: z.B. 5 × 5 Wdh
    parts.push(`${sets} × ${reps} Wdh`);
  } else if (sets != null && menge != null && einheit) {
    // Z.B. 5 × 200 m (Läufe etc.)
    parts.push(`${sets} × ${menge} ${einheit}`);
    combinedMengeWithSets = true;
  } else if (reps != null) {
    parts.push(`${reps} Wdh`);
  }

  // 2) Distanz / Menge, falls nicht schon in Sätzen enthalten
  if (!combinedMengeWithSets) {
    if (menge != null && einheit) {
      parts.push(`${menge} ${einheit}`);
    } else {
      const distance = target.distanceM ?? target.distance;
      if (distance != null) {
        const unit = target.distanceUnit || "m";
        parts.push(`${distance} ${unit}`);
      }
    }
  }

  // 3) Zusatzwert (Zeit / Gewicht) sauber auswerten
  // - Für neue Pläne verwenden wir durationSec für Zeiten und weightKg für Gewichte,
  //   gesteuert über target.extraUnit.
  // - Für ältere Pläne unterstützen wir weiterhin target.timeSec.
  // - Falls extraUnit = "sek" gesetzt ist, aber nur weightKg befüllt ist,
  //   interpretieren wir weightKg rückwirkend als Sekunden.
  const extraUnit: "kg" | "sek" | "" =
    target.extraUnit === "kg" || target.extraUnit === "sek"
      ? target.extraUnit
      : "";

  let timeSec: number | null =
    (target.durationSec ?? target.timeSec) != null
      ? (target.durationSec ?? target.timeSec)
      : null;
  let weightKg: number | null =
    target.weightKg != null && !Number.isNaN(target.weightKg)
      ? target.weightKg
      : null;

  // Rückwärtskompatibilität: Sekunden wurden früher teilweise in weightKg gespeichert,
  // wenn im Plan "sek" ausgewählt war.
  if (extraUnit === "sek" && timeSec == null && weightKg != null) {
    timeSec = weightKg;
    weightKg = null;
  }

  // Weitere Rückwärtskompatibilität:
  // Falls keine extraUnit gesetzt ist, aber ein numerischer Wert in weightKg steht
  // und die Haupteinheit nicht "kg" ist (typischer Fall: Läufe mit Zielzeit),
  // interpretieren wir diesen Wert als Sekunden.
  if (!extraUnit && timeSec == null && weightKg != null && !Number.isNaN(weightKg)) {
    const mainUnit = (einheit || target.distanceUnit || "").toLowerCase();
    if (mainUnit && mainUnit !== "kg") {
      timeSec = weightKg;
      weightKg = null;
    }
  }

  // Zeit anzeigen (falls vorhanden)
  if (timeSec != null && !Number.isNaN(timeSec)) {
    const min = Math.floor(timeSec / 60);
    const sec = timeSec % 60;
    if (min > 0) {
      parts.push(`${min}′${sec.toString().padStart(2, "0")}″`);
    } else {
      parts.push(`${sec}s`);
    }
  }

  // Gewicht nur anzeigen, wenn es wirklich ein Gewicht ist
  if (weightKg != null && !Number.isNaN(weightKg) && extraUnit !== "sek") {
    parts.push(`${weightKg} kg`);
  }

  if (target.intensity != null) {
    parts.push(`Intensität ${target.intensity}`);
  }

  return parts.join(" · ");
}

export function getPerSetExtraUnit(
  planned: any,
  perSet: any[] | undefined
): "" | "kg" | "sek" {
  // 1) Wenn im Plan explizit eine Einheit gesetzt wurde, hat diese Vorrang.
  if (planned?.extraUnit === "kg" || planned?.extraUnit === "sek") {
    return planned.extraUnit;
  }

  // 2) Zuerst auf Per-Set-Werte schauen: wenn nur Zeiten vorkommen -> "sek",
  //    wenn nur Gewichte -> "kg".
  if (perSet && perSet.length > 0) {
    let hasTime = false;
    let hasWeight = false;
    for (const st of perSet) {
      if (st?.durationSec != null && !Number.isNaN(st.durationSec as any)) {
        hasTime = true;
      }
      if (st?.weightKg != null && !Number.isNaN(st.weightKg as any)) {
        hasWeight = true;
      }
    }
    if (hasTime && !hasWeight) return "sek";
    if (hasWeight && !hasTime) return "kg";
    if (hasTime && hasWeight) {
      // Falls beides vorkommt, bevorzugen wir Zeiten, da Läufe typischerweise so dokumentiert werden.
      return "sek";
    }
  }

  // 3) Fallback auf aggregierte Plan-Werte.
  const durationSec = planned?.durationSec ?? planned?.timeSec;
  if (durationSec != null && !Number.isNaN(durationSec)) {
    return "sek";
  }
  if (planned?.weightKg != null && !Number.isNaN(planned.weightKg)) {
    return "kg";
  }

  return "";
}

export function formatPerSetSummary(
  planned: any,
  perSet: any[] | undefined
): string {
  if (!planned || !perSet || perSet.length === 0) return "";

  const unit = getPerSetExtraUnit(planned, perSet);
  if (!unit) return "";

  const values: string[] = perSet.map((st) => {
    const raw =
      unit === "kg"
        ? st?.weightKg
        : st?.durationSec;
    if (raw == null || Number.isNaN(raw)) return "?";
    const str = String(raw);
    return str.replace(".", ",");
  });

  const label = unit === "kg" ? "Gewichte" : "Zeiten";
  const suffix = unit === "kg" ? "kg" : "s";

  return `${label}: ${values.join(" / ")} ${suffix}`;
}
