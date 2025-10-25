import React, { useEffect, useState } from "react";
import styles from "../Athleten.module.css";
import { Athlete } from "../types/athleten";

interface Props {
  initial?: Partial<Athlete>;
  onCancel: () => void;
  onSave: (athlete: Omit<Athlete, "id"> & { id?: string }) => void;
}

export default function AthleteForm({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [geburtsjahr, setGeburtsjahr] = useState<number | undefined>(initial?.geburtsjahr);
  const [leistungsgruppe, setLeistungsgruppe] = useState(initial?.leistungsgruppe ?? "");
  const [info, setInfo] = useState(initial?.info ?? "");

  useEffect(() => {
    setName(initial?.name ?? "");
    setGeburtsjahr(initial?.geburtsjahr);
    setLeistungsgruppe(initial?.leistungsgruppe ?? "");
    setInfo(initial?.info ?? "");
  }, [initial]);

  const canSave = name.trim().length >= 2;

  return (
    <div className={styles.formWrap}>
      <div className={styles.formRow}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />
      </div>
      <div className={styles.formRow}>
        <label>Geburtsjahr</label>
        <input
          type="number"
          value={geburtsjahr ?? ""}
          onChange={(e) => setGeburtsjahr(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          placeholder="z.B. 2010"
        />
      </div>
      <div className={styles.formRow}>
        <label>Leistungsgruppe</label>
        <input value={leistungsgruppe} onChange={(e) => setLeistungsgruppe(e.target.value)} placeholder="z.B. U14, U16, LG" />
      </div>
      <div className={styles.formRow}>
        <label>Info</label>
        <textarea value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Besonderheiten, Kontakt, etc." />
      </div>
      <div className={styles.formActions}>
        <button className={styles.secondaryBtn} onClick={onCancel}>Abbrechen</button>
        <button
          className={styles.primaryBtn}
          disabled={!canSave}
          onClick={() =>
            onSave({
              id: (initial && "id" in initial) ? (initial as Athlete).id : undefined,
              name: name.trim(),
              geburtsjahr,
              leistungsgruppe: leistungsgruppe.trim() || undefined,
              info: info.trim() || undefined,
              anmeldung: initial?.anmeldung ?? [],
              plaene: initial?.plaene ?? [],
              feedback: initial?.feedback ?? []
            })
          }
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
