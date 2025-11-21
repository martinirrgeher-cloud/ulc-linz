import React from "react";
import type { SearchState } from "../hooks/useTrainingsplanung";
import type { ExerciseLite } from "@/modules/uebungskatalog/services/ExercisesLite";

type ManualExercise = {
  id: string;
  name: string;
  reps?: number | null;
  menge?: number | null;
  einheit?: string | null;
};

type Props = {
  search: SearchState;
  setSearch: (s: SearchState) => void;
  filteredExercises: ExerciseLite[];
  hasActiveBlock: boolean;
  manualEx: ManualExercise;
  setManualEx: React.Dispatch<React.SetStateAction<ManualExercise>>;
  onAddExercise: (ex: ExerciseLite) => void;
  onAddManual: (m: ManualExercise) => void;
};

export default function TrainingsplanungExercisePanel({
  search,
  setSearch,
  filteredExercises,
  hasActiveBlock,
  manualEx,
  setManualEx,
  onAddExercise,
  onAddManual,
}: Props) {
  return (
    <div className="tp-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 600 }}>Übungssuche</div>
      </div>

      <div className="tp-row" style={{ marginTop: 8 }}>
        <input
          className="tp-input"
          placeholder="Textsuche"
          value={search.text}
          onChange={(e) => setSearch({ ...search, text: e.target.value })}
        />
      </div>
      <div className="tp-row" style={{ marginTop: 4 }}>
        <input
          className="tp-input"
          placeholder="Hauptgruppe"
          value={search.haupt}
          onChange={(e) => setSearch({ ...search, haupt: e.target.value })}
        />
        <input
          className="tp-input"
          placeholder="Untergruppe"
          value={search.unter}
          onChange={(e) => setSearch({ ...search, unter: e.target.value })}
        />
      </div>

      <div className="tp-exercise-list">
        {filteredExercises.length === 0 && (
          <div className="tp-empty">Keine Übungen gefunden.</div>
        )}
        {filteredExercises.map((ex) => (
          <div key={ex.id} className="tp-exercise-row">
            <div>
              <div className="tp-exercise-title">{ex.name}</div>
              {(ex.haupt || ex.unter) && (
                <div className="tp-exercise-subtitle">
                  {[ex.haupt, ex.unter].filter(Boolean).join(" / ")}
                </div>
              )}
            </div>
            <button
              type="button"
              className="tp-btn"
              disabled={!hasActiveBlock}
              onClick={() => onAddExercise(ex)}
            >
              Hinzufügen
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Manuell hinzufügen
        </div>
        <div className="tp-row">
          <input
            className="tp-input"
            placeholder="Übungs-ID"
            value={manualEx.id}
            onChange={(e) =>
              setManualEx((prev) => ({ ...prev, id: e.target.value }))
            }
          />
          <input
            className="tp-input"
            placeholder="Name"
            value={manualEx.name}
            onChange={(e) =>
              setManualEx((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </div>
        <div className="tp-row" style={{ marginTop: 6 }}>
          <input
            className="tp-input"
            placeholder="Wdh."
            value={manualEx.reps ?? ""}
            onChange={(e) =>
              setManualEx((prev) => ({
                ...prev,
                reps: e.target.value
                  ? Number(e.target.value.replace(",", ".")) || null
                  : null,
              }))
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <input
              className="tp-input"
              placeholder="Menge"
              value={manualEx.menge ?? ""}
              onChange={(e) =>
                setManualEx((prev) => ({
                  ...prev,
                  menge: e.target.value
                    ? Number(e.target.value.replace(",", ".")) || null
                    : null,
                }))
              }
            />
            <input
              className="tp-input"
              placeholder="Einheit"
              value={manualEx.einheit ?? ""}
              onChange={(e) =>
                setManualEx((prev) => ({
                  ...prev,
                  einheit: e.target.value || null,
                }))
              }
            />
          </div>
        </div>
        <div className="tp-row" style={{ marginTop: 8 }}>
          <button
            className="tp-btn"
            type="button"
            disabled={!hasActiveBlock}
            onClick={() => onAddManual(manualEx)}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
