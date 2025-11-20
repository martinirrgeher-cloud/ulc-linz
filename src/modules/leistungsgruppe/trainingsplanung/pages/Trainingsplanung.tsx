import React, { useEffect, useMemo, useState } from "react";
import { useTrainingsplanung } from "../hooks/useTrainingsplanung";
import PlanEditor from "../components/PlanEditor";
import "../styles/Trainingsplanung.css";
import { toISODate } from "../../common/date";
import { loadAnmeldung, DayStatus, AnmeldungData } from "../../anmeldung/services/AnmeldungStore";

type CandidateExercise = {
  id: string;
  name: string;
  haupt?: string | null;
  unter?: string | null;
  reps?: number | null;
  menge?: number | null;
  einheit?: string | null;
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function isoWeek(dateIso: string): number {
  const d = new Date(dateIso + "T00:00:00");
  // ISO-Week-Algorithmus
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((tmp.getTime() - yearStart.getTime()) / 86400000) + 1;
  return Math.ceil(diffDays / 7);
}

export default function TrainingsplanungPage() {
  const {
    dateISO,
    setDateISO,
    athleteId,
    setAthleteId,
    athleteName,
    setAthleteName,
    planDay,
    addExercise,
    updateItem,
    removeItem,
    moveItem,
    save,
    filteredExercises,
    search,
    setSearch,
    onlyRegistered,
    setOnlyRegistered,
    copyPlanTo,
    weekFromDate,
  } = useTrainingsplanung();

  const [copyToIds, setCopyToIds] = useState<string>("");
  const [copyScope, setCopyScope] = useState<"DAY" | "WEEK">("DAY");

  const [manualEx, setManualEx] = useState<CandidateExercise>({
    id: "",
    name: "",
    reps: null,
    menge: null,
    einheit: null,
  });

  const [anmeldung, setAnmeldung] = useState<AnmeldungData | null>(null);
  const [anmeldungLoading, setAnmeldungLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setAnmeldungLoading(true);
        const data = await loadAnmeldung();
        if (!cancelled) setAnmeldung(data);
      } catch (e) {
        console.error("Anmeldung laden fehlgeschlagen", e);
      } finally {
        if (!cancelled) setAnmeldungLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const planOrder = planDay?.order ?? [];
  const planItems = planDay?.items ?? {};
  const canSave = !!athleteId && !!dateISO && !!planDay;

  const weekDates = weekFromDate();

  const dayInfos = useMemo(
    () =>
      weekDates.map((d) => {
        let status: DayStatus | null = null;
        if (athleteId && anmeldung?.statuses) {
          const key = `${athleteId}:${d}`;
          status = anmeldung.statuses[key] ?? null;
        }
        return { date: d, status };
      }),
    [weekDates, athleteId, anmeldung]
  );

  const targetDates = useMemo(() => {
    if (copyScope === "DAY") return [dateISO];
    return weekDates;
  }, [copyScope, dateISO, weekDates]);

  function handleAddManual() {
    if (!planDay) return;
    if (!manualEx.id || !manualEx.name) return;
    const ex: CandidateExercise = {
      id: manualEx.id.trim(),
      name: manualEx.name.trim(),
      reps: manualEx.reps ?? null,
      menge: manualEx.menge ?? null,
      einheit: manualEx.einheit ?? null,
    };
    addExercise(ex as any);
    setManualEx({ id: "", name: "", reps: null, menge: null, einheit: null });
  }

  async function handleCopy() {
    const ids = copyToIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return;
    await copyPlanTo(ids, targetDates)();
    // einfache Rückmeldung – später ggf. Toast
    alert("Plan kopiert.");
  }

  const currentWeek = isoWeek(dateISO);

  return (
    <div className="tp-container">
      <div className="tp-left">
        <div className="tp-header">
          <div>
            <div className="tp-section-title">Kalenderwoche</div>
            <div className="tp-badge">
              KW {currentWeek} &middot; {weekDates[0]} – {weekDates[6]}
            </div>
            <div className="tp-week-row">
              {dayInfos.map((d, idx) => {
                const label = WEEKDAY_LABELS[idx] ?? "";
                const isActive = d.date === dateISO;
                const cls = [
                  "tp-day-chip",
                  isActive ? "active" : "",
                  d.status === "YES" ? "yes" : d.status === "MAYBE" ? "maybe" : "no",
                ]
                  .filter(Boolean)
                  .join(" ");
                const disabled = onlyRegistered && d.status !== "YES";
                return (
                  <button
                    key={d.date}
                    type="button"
                    className={cls}
                    disabled={disabled}
                    onClick={() => setDateISO(d.date)}
                  >
                    <div>{label}</div>
                    <div className="tp-day-date">{d.date.slice(5)}</div>
                  </button>
                );
              })}
            </div>
            {anmeldungLoading && <div className="tp-badge">Anmeldungen werden geladen…</div>}
          </div>

          <div>
            <div className="tp-section-title">Datum</div>
            <input
              className="tp-input"
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value || toISODate(new Date()))}
            />
          </div>

          <div>
            <div className="tp-section-title">Athlet-ID</div>
            <input
              className="tp-input"
              placeholder="athlete-123"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
            />
          </div>

          <div>
            <div className="tp-section-title">Name (optional)</div>
            <input
              className="tp-input"
              placeholder="Raphael Briel"
              value={athleteName}
              onChange={(e) => setAthleteName(e.target.value)}
            />
          </div>

          <div style={{ alignSelf: "flex-end" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={onlyRegistered}
                onChange={(e) => setOnlyRegistered(e.target.checked)}
              />
              Nur Tage mit JA
            </label>
          </div>

          <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
            <button className={"tp-btn primary"} disabled={!canSave} onClick={save}>
              Speichern
            </button>
          </div>
        </div>

        <div className="tp-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Übungssuche</div>
            <div className="tp-badge">
              Tipp: <span className="tp-kbd">/</span> fokussiert die Suche
            </div>
          </div>

          <div className="tp-row">
            <input
              className="tp-input"
              placeholder="Suche nach Name…"
              value={search.text}
              onChange={(e) => setSearch((s) => ({ ...s, text: e.target.value }))}
            />
            <input
              className="tp-input"
              placeholder="Hauptgruppe (optional)"
              value={search.haupt}
              onChange={(e) => setSearch((s) => ({ ...s, haupt: e.target.value }))}
            />
          </div>

          <div className="tp-row">
            <input
              className="tp-input"
              placeholder="Untergruppe (optional)"
              value={search.unter}
              onChange={(e) => setSearch((s) => ({ ...s, unter: e.target.value }))}
            />
            <div />
          </div>

          <div style={{ marginTop: 8 }}>
            {filteredExercises.length > 0 ? (
              filteredExercises.slice(0, 50).map((ex) => (
                <div key={ex.id} className="tp-card" style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{ex.name}</div>
                      <div className="tp-badge">
                        {ex.haupt ?? "—"}
                        {ex.unter ? ` / ${ex.unter}` : ""}
                      </div>
                    </div>
                    <button className="tp-btn" type="button" onClick={() => addExercise(ex as any)}>
                      Hinzufügen
                    </button>
                  </div>
                  <div className="tp-row" style={{ marginTop: 6 }}>
                    <input className="tp-input" readOnly value={ex.reps ?? ""} placeholder="Wdh." />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        className="tp-input"
                        readOnly
                        value={ex.menge ?? ""}
                        placeholder="Menge"
                      />
                      <input
                        className="tp-input"
                        readOnly
                        value={ex.einheit ?? ""}
                        placeholder="Einheit"
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="tp-badge">
                Kein Katalog verfügbar – du kannst unten manuell Übungen anlegen.
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Manuell hinzufügen</div>
            <div className="tp-row">
              <input
                className="tp-input"
                placeholder="Übungs-ID"
                value={manualEx.id}
                onChange={(e) => setManualEx({ ...manualEx, id: e.target.value })}
              />
              <input
                className="tp-input"
                placeholder="Name"
                value={manualEx.name}
                onChange={(e) => setManualEx({ ...manualEx, name: e.target.value })}
              />
            </div>
            <div className="tp-row">
              <input
                className="tp-input"
                type="number"
                placeholder="Wdh."
                value={manualEx.reps ?? ""}
                onChange={(e) =>
                  setManualEx({
                    ...manualEx,
                    reps: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  className="tp-input"
                  type="number"
                  placeholder="Menge"
                  value={manualEx.menge ?? ""}
                  onChange={(e) =>
                    setManualEx({
                      ...manualEx,
                      menge: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <input
                  className="tp-input"
                  placeholder="Einheit (min, km, m…)"
                  value={manualEx.einheit ?? ""}
                  onChange={(e) =>
                    setManualEx({
                      ...manualEx,
                      einheit: e.target.value || null,
                    })
                  }
                />
              </div>
            </div>
            <div className="tp-actions" style={{ marginTop: 8 }}>
              <button className="tp-btn" type="button" onClick={handleAddManual}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="tp-right">
        <div className="tp-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>
              Plan für {athleteName || athleteId || "—"} am {dateISO}
            </div>
          </div>
          <PlanEditor
            planOrder={planOrder}
            planItems={planItems}
            onUpdate={updateItem}
            onRemove={removeItem}
            onMove={moveItem}
          />
        </div>

        <div className="tp-card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Plan kopieren</div>
          <div className="tp-row">
            <select
              className="tp-select"
              value={copyScope}
              onChange={(e) => setCopyScope(e.target.value as "DAY" | "WEEK")}
            >
              <option value="DAY">Nur diesen Tag</option>
              <option value="WEEK">Ganze Woche (Mo–So)</option>
            </select>
            <input
              className="tp-input"
              placeholder="Ziel-Athleten-IDs, komma-getrennt"
              value={copyToIds}
              onChange={(e) => setCopyToIds(e.target.value)}
            />
          </div>
          <div className="tp-actions" style={{ marginTop: 8 }}>
            <button className="tp-btn" type="button" onClick={handleCopy}>
              Kopieren
            </button>
            <div className="tp-badge">
              Zieldaten:{" "}
              {copyScope === "DAY" ? dateISO : `${weekDates[0]} – ${weekDates[6]}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
