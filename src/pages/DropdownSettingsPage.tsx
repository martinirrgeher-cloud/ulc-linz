import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Info, ListPlus, Pencil, Plus } from "lucide-react";
import { EditorShell } from "@/components/ui/EditorShell";
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
import {
  EXERCISE_PARAMETER_GROUPS,
  exerciseParameterGroupLabel,
} from "@/features/exercise-catalog/parameter-groups";
import { diagnosticErrorMessage } from "@/lib/diagnostics";
import "@/styles/dropdown-settings.css";
import "@/styles/dropdown-settings-mobile.css";

const EMPTY_DATA: DropdownSettingsData = {
  category: [],
  subcategory: [],
  material: [],
  difficulty: [],
  planning_parameter: [],
};

const LIST_SINGULAR: Record<DropdownListKey, string> = {
  category: "Kategorie",
  subcategory: "Unterkategorie",
  material: "Material",
  difficulty: "Schwierigkeit",
  planning_parameter: "Planungsparameter",
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
  const [editorActive, setEditorActive] = useState(true);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const createMenuRef = useRef<HTMLDetailsElement>(null);

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

  const activeCount = useCallback(
    (key: DropdownListKey) => data[key].filter((option) => option.isActive).length,
    [data],
  );

  function selectList(key: DropdownListKey) {
    setActiveList(key);
    setEditing(undefined);
    setIntroOpen(false);
  }

  function startEdit(option: DropdownSettingOption | null, listKey: DropdownListKey = activeList) {
    setActiveList(listKey);
    setEditing(option);
    setValues(optionToInput(option));
    setEditorActive(option?.isActive ?? true);
    setEditorError(null);
    setError(null);
    setSuccess(null);
    setIntroOpen(false);
  }

  function startCreate(listKey: DropdownListKey) {
    createMenuRef.current?.removeAttribute("open");
    startEdit(null, listKey);
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
      if (editing && editorActive !== editing.isActive) {
        await setDropdownSettingActive(organizationId, activeList, editing, editorActive);
      }
      closeEditor();
      setSuccess(editing ? "Der Eintrag wurde gespeichert." : "Der Eintrag wurde angelegt.");
      await loadData();
    } catch (saveError) {
      setEditorError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  const editorTitle = `${LIST_SINGULAR[activeList]} ${editing ? "bearbeiten" : "anlegen"}`;
  const editorOpen = editing !== undefined;

  return (
    <section className="dropdown-settings-page">
      {editorOpen ? (
        <EditorShell
          eyebrow="Auswahllisten"
          title={editorTitle}
          canEdit={canEdit}
          busy={busy}
          canSave={!exactDuplicate && values.label.trim().length >= 2}
          saveLabel="Speichern"
          saveTestId="dropdown-setting-save"
          closeLabel="Bearbeitung schließen"
          onSave={() => void handleSave()}
          onClose={closeEditor}
        >
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
                  <span>Parametergruppe</span>
                  <select value={values.parameterGroup} onChange={(event) => update("parameterGroup", event.target.value as DropdownSettingInput["parameterGroup"])}>
                    {EXERCISE_PARAMETER_GROUPS.map((group) => <option value={group.key} key={group.key}>{group.label}</option>)}
                  </select>
                  <small>Die Gruppe steuert die übersichtliche Anordnung im Übungseditor.</small>
                </label>
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
            {editing && (
              <label className="dropdown-setting-active-toggle">
                <input type="checkbox" checked={editorActive} onChange={(event) => setEditorActive(event.target.checked)} />
                <span><strong>Aktiv</strong><small>Inaktive Einträge bleiben bei bestehenden Daten erhalten.</small></span>
              </label>
            )}
          </div>
        </EditorShell>
      ) : (
        <>
          <div className="dropdown-settings-heading">
            <div>
              <p className="eyebrow">Stammdaten</p>
              <h1>Auswahllisten</h1>
            </div>
            {canEdit && (
              <details className="dropdown-create-menu" ref={createMenuRef}>
                <summary
                  className="primary-button dropdown-create-menu-toggle"
                  aria-label="Neuen Auswahllisteneintrag anlegen"
                  aria-disabled={loading || busy}
                  onClick={(event) => { if (loading || busy) event.preventDefault(); }}
                >
                  <Plus aria-hidden="true" /> Neu <ChevronDown aria-hidden="true" />
                </summary>
                <div className="dropdown-create-menu-panel" role="menu" aria-label="Auswahlliste auswählen">
                  {DROPDOWN_LISTS.map((list) => (
                    <button type="button" role="menuitem" onClick={() => startCreate(list.key)} key={list.key}>
                      <Plus aria-hidden="true" />
                      <span>{LIST_SINGULAR[list.key]} anlegen</span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="dropdown-settings-selector-row">
            <label className="dropdown-settings-selector">
              <span className="sr-only">Auswahlliste</span>
              <select value={activeList} onChange={(event) => selectList(event.target.value as DropdownListKey)} aria-label="Auswahlliste auswählen">
                {DROPDOWN_LISTS.map((list) => <option value={list.key} key={list.key}>{list.title} · {activeCount(list.key)}</option>)}
              </select>
            </label>
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
                        ? `${exerciseParameterGroupLabel(option.parameterGroup)} · ${option.inputType === "number" ? "Zahl" : "Text"}${option.unit ? ` · ${option.unit}` : ""}${option.stepValue ? ` · Schritt ${option.stepValue}` : ""} · ${option.usageCount}-mal verwendet`
                        : `${option.usageCount}-mal verwendet`}
                    </small>
                  </div>
                  {canEdit && (
                    <button className="dropdown-setting-edit-button" type="button" onClick={() => startEdit(option)} disabled={busy} aria-label={`${option.label} bearbeiten`} title="Bearbeiten">
                      <Pencil aria-hidden="true" />
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
