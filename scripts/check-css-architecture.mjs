import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(".");
const sourceRoot = path.join(projectRoot, "src");
const mainPath = path.join(sourceRoot, "main.tsx");

const limits = Object.freeze({
  cssFiles: 32,
  totalBytes: 325_000,
  totalLines: 14_300,
  mainCssImports: 3,
  mainImportedBytes: 65_000,
  routeCssImports: 32,
  importantDeclarations: 38,
  mediaQueries: 135,
  uniqueMediaConditions: 28,
  maxWidthMediaQueries: 125,
  duplicateSelectorsAcrossFiles: 255,
  largestFileBytes: 56_000,
  largestFileLines: 3_100,
});

const expectedRouteImports = Object.freeze({
  "pages/DashboardPage.tsx": ["dashboard.css"],
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
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  if (file !== mainPath) routeCssImports += cssImportsIn(source).length;
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
  largestFile: null,
};

const mediaConditions = new Set();
const selectorFiles = new Map();
const fileMetrics = [];

for (const file of cssFiles) {
  const source = await readFile(file, "utf8");
  const fileStat = await stat(file);
  const lines = source.split(/\r?\n/).length;
  const cleaned = withoutComments(source);
  const fileMetric = { file: relative(file), bytes: fileStat.size, lines };
  fileMetrics.push(fileMetric);
  metrics.totalBytes += fileStat.size;
  metrics.totalLines += lines;
  metrics.importantDeclarations += (cleaned.match(/!important\b/gi) ?? []).length;

  for (const match of cleaned.matchAll(/@media\s*([^\{]+)\{/gi)) {
    const condition = normalizeWhitespace(match[1] ?? "");
    metrics.mediaQueries += 1;
    mediaConditions.add(condition);
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
    metrics.mainImportedBytes += (await stat(importPath)).size;
  } catch {
    throw new Error(`Global importierte CSS-Datei fehlt: ${relative(importPath)}`);
  }
}

metrics.uniqueMediaConditions = mediaConditions.size;
metrics.uniqueSelectors = selectorFiles.size;
metrics.duplicateSelectorsAcrossFiles = [...selectorFiles.values()]
  .filter((owners) => owners.size > 1).length;
metrics.largestFile = [...fileMetrics].sort((left, right) => right.bytes - left.bytes)[0] ?? null;

const checks = [
  ["CSS-Dateien", metrics.fileCount, limits.cssFiles],
  ["CSS-Quellgroesse", metrics.totalBytes, limits.totalBytes],
  ["CSS-Zeilen", metrics.totalLines, limits.totalLines],
  ["globale CSS-Imports in main.tsx", metrics.mainCssImports, limits.mainCssImports],
  ["global importierte CSS-Bytes", metrics.mainImportedBytes, limits.mainImportedBytes],
  ["routebezogene CSS-Imports", metrics.routeCssImports, limits.routeCssImports],
  ["!important-Deklarationen", metrics.importantDeclarations, limits.importantDeclarations],
  ["Media Queries", metrics.mediaQueries, limits.mediaQueries],
  ["unterschiedliche Media-Bedingungen", metrics.uniqueMediaConditions, limits.uniqueMediaConditions],
  ["max-width-Media-Queries", metrics.maxWidthMediaQueries, limits.maxWidthMediaQueries],
  ["dateiuebergreifend doppelte Selektoren", metrics.duplicateSelectorsAcrossFiles, limits.duplicateSelectorsAcrossFiles],
  ["groesste CSS-Datei in Bytes", metrics.largestFile?.bytes ?? 0, limits.largestFileBytes],
  ["groesste CSS-Datei in Zeilen", metrics.largestFile?.lines ?? 0, limits.largestFileLines],
];

console.log("CSS-Architekturbericht");
console.log(`- Dateien: ${metrics.fileCount}`);
console.log(`- Gesamt: ${metrics.totalBytes} Bytes / ${metrics.totalLines} Zeilen`);
console.log(`- Global aus main.tsx: ${metrics.mainCssImports} Dateien / ${metrics.mainImportedBytes} Bytes`);
console.log(`- Routebezogene CSS-Imports: ${metrics.routeCssImports}`);
console.log(`- Media Queries: ${metrics.mediaQueries} (${metrics.uniqueMediaConditions} Bedingungen, ${metrics.maxWidthMediaQueries} max-width, ${metrics.minWidthMediaQueries} min-width)`);
console.log(`- Selektoren: ${metrics.selectorOccurrences} Vorkommen / ${metrics.uniqueSelectors} eindeutig / ${metrics.duplicateSelectorsAcrossFiles} dateiuebergreifend doppelt`);
console.log(`- !important: ${metrics.importantDeclarations}`);
if (metrics.largestFile) console.log(`- Groesste Datei: ${metrics.largestFile.file} (${metrics.largestFile.bytes} Bytes / ${metrics.largestFile.lines} Zeilen)`);

const exceeded = checks.filter(([, actual, maximum]) => actual > maximum);
for (const [label, actual, maximum] of checks) {
  console.log(`- ${label}: ${actual} / maximal ${maximum}${actual > maximum ? " UEBERSCHRITTEN" : ""}`);
}

assert.equal(
  exceeded.length,
  0,
  `CSS-Architekturbudget ueberschritten:\n${exceeded.map(([label, actual, maximum]) => `- ${label}: ${actual} > ${maximum}`).join("\n")}`,
);

console.log("CSS-Architekturpruefung erfolgreich.");
