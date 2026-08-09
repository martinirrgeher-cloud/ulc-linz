import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(".");
const sourceRoot = path.join(projectRoot, "src");
const mainPath = path.join(sourceRoot, "main.tsx");

const limits = Object.freeze({
  mainCssImports: 3,
  mainImportedBytes: 68_000,
  importantDeclarations: 38,
  duplicateSelectorRatio: 0.10,
  largestFileBytes: 56_000,
  largestFileLines: 3_100,
  maxRouteImportedBytes: 50_000,
  globalFeatureSelectorOccurrences: 269,
  legacyMediaQueries: 54,
});

const expectedRouteImports = Object.freeze({
  "pages/DashboardPage.tsx": ["dashboard.css"],
  "pages/HelpPage.tsx": ["help.css"],
  "pages/AthleteManagementPage.tsx": ["management.css"],
  "pages/UserManagementPage.tsx": ["management.css", "user-management-e5c.css"],
  "pages/KindertrainingDraftPage.tsx": ["kindertraining.css"],
  "pages/GroupTrainingPage.tsx": ["kindertraining.css"],
  "pages/KindertrainingStatisticsPage.tsx": ["statistics.css", "statistics-mobile.css"],
  "pages/GroupTrainingStatisticsPage.tsx": ["statistics.css", "statistics-mobile.css"],
  "pages/PerformanceRegistrationPage.tsx": [
    "performance-registration.css",
    "mobile-day-selector.css",
    "performance-registration-mobile.css",
  ],
  "pages/ExerciseCatalogPage.tsx": ["exercise-catalog.css", "exercise-catalog-mobile.css"],
  "pages/TrainingBlocksPage.tsx": ["training-blocks.css", "training-blocks-mobile.css"],
  "pages/TrainingPlanningPage.tsx": ["training-planning.css", "training-planning-mobile.css"],
  "pages/TrainingOverviewPage.tsx": ["training-overview.css", "training-overview-mobile.css"],
  "pages/TrainingDocumentationPage.tsx": [
    "training-documentation.css",
    "mobile-day-selector.css",
    "training-documentation-mobile.css",
  ],
  "pages/DropdownSettingsPage.tsx": ["dropdown-settings.css", "dropdown-settings-mobile.css"],
  "pages/DataImportPage.tsx": ["data-import.css", "data-import-mobile.css"],
  "pages/CountdownPage.tsx": ["countdown.css"],
});

const forbiddenMainImports = new Set(
  Object.values(expectedRouteImports).flat(),
);
forbiddenMainImports.delete("user-management-e5c.css");

const featureSelectorPattern = /\.(?:dashboard-page|module-section|management-|member-|athlete-|trainer-|training-group|permission-|masterdata-|exercise-|training-block|training-plan|training-planning|training-overview|training-doc|performance-|statistics-|data-import|data-export|dropdown-setting|mobile-day-selector)\b/;

const featureSelectorOccurrencePattern = /\.(?:dashboard-page|module-section|management-|member-|athlete-|trainer-|training-group|permission-|masterdata-|exercise-|training-block|training-plan|training-planning|training-overview|training-doc|performance-|statistics-|data-import|data-export|dropdown-setting|mobile-day-selector)\b/g;

const preferredMediaConditions = new Set([
  "(max-width: 760px)",
  "screen and (max-width: 760px)",
  "(max-width: 520px)",
  "(max-width: 390px)",
  "screen and (max-width: 390px)",
  "(pointer: coarse)",
  "screen and (pointer: coarse) and (max-width: 760px)",
  "(prefers-reduced-motion: reduce)",
  "(max-height: 500px) and (orientation: landscape)",
  "print",
]);

async function collectFiles(directory, predicate) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute, predicate));
    else if (entry.isFile() && predicate(entry.name)) files.push(absolute);
  }
  return files.sort();
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedUtf8Bytes(source) {
  return Buffer.byteLength(source.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function selectorsIn(source) {
  const selectors = [];
  const cleaned = withoutComments(source);
  const blockPattern = /([^{}]+)\{/g;
  for (const match of cleaned.matchAll(blockPattern)) {
    const prelude = match[1]?.trim() ?? "";
    if (!prelude || prelude.startsWith("@")) continue;
    for (const rawSelector of prelude.split(",")) {
      const selector = normalizeWhitespace(rawSelector);
      if (!selector || selector === "from" || selector === "to" || /^\d+(?:\.\d+)?%$/.test(selector)) continue;
      selectors.push(selector);
    }
  }
  return selectors;
}

function cssImportsIn(source) {
  return [...source.matchAll(/import\s+["']@\/styles\/([^"']+\.css)["'];?/g)]
    .map((match) => match[1]);
}

function relative(file) {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

const cssFiles = await collectFiles(sourceRoot, (name) => name.endsWith(".css"));
const sourceFiles = await collectFiles(sourceRoot, (name) => name.endsWith(".ts") || name.endsWith(".tsx"));
assert.ok(cssFiles.length > 0, "Keine CSS-Dateien unter src gefunden.");

const mainSource = await readFile(mainPath, "utf8");
const mainImportNames = cssImportsIn(mainSource);
const mainImports = mainImportNames.map((name) => path.join(sourceRoot, "styles", name));
assert.deepEqual(
  mainImportNames,
  ["global.css", "mobile.css", "mobile-foundation.css"],
  "main.tsx darf nur die drei globalen CSS-Basisdateien importieren.",
);
for (const name of mainImportNames) {
  assert.equal(forbiddenMainImports.has(name), false, `Feature-CSS darf nicht global importiert werden: ${name}`);
}

let routeCssImports = 0;
const routeImportMetrics = [];
for (const file of sourceFiles) {
  if (file === mainPath) continue;
  const source = await readFile(file, "utf8");
  const imports = cssImportsIn(source);
  routeCssImports += imports.length;
  if (imports.length === 0) continue;

  let importedBytes = 0;
  for (const name of imports) {
    const importPath = path.join(sourceRoot, "styles", name);
    try {
      importedBytes += normalizedUtf8Bytes(await readFile(importPath, "utf8"));
    } catch {
      throw new Error(`Routeimportierte CSS-Datei fehlt: ${name} in ${relative(file)}`);
    }
  }
  routeImportMetrics.push({
    file: relative(file),
    imports,
    importedBytes,
  });
}

for (const [relativePage, expectedImports] of Object.entries(expectedRouteImports)) {
  const pagePath = path.join(sourceRoot, relativePage);
  const pageSource = await readFile(pagePath, "utf8");
  const actualImports = cssImportsIn(pageSource);
  for (const expectedImport of expectedImports) {
    assert.ok(
      actualImports.includes(expectedImport),
      `${relativePage} muss ${expectedImport} routebezogen importieren.`,
    );
  }
  const expectedPositions = expectedImports.map((name) => actualImports.indexOf(name));
  assert.deepEqual(
    expectedPositions,
    [...expectedPositions].sort((left, right) => left - right),
    `CSS-Importreihenfolge ist in ${relativePage} nicht stabil.`,
  );
}

for (const commonMobileFile of ["mobile.css", "mobile-foundation.css"]) {
  const source = withoutComments(await readFile(path.join(sourceRoot, "styles", commonMobileFile), "utf8"));
  assert.equal(
    featureSelectorPattern.test(source),
    false,
    `${commonMobileFile} enthaelt weiterhin eindeutig featurebezogene Selektoren.`,
  );
}

const metrics = {
  fileCount: cssFiles.length,
  totalBytes: 0,
  totalLines: 0,
  mainCssImports: mainImports.length,
  mainImportedBytes: 0,
  routeCssImports,
  importantDeclarations: 0,
  mediaQueries: 0,
  uniqueMediaConditions: 0,
  maxWidthMediaQueries: 0,
  minWidthMediaQueries: 0,
  selectorOccurrences: 0,
  uniqueSelectors: 0,
  duplicateSelectorsAcrossFiles: 0,
  duplicateSelectorRatio: 0,
  legacyMediaQueries: 0,
  globalFeatureSelectorOccurrences: 0,
  largestRouteImport: null,
  largestFile: null,
};

const mediaConditions = new Set();
const selectorFiles = new Map();
const fileMetrics = [];

for (const file of cssFiles) {
  const source = await readFile(file, "utf8");
  const bytes = normalizedUtf8Bytes(source);
  const lines = source.split(/\r?\n/).length;
  const cleaned = withoutComments(source);
  const fileMetric = { file: relative(file), bytes, lines };
  fileMetrics.push(fileMetric);
  metrics.totalBytes += bytes;
  metrics.totalLines += lines;
  metrics.importantDeclarations += (cleaned.match(/!important\b/gi) ?? []).length;

  for (const match of cleaned.matchAll(/@media\s*([^\{]+)\{/gi)) {
    const condition = normalizeWhitespace(match[1] ?? "");
    metrics.mediaQueries += 1;
    mediaConditions.add(condition);
    if (!preferredMediaConditions.has(condition)) metrics.legacyMediaQueries += 1;
    if (/max-width/i.test(condition)) metrics.maxWidthMediaQueries += 1;
    if (/min-width/i.test(condition)) metrics.minWidthMediaQueries += 1;
  }

  for (const selector of selectorsIn(source)) {
    metrics.selectorOccurrences += 1;
    const owners = selectorFiles.get(selector) ?? new Set();
    owners.add(relative(file));
    selectorFiles.set(selector, owners);
  }
}

for (const importPath of mainImports) {
  try {
    metrics.mainImportedBytes += normalizedUtf8Bytes(await readFile(importPath, "utf8"));
  } catch {
    throw new Error(`Global importierte CSS-Datei fehlt: ${relative(importPath)}`);
  }
}

metrics.uniqueMediaConditions = mediaConditions.size;
metrics.uniqueSelectors = selectorFiles.size;
metrics.duplicateSelectorsAcrossFiles = [...selectorFiles.values()]
  .filter((owners) => owners.size > 1).length;
metrics.duplicateSelectorRatio = metrics.uniqueSelectors > 0
  ? metrics.duplicateSelectorsAcrossFiles / metrics.uniqueSelectors
  : 0;
metrics.largestRouteImport = [...routeImportMetrics]
  .sort((left, right) => right.importedBytes - left.importedBytes)[0] ?? null;
metrics.largestFile = [...fileMetrics].sort((left, right) => right.bytes - left.bytes)[0] ?? null;

const globalSource = withoutComments(await readFile(path.join(sourceRoot, "styles", "global.css"), "utf8"));
metrics.globalFeatureSelectorOccurrences = (globalSource.match(featureSelectorOccurrencePattern) ?? []).length;

const checks = [
  ["globale CSS-Imports in main.tsx", metrics.mainCssImports, limits.mainCssImports],
  ["global importierte CSS-Bytes", metrics.mainImportedBytes, limits.mainImportedBytes],
  ["!important-Deklarationen", metrics.importantDeclarations, limits.importantDeclarations],
  ["dateiuebergreifende Selektor-Duplikationsquote", metrics.duplicateSelectorRatio, limits.duplicateSelectorRatio],
  ["Legacy-Media-Queries ausserhalb der bevorzugten Breakpoints", metrics.legacyMediaQueries, limits.legacyMediaQueries],
  ["featurebezogene Selektorvorkommen in global.css", metrics.globalFeatureSelectorOccurrences, limits.globalFeatureSelectorOccurrences],
  ["groesster routebezogener CSS-Import in Bytes", metrics.largestRouteImport?.importedBytes ?? 0, limits.maxRouteImportedBytes],
  ["groesste CSS-Datei in Bytes", metrics.largestFile?.bytes ?? 0, limits.largestFileBytes],
  ["groesste CSS-Datei in Zeilen", metrics.largestFile?.lines ?? 0, limits.largestFileLines],
];

console.log("CSS-Architekturbericht");
console.log(`- Dateien: ${metrics.fileCount} (Beobachtung; kein starres Dateilimit mehr)`);
console.log(`- Gesamt: ${metrics.totalBytes} Bytes / ${metrics.totalLines} Zeilen (Beobachtung; Wachstum wird pro Einstieg/Route begrenzt)`);
console.log(`- Global aus main.tsx: ${metrics.mainCssImports} Dateien / ${metrics.mainImportedBytes} Bytes`);
console.log(`- Routebezogene CSS-Imports: ${metrics.routeCssImports} (Beobachtung; neue lazy Routen duerfen eigene CSS-Dateien erhalten)`);
console.log(`- Groesster routebezogener CSS-Import: ${metrics.largestRouteImport?.file ?? "-"} (${metrics.largestRouteImport?.importedBytes ?? 0} Bytes)`);
console.log(`- Media Queries: ${metrics.mediaQueries} (${metrics.uniqueMediaConditions} Bedingungen, ${metrics.legacyMediaQueries} Legacy-Vorkommen)`);
console.log(`- Selektoren: ${metrics.selectorOccurrences} Vorkommen / ${metrics.uniqueSelectors} eindeutig / ${metrics.duplicateSelectorsAcrossFiles} dateiuebergreifend doppelt (${(metrics.duplicateSelectorRatio * 100).toFixed(2)} %)`);
console.log(`- Featureselektoren in global.css: ${metrics.globalFeatureSelectorOccurrences}`);
console.log(`- !important: ${metrics.importantDeclarations}`);
if (metrics.largestFile) console.log(`- Groesste Datei: ${metrics.largestFile.file} (${metrics.largestFile.bytes} Bytes / ${metrics.largestFile.lines} Zeilen)`);

const exceeded = checks.filter(([, actual, maximum]) => actual > maximum);
for (const [label, actual, maximum] of checks) {
  const format = label.includes("quote")
    ? `${(actual * 100).toFixed(2)} % / maximal ${(maximum * 100).toFixed(2)} %`
    : `${actual} / maximal ${maximum}`;
  console.log(`- ${label}: ${format}${actual > maximum ? " UEBERSCHRITTEN" : ""}`);
}

assert.equal(
  exceeded.length,
  0,
  `CSS-Architekturbudget ueberschritten:\n${exceeded.map(([label, actual, maximum]) => `- ${label}: ${actual} > ${maximum}`).join("\n")}`,
);

console.log("CSS-Architekturpruefung erfolgreich.");
