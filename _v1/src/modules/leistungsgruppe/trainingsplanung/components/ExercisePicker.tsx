// src/modules/leistungsgruppe/trainingsplanung/components/ExercisePicker.tsx
import React from "react";
import type { ExerciseLite } from "../../../uebungskatalog/services/ExercisesLite";

export type PickerTab = "KATALOG" | "MANUAL";

export type ManualExerciseDraft = {
  name: string;
  haupt: string;
  unter: string;
  reps: string;
  menge: string;
  einheit: string;
};

type Props = {
  open: boolean;
  onClose: () => void;

  pickerTab: PickerTab;
  onChangeTab: (tab: PickerTab) => void;

  searchText: string;
  onChangeSearchText: (value: string) => void;

  searchHaupt: string;
  onChangeSearchHaupt: (value: string) => void;

  searchUnter: string;
  onChangeSearchUnter: (value: string) => void;

  allHauptgruppen: string[];
  allUntergruppen: string[];

  filteredExercises: ExerciseLite[];

  manualDraft: ManualExerciseDraft;
  onChangeManualDraft: (draft: ManualExerciseDraft) => void;

  onAddCatalogExercise: (exercise: ExerciseLite) => void;
  onAddManualExercise: () => void;

  exerciseLoading: boolean;
};

const ExercisePicker: React.FC<Props> = ({
  open,
  onClose,
  pickerTab,
  onChangeTab,
  searchText,
  onChangeSearchText,
  searchHaupt,
  onChangeSearchHaupt,
  searchUnter,
  onChangeSearchUnter,
  allHauptgruppen,
  allUntergruppen,
  filteredExercises,
  manualDraft,
  onChangeManualDraft,
  onAddCatalogExercise,
  onAddManualExercise,
  exerciseLoading,
}) => {
  if (!open) return null;

  return (
    <div className="tp-picker-overlay" onClick={onClose}>
      <div
        className="tp-picker-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tp-picker-header">
          <div className="tp-picker-tabs">
            <button
              type="button"
              className={
                "tp-picker-tab" +
                (pickerTab === "KATALOG" ? " active" : "")
              }
              onClick={() => onChangeTab("KATALOG")}
            >
              Katalog
            </button>
            <button
              type="button"
              className={
                "tp-picker-tab" +
                (pickerTab === "MANUAL" ? " active" : "")
              }
              onClick={() => onChangeTab("MANUAL")}
            >
              Manuell
            </button>
          </div>
          <button
            type="button"
            className="tp-btn tp-btn-mini"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {pickerTab === "KATALOG" && (
          <div className="tp-picker-body">
            <div className="tp-picker-filters">
              <input
                className="tp-input"
                placeholder="Suche nach Name / Text"
                value={searchText}
                onChange={(e) => onChangeSearchText(e.target.value)}
              />
              <select
                className="tp-input"
                value={searchHaupt}
                onChange={(e) => {
                  const v = e.target.value;
                  onChangeSearchHaupt(v);
                  // Untergruppen-Filter zurücksetzen, wenn Hauptgruppe geändert wird
                  onChangeSearchUnter("");
                }}
              >
                <option value="">Alle Hauptgruppen</option>
                {allHauptgruppen.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                className="tp-input"
                value={searchUnter}
                onChange={(e) => onChangeSearchUnter(e.target.value)}
              >
                <option value="">Alle Untergruppen</option>
                {allUntergruppen.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {exerciseLoading && (
              <div className="tp-info" style={{ marginBottom: 8 }}>
                Übungen werden geladen …
              </div>
            )}

            <div className="tp-picker-list">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className="tp-picker-item"
                  onClick={() => onAddCatalogExercise(ex)}
                >
                  <div className="tp-picker-item-main">
                    <div className="tp-picker-item-name">{ex.name}</div>
                    <div className="tp-picker-item-meta">
                      {ex.haupt}
                      {ex.unter ? ` / ${ex.unter}` : ""}
                    </div>
                  </div>
                  <div className="tp-picker-item-target">
                    {ex.reps
                      ? `${ex.reps} Wdh.`
                      : ex.menge
                      ? `${ex.menge} ${ex.einheit ?? ""}`.trim()
                      : ""}
                  </div>
                  {ex.difficulty != null && ex.difficulty > 0 && (
                    <div className="tp-picker-item-stars">
                      {"★".repeat(ex.difficulty)}
                    </div>
                  )}
                </button>
              ))}
              {filteredExercises.length === 0 && !exerciseLoading && (
                <div className="tp-info">Keine Übungen gefunden.</div>
              )}
            </div>
          </div>
        )}

        {pickerTab === "MANUAL" && (
          <div className="tp-picker-body">
            <div className="tp-picker-manual">
              <div className="tp-field">
                <label className="tp-label">Name der Übung*</label>
                <input
                  className="tp-input"
                  value={manualDraft.name}
                  onChange={(e) =>
                    onChangeManualDraft({ ...manualDraft, name: e.target.value })
                  }
                  placeholder="z.B. Kniebeugen, Lauf-ABC …"
                />
              </div>

              <div className="tp-field-row">
                <div className="tp-field">
                  <label className="tp-label">Hauptgruppe</label>
                  <input
                    className="tp-input"
                    value={manualDraft.haupt}
                    onChange={(e) =>
                      onChangeManualDraft({
                        ...manualDraft,
                        haupt: e.target.value,
                      })
                    }
                    placeholder="z.B. Sprint, Kraft …"
                  />
                </div>
                <div className="tp-field">
                  <label className="tp-label">Untergruppe</label>
                  <input
                    className="tp-input"
                    value={manualDraft.unter}
                    onChange={(e) =>
                      onChangeManualDraft({
                        ...manualDraft,
                        unter: e.target.value,
                      })
                    }
                    placeholder="z.B. Start, Technik …"
                  />
                </div>
              </div>

              <div className="tp-field-row">
                <div className="tp-field">
                  <label className="tp-label">Wiederholungen</label>
                  <input
                    className="tp-input"
                    value={manualDraft.reps}
                    onChange={(e) =>
                      onChangeManualDraft({
                        ...manualDraft,
                        reps: e.target.value,
                      })
                    }
                    placeholder="z.B. 10"
                  />
                </div>
                <div className="tp-field">
                  <label className="tp-label">Menge</label>
                  <input
                    className="tp-input"
                    value={manualDraft.menge}
                    onChange={(e) =>
                      onChangeManualDraft({
                        ...manualDraft,
                        menge: e.target.value,
                      })
                    }
                    placeholder="z.B. 50"
                  />
                </div>
                <div className="tp-field">
                  <label className="tp-label">Einheit</label>
                  <input
                    className="tp-input"
                    value={manualDraft.einheit}
                    onChange={(e) =>
                      onChangeManualDraft({
                        ...manualDraft,
                        einheit: e.target.value,
                      })
                    }
                    placeholder="m, s, kg …"
                  />
                </div>
              </div>
            </div>

            <div className="tp-picker-footer">
              <button
                type="button"
                className="tp-btn tp-btn-primary"
                onClick={onAddManualExercise}
              >
                Übung hinzufügen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExercisePicker;
