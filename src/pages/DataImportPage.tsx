import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { loadAthleteManagement } from "@/features/athletes/api";
import type { Athlete, LinkableUser, TrainingGroup } from "@/features/athletes/types";
import {
  athleteExportWorkbook,
  athleteTemplateWorkbook,
  createAthletePreview,
  createExercisePreview,
  downloadImportReport,
  exerciseExportWorkbook,
  exerciseTemplateWorkbook,
  runAthleteImport,
  runExerciseImport,
} from "@/features/data-import/importer";
import type {
  AthleteImportDraft,
  ExerciseImportDraft,
  ImportAction,
  ImportKind,
  ImportPreviewRow,
  ImportRunResult,
} from "@/features/data-import/types";
import { downloadXlsxWorkbook, readExcelWorkbook } from "@/features/data-import/workbook";
import { loadExerciseCatalog } from "@/features/exercise-catalog/api";
import type { ExerciseCatalogData } from "@/features/exercise-catalog/types";
import { useAuth } from "@/features/auth/AuthContext";

import { diagnosticErrorMessage } from "@/lib/diagnostics";
const EMPTY_CATALOG: ExerciseCatalogData = {
  categories: [],
  subcategories: [],
  materials: [],
  parameterOptions: [],
  groups: [],
  exercises: [],
};

type DataImportMode = "import" | "export";

type ExerciseExportFilters = {
  search: string;
  category: string;
  subcategory: string;
  material: string;
  groupId: string;
  video: "all" | "yes" | "no";
  active: "all" | "yes" | "no";
};

type AthleteExportFilters = {
  search: string;
  groupId: string;
  active: "all" | "yes" | "no";
};

const EMPTY_EXERCISE_FILTERS: ExerciseExportFilters = {
  search: "",
  category: "",
  subcategory: "",
  material: "",
  groupId: "",
  video: "all",
  active: "all",
};

const EMPTY_ATHLETE_FILTERS: AthleteExportFilters = {
  search: "",
  groupId: "",
  active: "all",
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("de-AT");
}

function errorMessage(error: unknown): string {
  return diagnosticErrorMessage(error, "Die Importdatei konnte nicht verarbeitet werden.", "data_import");
}

function createImportRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

export function DataImportPage() {
  const { appContext, canEditModule } = useAuth();
  const organizationId = appContext?.organization?.id;
  const canImportExercises = canEditModule("exercise_catalog");
  const canImportAthletes = canEditModule("athletes");
  const canCreateOptions = canEditModule("dropdown_settings");
  const [activeMode, setActiveMode] = useState<DataImportMode>("import");
  const [activeKind, setActiveKind] = useState<ImportKind>(canImportExercises ? "exercises" : "athletes");
  const [catalog, setCatalog] = useState<ExerciseCatalogData>(EMPTY_CATALOG);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [linkableUsers, setLinkableUsers] = useState<LinkableUser[]>([]);
  const [exerciseRows, setExerciseRows] = useState<ImportPreviewRow<ExerciseImportDraft>[]>([]);
  const [athleteRows, setAthleteRows] = useState<ImportPreviewRow<AthleteImportDraft>[]>([]);
  const [exerciseFilters, setExerciseFilters] = useState<ExerciseExportFilters>(EMPTY_EXERCISE_FILTERS);
  const [athleteFilters, setAthleteFilters] = useState<AthleteExportFilters>(EMPTY_ATHLETE_FILTERS);
  const [fileName, setFileName] = useState("");
  const [createMissingOptions, setCreateMissingOptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [importRunId, setImportRunId] = useState(createImportRunId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [catalogData, athleteData] = await Promise.all([
        canImportExercises ? loadExerciseCatalog(organizationId, true) : Promise.resolve(EMPTY_CATALOG),
        canImportAthletes
          ? loadAthleteManagement(organizationId, true)
          : Promise.resolve({ athletes: [], groups: [], trainers: [], linkableUsers: [] }),
      ]);
      setCatalog(catalogData);
      setAthletes(athleteData.athletes);
      setGroups(athleteData.groups);
      setLinkableUsers(athleteData.linkableUsers);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canImportAthletes, canImportExercises, organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeKind === "exercises" && !canImportExercises && canImportAthletes) setActiveKind("athletes");
    if (activeKind === "athletes" && !canImportAthletes && canImportExercises) setActiveKind("exercises");
  }, [activeKind, canImportAthletes, canImportExercises]);

  const activeRows = activeKind === "exercises" ? exerciseRows : athleteRows;
  const totals = useMemo(() => ({
    ready: activeRows.filter((row) => row.errors.length === 0 && row.action !== "skip").length,
    errors: activeRows.filter((row) => row.errors.length > 0).length,
    warnings: activeRows.filter((row) => row.warnings.length > 0).length,
    skipped: activeRows.filter((row) => row.action === "skip").length,
  }), [activeRows]);

  const unresolvedExerciseOptions = activeKind === "exercises"
    && !createMissingOptions
    && exerciseRows.some((row) => row.action !== "skip" && row.warnings.some((warning) => warning.includes("ist nicht vorhanden")));

  const actionableExistingRows = activeRows.filter((row) => row.existingId && row.errors.length === 0);
  const updateAllExisting = actionableExistingRows.length > 0
    && actionableExistingRows.every((row) => row.action === "update");

  const filteredExercises = useMemo(() => catalog.exercises.filter((exercise) => {
    const query = normalized(exerciseFilters.search);
    if (query && !normalized(`${exercise.name} ${exercise.description ?? ""} ${exercise.goal ?? ""}`).includes(query)) return false;
    if (exerciseFilters.category && exercise.categoryKey !== exerciseFilters.category) return false;
    if (exerciseFilters.subcategory && exercise.subcategory !== exerciseFilters.subcategory) return false;
    if (exerciseFilters.material && !exercise.equipment.includes(exerciseFilters.material)) return false;
    if (exerciseFilters.groupId && !exercise.groupIds.includes(exerciseFilters.groupId)) return false;
    if (exerciseFilters.video === "yes" && !exercise.videoUrl && exercise.videos.length === 0) return false;
    if (exerciseFilters.video === "no" && (Boolean(exercise.videoUrl) || exercise.videos.length > 0)) return false;
    if (exerciseFilters.active === "yes" && !exercise.isActive) return false;
    if (exerciseFilters.active === "no" && exercise.isActive) return false;
    return true;
  }), [catalog.exercises, exerciseFilters]);

  const filteredAthletes = useMemo(() => athletes.filter((athlete) => {
    const query = normalized(athleteFilters.search);
    if (query && !normalized(`${athlete.firstName} ${athlete.lastName}`).includes(query)) return false;
    if (athleteFilters.groupId && !athlete.groups.some((group) => group.id === athleteFilters.groupId)) return false;
    if (athleteFilters.active === "yes" && !athlete.isActive) return false;
    if (athleteFilters.active === "no" && athlete.isActive) return false;
    return true;
  }), [athleteFilters, athletes]);

  if (!organizationId || (!canImportExercises && !canImportAthletes)) {
    return <Navigate to="/kein-zugriff" replace />;
  }

  function resetPreview() {
    setExerciseRows([]);
    setAthleteRows([]);
    setFileName("");
    setResult(null);
    setError(null);
    setImportRunId(createImportRunId());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const workbook = await readExcelWorkbook(file);
      if (activeKind === "exercises") {
        const preview = createExercisePreview(workbook, catalog, canCreateOptions);
        if (preview.length === 0) throw new Error("Im Tabellenblatt „Übungen“ wurden keine importierbaren Daten gefunden.");
        setExerciseRows(preview);
      } else {
        const preview = createAthletePreview(workbook, athletes, groups, linkableUsers);
        if (preview.length === 0) throw new Error("Im Tabellenblatt „Athleten“ wurden keine importierbaren Daten gefunden.");
        setAthleteRows(preview);
      }
      setFileName(file.name);
      setImportRunId(createImportRunId());
    } catch (fileError) {
      setError(errorMessage(fileError));
    } finally {
      setBusy(false);
    }
  }

  function setRowAction(index: number, action: ImportAction) {
    setImportRunId(createImportRunId());
    if (activeKind === "exercises") {
      setExerciseRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, action } : row));
    } else {
      setAthleteRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, action } : row));
    }
  }

  function setAllExistingRows(updateExisting: boolean) {
    setImportRunId(createImportRunId());
    const updateRows = <T,>(rows: ImportPreviewRow<T>[]): ImportPreviewRow<T>[] => rows.map((row) => {
      if (!row.existingId || row.errors.length > 0) return row;
      return { ...row, action: updateExisting ? "update" : "skip" };
    });

    if (activeKind === "exercises") {
      setExerciseRows((current) => updateRows(current));
    } else {
      setAthleteRows((current) => updateRows(current));
    }
  }

  function downloadTemplate() {
    if (activeKind === "exercises") {
      downloadXlsxWorkbook("ULC-Uebungen-Importvorlage.xlsx", exerciseTemplateWorkbook(catalog));
    } else {
      downloadXlsxWorkbook("ULC-Athleten-Importvorlage.xlsx", athleteTemplateWorkbook(groups, linkableUsers));
    }
  }

  function downloadExport() {
    const date = new Date().toISOString().slice(0, 10);
    if (activeKind === "exercises") {
      downloadXlsxWorkbook(`ULC-Uebungen-Export-${date}.xlsx`, exerciseExportWorkbook(catalog, filteredExercises));
    } else {
      downloadXlsxWorkbook(`ULC-Athleten-Export-${date}.xlsx`, athleteExportWorkbook(filteredAthletes, groups, linkableUsers));
    }
  }

  function resetExportFilters() {
    if (activeKind === "exercises") setExerciseFilters(EMPTY_EXERCISE_FILTERS);
    else setAthleteFilters(EMPTY_ATHLETE_FILTERS);
  }

  async function runImport() {
    if (!organizationId || totals.ready === 0 || unresolvedExerciseOptions) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const importResult = activeKind === "exercises"
        ? await runExerciseImport(organizationId, importRunId, exerciseRows, createMissingOptions)
        : await runAthleteImport(organizationId, importRunId, athleteRows);
      setResult(importResult);
      setExerciseRows([]);
      setAthleteRows([]);
      setFileName("");
      setCreateMissingOptions(false);
      setImportRunId(createImportRunId());
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setBusy(false);
    }
  }

  const exportCount = activeKind === "exercises" ? filteredExercises.length : filteredAthletes.length;

  return (
    <section className="data-import-page">
      <div className="data-import-heading">
        <div>
          <p className="eyebrow">Stammdaten</p>
          <h1>Datenimport/-export</h1>
          <p>Übungen und Athleten gesammelt exportieren, ergänzen, prüfen und wieder einlesen.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <nav className="data-import-mode-tabs" aria-label="Import oder Export auswählen">
        <button type="button" className={activeMode === "import" ? "active" : ""} onClick={() => setActiveMode("import")}>
          <Upload aria-hidden="true" />Import
        </button>
        <button type="button" className={activeMode === "export" ? "active" : ""} onClick={() => setActiveMode("export")}>
          <FileDown aria-hidden="true" />Export
        </button>
      </nav>

      <nav className="data-import-tabs" aria-label="Datenart auswählen">
        {canImportExercises && (
          <button type="button" className={activeKind === "exercises" ? "active" : ""} onClick={() => { setActiveKind("exercises"); resetPreview(); }}>
            <FileSpreadsheet aria-hidden="true" />Übungen
          </button>
        )}
        {canImportAthletes && (
          <button type="button" className={activeKind === "athletes" ? "active" : ""} onClick={() => { setActiveKind("athletes"); resetPreview(); }}>
            <UsersRound aria-hidden="true" />Athleten
          </button>
        )}
      </nav>

      {activeMode === "import" ? (
        <>
          <section className="data-import-start-card">
            <div>
              <h2>{activeKind === "exercises" ? "Übungskatalog importieren" : "Athleten importieren"}</h2>
              <p>
                Die Vorlage enthält alle Daten in einem sichtbaren Tabellenblatt. Bestehende Exporte können ergänzt und anschließend wieder eingelesen werden.
              </p>
            </div>
            <div className="data-import-start-actions">
              <button type="button" className="secondary-button" onClick={downloadTemplate} disabled={loading || busy}>
                <Download aria-hidden="true" />Leere Vorlage
              </button>
              <label className={`primary-button data-import-file-button ${busy ? "disabled" : ""}`}>
                <Upload aria-hidden="true" />Datei auswählen
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/xml,text/xml"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => void handleFile(event.target.files?.[0] ?? null)}
                  disabled={busy}
                />
              </label>
            </div>
            <small className="data-import-file-name">Unterstützt: XLSX oder Excel-XML, maximal 5 MB und 1.000 Datenzeilen.</small>
            {fileName && <small className="data-import-file-name">Geladen: {fileName}</small>}
          </section>

          {activeKind === "exercises" && canCreateOptions && exerciseRows.length > 0 && (
            <label className="data-import-option">
              <input
                type="checkbox"
                checked={createMissingOptions}
                onChange={(event: ChangeEvent<HTMLInputElement>) => { setCreateMissingOptions(event.target.checked); setImportRunId(createImportRunId()); }}
              />
              <span>
                <strong>Unbekannte Auswahllistenwerte automatisch anlegen</strong>
                <small>
                  Beispiel: Steht in Excel das Material „Schlitten“, das in den Stammdaten noch fehlt,
                  wird es dort neu angelegt und der Übung zugeordnet. Das gilt für Kategorien,
                  Unterkategorien, Materialien und Planungsparameter. Trainingsgruppen werden nie automatisch angelegt.
                </small>
              </span>
            </label>
          )}

          {activeRows.length > 0 && (
            <>
              {unresolvedExerciseOptions && (
                <div className="alert error">
                  Für ausgewählte Übungen fehlen Auswahllistenwerte. Aktiviere „Unbekannte Auswahllistenwerte automatisch anlegen“ oder überspringe diese Zeilen.
                </div>
              )}
              <div className="data-import-summary">
                <span className="ready"><CheckCircle2 aria-hidden="true" />{totals.ready} bereit</span>
                <span className="warning"><AlertTriangle aria-hidden="true" />{totals.warnings} mit Hinweis</span>
                <span className="error"><XCircle aria-hidden="true" />{totals.errors} fehlerhaft</span>
                <span>{totals.skipped} übersprungen</span>
              </div>

              {actionableExistingRows.length > 0 && (
                <label className="data-import-option">
                  <input
                    type="checkbox"
                    checked={updateAllExisting}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setAllExistingRows(event.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    <strong>Alle {actionableExistingRows.length} erkannten Datensätze aktualisieren</strong>
                    <small>
                      Aktiviert bei allen bereits vorhandenen Datensätzen „Aktualisieren“.
                      Neue Datensätze und fehlerhafte Zeilen bleiben unverändert.
                    </small>
                  </span>
                </label>
              )}

              <div className="data-import-preview-list">
                {activeRows.map((row, index) => (
                  <article className={`data-import-preview-row ${row.severity}`} key={`${row.rowNumber}-${row.key}`}>
                    <div className="data-import-preview-main">
                      <span className="data-import-row-number">{row.rowNumber}</span>
                      <div>
                        <strong>{row.label}</strong>
                        <small>
                          {row.existingId ? "Bestehender Datensatz erkannt" : "Neuer Datensatz"}
                          {activeKind === "exercises" && (row.value as ExerciseImportDraft).category ? ` · ${(row.value as ExerciseImportDraft).category}` : ""}
                          {activeKind === "athletes" && (row.value as AthleteImportDraft).birthYear ? ` · ${(row.value as AthleteImportDraft).birthYear}` : ""}
                        </small>
                      </div>
                    </div>
                    <select
                      value={row.action}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => setRowAction(index, event.target.value as ImportAction)}
                      disabled={row.errors.length > 0 || busy}
                      aria-label={`Aktion für ${row.label}`}
                    >
                      {!row.existingId && <option value="create">Neu anlegen</option>}
                      {row.existingId && <option value="update">Aktualisieren</option>}
                      <option value="skip">Überspringen</option>
                    </select>
                    {(row.errors.length > 0 || row.warnings.length > 0) && (
                      <div className="data-import-messages">
                        {row.errors.map((message) => <span className="error" key={message}>{message}</span>)}
                        {row.warnings.map((message) => <span className="warning" key={message}>{message}</span>)}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <div className="data-import-footer">
                <button type="button" className="secondary-button" onClick={resetPreview} disabled={busy}>Abbrechen</button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void runImport()}
                  disabled={busy || totals.ready === 0 || unresolvedExerciseOptions}
                  title={unresolvedExerciseOptions ? "Fehlende Auswahllistenwerte zuerst anlegen oder betroffene Zeilen überspringen." : undefined}
                >
                  <Upload aria-hidden="true" />{busy ? "Import läuft …" : `${totals.ready} Datensätze importieren`}
                </button>
              </div>
            </>
          )}

          {result && (
            <section className={`data-import-result ${result.failed > 0 ? "with-errors" : "success"}`}>
              <div>
                <h2>Import abgeschlossen</h2>
                <p>{result.created} neu angelegt · {result.updated} aktualisiert · {result.skipped} übersprungen · {result.failed} Fehler</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => downloadImportReport(result, activeKind === "exercises" ? "Uebungen" : "Athleten")}>
                <Download aria-hidden="true" />Importprotokoll
              </button>
            </section>
          )}

          {!loading && activeRows.length === 0 && !result && (
            <div className="data-import-empty">
              <FileSpreadsheet aria-hidden="true" />
              <h2>Noch keine Datei gewählt</h2>
              <p>Die App prüft Hauptdaten, Kontakte, Planungsparameter, Auswahllisten und mögliche Dubletten vor dem Speichern.</p>
            </div>
          )}
        </>
      ) : (
        <section className="data-export-card">
          <div className="data-export-heading">
            <div>
              <h2>{activeKind === "exercises" ? "Übungen exportieren" : "Athleten exportieren"}</h2>
              <p>Der Export entspricht der Importvorlage: ein sichtbares Datenblatt mit Dropdownfeldern und allen Zusatzinformationen.</p>
            </div>
            <button type="button" className="secondary-button compact" onClick={resetExportFilters} disabled={loading || busy}>
              <RotateCcw aria-hidden="true" />Filter zurücksetzen
            </button>
          </div>

          {activeKind === "exercises" ? (
            <div className="data-export-filters">
              <label><span>Übung suchen</span><input value={exerciseFilters.search} onChange={(event) => setExerciseFilters((current) => ({ ...current, search: event.target.value }))} /></label>
              <label><span>Kategorie</span><select value={exerciseFilters.category} onChange={(event) => setExerciseFilters((current) => ({ ...current, category: event.target.value }))}><option value="">Alle</option>{catalog.categories.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</select></label>
              <label><span>Unterkategorie</span><select value={exerciseFilters.subcategory} onChange={(event) => setExerciseFilters((current) => ({ ...current, subcategory: event.target.value }))}><option value="">Alle</option>{catalog.subcategories.map((item) => <option key={item.key} value={item.label}>{item.label}</option>)}</select></label>
              <label><span>Material</span><select value={exerciseFilters.material} onChange={(event) => setExerciseFilters((current) => ({ ...current, material: event.target.value }))}><option value="">Alle</option>{catalog.materials.map((item) => <option key={item.key} value={item.label}>{item.label}</option>)}</select></label>
              <label><span>Trainingsgruppe</span><select value={exerciseFilters.groupId} onChange={(event) => setExerciseFilters((current) => ({ ...current, groupId: event.target.value }))}><option value="">Alle</option>{catalog.groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>Video</span><select value={exerciseFilters.video} onChange={(event) => setExerciseFilters((current) => ({ ...current, video: event.target.value as ExerciseExportFilters["video"] }))}><option value="all">Alle</option><option value="yes">Vorhanden</option><option value="no">Nicht vorhanden</option></select></label>
              <label><span>Status</span><select value={exerciseFilters.active} onChange={(event) => setExerciseFilters((current) => ({ ...current, active: event.target.value as ExerciseExportFilters["active"] }))}><option value="all">Alle</option><option value="yes">Aktiv</option><option value="no">Inaktiv</option></select></label>
            </div>
          ) : (
            <div className="data-export-filters athlete">
              <label><span>Athlet suchen</span><input value={athleteFilters.search} onChange={(event) => setAthleteFilters((current) => ({ ...current, search: event.target.value }))} /></label>
              <label><span>Trainingsgruppe</span><select value={athleteFilters.groupId} onChange={(event) => setAthleteFilters((current) => ({ ...current, groupId: event.target.value }))}><option value="">Alle</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>Status</span><select value={athleteFilters.active} onChange={(event) => setAthleteFilters((current) => ({ ...current, active: event.target.value as AthleteExportFilters["active"] }))}><option value="all">Alle</option><option value="yes">Aktiv</option><option value="no">Inaktiv</option></select></label>
            </div>
          )}

          <div className="data-export-footer">
            <span>{exportCount} {activeKind === "exercises" ? "Übungen" : "Athleten"} ausgewählt</span>
            <button type="button" className="primary-button" onClick={downloadExport} disabled={loading || busy || exportCount === 0}>
              <FileDown aria-hidden="true" />Gefilterte Daten exportieren
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
