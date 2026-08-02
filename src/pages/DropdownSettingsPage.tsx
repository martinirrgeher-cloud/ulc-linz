import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, ListPlus, Pencil, Plus, Save, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  loadDropdownSettings,
  saveDropdownSetting,
  setDropdownSettingActive,
} from "@/features/dropdown-settings/api";
import {
  DROPDOWN_LISTS,
  optionToInput,
  type DropdownListKey,
  type DropdownSettingInput,
  type DropdownSettingOption,
  type DropdownSettingsData,
} from "@/features/dropdown-settings/types";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
const EMPTY_DATA: DropdownSettingsData = {
  category: [],
  subcategory: [],
  material: [],
  difficulty: [],
  planning_parameter: [],
};

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Auswahllisten konnten nicht geladen werden.", "dropdown_settings");
}

export function DropdownSettingsPage() {
  const { appContext, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canEdit = canEditModule("dropdown_settings");
  const [data, setData] = useState<DropdownSettingsData>(EMPTY_DATA);
  const [activeList, setActiveList] = useState<DropdownListKey>("category");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<DropdownSettingOption | null | undefined>(undefined);
  const [values, setValues] = useState<DropdownSettingInput>(() => optionToInput(null));
  const [editorError, setEditorError] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await loadDropdownSettings(organizationId));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const listDefinition = useMemo(
    () => DROPDOWN_LISTS.find((list) => list.key === activeList) ?? DROPDOWN_LISTS[0]!,
    [activeList],
  );

  function startEdit(option: DropdownSettingOption | null) {
    setEditing(option);
    setValues(optionToInput(option));
    setEditorError(null);
    setError(null);
    setSuccess(null);
  }

  function closeEditor() {
    setEditing(undefined);
    setEditorError(null);
  }

  function update<K extends keyof DropdownSettingInput>(key: K, value: DropdownSettingInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setEditorError(null);
  }

  const matchingOptions = useMemo(() => {
    if (editing === undefined) return [];
    const search = values.label.trim().toLocaleLowerCase("de");
    if (!search) return [];

    return data[activeList]
      .filter((option) => {
        const isCurrentOption = editing
          ? option.id === editing.id && option.key === editing.key
          : false;
        return !isCurrentOption && option.label.toLocaleLowerCase("de").startsWith(search);
      })
      .sort((left, right) => left.label.localeCompare(right.label, "de", { sensitivity: "base" }));
  }, [activeList, data, editing, values.label]);

  const exactDuplicate = useMemo(() => {
    const label = values.label.trim().toLocaleLowerCase("de");
    if (!label) return null;
    return matchingOptions.find((option) => option.label.trim().toLocaleLowerCase("de") === label) ?? null;
  }, [matchingOptions, values.label]);

  const sortedOptions = useMemo(() => (
    [...data[activeList]].sort((left, right) => {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      return left.sortOrder - right.sortOrder
        || left.label.localeCompare(right.label, "de", { sensitivity: "base" });
    })
  ), [activeList, data]);

  async function handleSave() {
    if (!organizationId || !canEdit || editing === undefined) return;
    if (values.label.trim().length < 2) {
      setEditorError("Die Bezeichnung muss mindestens zwei Zeichen lang sein.");
      return;
    }
    if (exactDuplicate) {
      setEditorError(`Der Eintrag „${exactDuplicate.label}“ ist bereits vorhanden.`);
      return;
    }
    setBusy(true);
    setEditorError(null);
    setError(null);
    setSuccess(null);
    try {
      await saveDropdownSetting(organizationId, activeList, editing, values);
      closeEditor();
      setSuccess(editing ? "Der Eintrag wurde gespeichert." : "Der Eintrag wurde angelegt.");
      await loadData();
    } catch (saveError) {
      setEditorError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(option: DropdownSettingOption) {
    if (!organizationId || !canEdit || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await setDropdownSettingActive(organizationId, activeList, option, !option.isActive);
      setSuccess(option.isActive ? "Der Eintrag wurde ausgeblendet." : "Der Eintrag wurde wieder aktiviert.");
      await loadData();
    } catch (toggleError) {
      setError(errorMessage(toggleError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dropdown-settings-page">
      <div className="dropdown-settings-heading">
        <div>
          <p className="eyebrow">Stammdaten</p>
          <h1>Auswahllisten</h1>
          <p>Dropdownwerte für Übungen und Trainingsplanung zentral verwalten.</p>
        </div>
        {canEdit && (
          <button type="button" className="primary-button" onClick={() => startEdit(null)} disabled={loading || busy}>
            <Plus aria-hidden="true" />Eintrag
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <nav className="dropdown-settings-tabs" aria-label="Auswahllisten">
        {DROPDOWN_LISTS.map((list) => (
          <button
            type="button"
            className={activeList === list.key ? "active" : ""}
            onClick={() => {
              setActiveList(list.key);
              setEditing(undefined);
              setIntroOpen(false);
            }}
            key={list.key}
          >
            {list.title}<span>{data[list.key].filter((option) => option.isActive).length}</span>
          </button>
        ))}
      </nav>

      <div className={`dropdown-settings-intro ${introOpen ? "open" : ""}`}>
        <div className="dropdown-settings-intro-heading">
          <h2>{listDefinition.title}</h2>
          <button
            type="button"
            className="dropdown-settings-info-button"
            onClick={() => setIntroOpen((current) => !current)}
            aria-expanded={introOpen}
            aria-label={introOpen ? "Erklärung schließen" : `Erklärung zu ${listDefinition.title} öffnen`}
            title="Information"
          >
            <Info aria-hidden="true" />
          </button>
        </div>
        {introOpen && (
          <div className="dropdown-settings-intro-copy">
            <p>{listDefinition.description}</p>
            <small>Deaktivierte Einträge bleiben bei bestehenden Übungen erhalten, können aber nicht mehr neu ausgewählt werden.</small>
          </div>
        )}
      </div>

      {loading ? (
        <div className="management-loading"><div className="spinner" aria-hidden="true" />Auswahllisten werden geladen …</div>
      ) : data[activeList].length === 0 ? (
        <div className="empty-state"><ListPlus aria-hidden="true" /><h2>Noch keine Einträge</h2><p>Lege den ersten Eintrag für diese Auswahlliste an.</p></div>
      ) : (
        <div className="dropdown-settings-list">
          {sortedOptions.map((option) => (
            <article className={`dropdown-setting-card ${option.isActive ? "" : "inactive"}`} key={`${activeList}-${option.key}`}>
              <div>
                <strong>{option.label}</strong>
                <small>
                  {activeList === "planning_parameter"
                    ? `${option.inputType === "number" ? "Zahl" : "Text"}${option.unit ? ` · ${option.unit}` : ""}${option.stepValue ? ` · Schritt ${option.stepValue}` : ""} · ${option.usageCount}-mal verwendet`
                    : `${option.usageCount}-mal verwendet`}
                </small>
              </div>
              <span className={`dropdown-setting-status ${option.isActive ? "active" : ""}`}>{option.isActive ? "Aktiv" : "Inaktiv"}</span>
              {canEdit && (
                <div className="dropdown-setting-actions">
                  <button type="button" onClick={() => startEdit(option)} disabled={busy} aria-label={`${option.label} bearbeiten`} title="Bearbeiten"><Pencil aria-hidden="true" /></button>
                  <button type="button" onClick={() => void toggleActive(option)} disabled={busy} aria-label={`${option.label} ${option.isActive ? "deaktivieren" : "aktivieren"}`} title={option.isActive ? "Deaktivieren" : "Aktivieren"}>
                    {option.isActive ? <ToggleRight aria-hidden="true" /> : <ToggleLeft aria-hidden="true" />}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <div className="dropdown-setting-editor-backdrop" role="presentation">
          <section className="dropdown-setting-editor" role="dialog" aria-modal="true" aria-labelledby="dropdown-setting-editor-title">
            <header>
              <div><p className="eyebrow">{listDefinition.title}</p><h2 id="dropdown-setting-editor-title">{editing ? "Eintrag bearbeiten" : "Eintrag anlegen"}</h2></div>
              <button type="button" className="icon-button" onClick={closeEditor} disabled={busy} aria-label="Dialog schließen"><X aria-hidden="true" /></button>
            </header>
            <div className="dropdown-setting-editor-form">
              {editorError && <div className="alert error dropdown-setting-editor-error">{editorError}</div>}
              <div className="dropdown-setting-label-field">
                <label>
                  <span>Bezeichnung *</span>
                  <input
                    type="text"
                    value={values.label}
                    onChange={(event) => update("label", event.target.value)}
                    maxLength={100}
                    autoFocus
                    aria-invalid={Boolean(exactDuplicate)}
                  />
                </label>
                {exactDuplicate && (
                  <p className="dropdown-setting-duplicate-warning" role="alert">
                    Der Eintrag „{exactDuplicate.label}“ ist bereits vorhanden.
                  </p>
                )}
                {matchingOptions.length > 0 && (
                  <div className="dropdown-setting-suggestions" aria-live="polite">
                    <small>Bereits vorhandene Einträge:</small>
                    <div>
                      {matchingOptions.map((option) => (
                        <span className={option.isActive ? "" : "inactive"} key={`${option.key}-${option.id ?? "base"}`}>
                          <strong>{option.label}</strong>
                          <small>{option.isActive ? "Aktiv" : "Inaktiv"}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {activeList === "planning_parameter" && (
                <>
                  <label>
                    <span>Eingabetyp</span>
                    <select
                      value={values.inputType}
                      onChange={(event) => update("inputType", event.target.value as "number" | "text")}
                      disabled={Boolean(editing?.usageCount)}
                    >
                      <option value="number">Zahl</option>
                      <option value="text">Text</option>
                    </select>
                    {Boolean(editing?.usageCount) && <small>Der Eingabetyp bleibt bei bereits verwendeten Parametern unverändert.</small>}
                  </label>
                  <label><span>Einheit</span><input type="text" value={values.unit} onChange={(event) => update("unit", event.target.value)} maxLength={20} placeholder="z. B. m, kg, s" /></label>
                  {values.inputType === "number" && <label><span>Standard-Schrittweite</span><input type="number" min="0.01" step="any" value={values.stepValue} onChange={(event) => update("stepValue", event.target.value)} /></label>}
                </>
              )}
              <label><span>Sortierung</span><input type="number" step="1" value={values.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} /></label>
            </div>
            <footer>
              <button type="button" className="secondary-button" onClick={closeEditor} disabled={busy}>Abbrechen</button>
              <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={busy || Boolean(exactDuplicate)}><Save aria-hidden="true" />{busy ? "Wird gespeichert …" : "Speichern"}</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
