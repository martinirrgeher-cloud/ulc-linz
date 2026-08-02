import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(".");
const distRoot = path.join(projectRoot, "dist");
const manifestPath = path.join(distRoot, ".vite", "manifest.json");
const reportPath = path.join(distRoot, "performance-budget-report.json");

const KiB = 1024;
const limits = Object.freeze({
  initialJavaScriptRaw: 560 * KiB,
  initialJavaScriptGzip: 170 * KiB,
  initialCssRaw: 260 * KiB,
  initialCssGzip: 42 * KiB,
  largestAsyncJavaScriptRaw: 120 * KiB,
  largestAsyncJavaScriptGzip: 38 * KiB,
  largestAsyncCssRaw: 40 * KiB,
  largestAsyncCssGzip: 12 * KiB,
  totalJavaScriptRaw: 1_250 * KiB,
  totalJavaScriptGzip: 380 * KiB,
  totalCssRaw: 285 * KiB,
  totalCssGzip: 55 * KiB,
});

function relative(file) {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

function kib(bytes) {
  return `${(bytes / KiB).toFixed(2)} KiB`;
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function assetMetric(file) {
  const content = await readFile(file);
  return {
    file: relative(file),
    rawBytes: content.length,
    gzipBytes: gzipSync(content, { level: 9 }).length,
  };
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  throw new Error(`Vite-Manifest fehlt oder ist ungueltig (${relative(manifestPath)}). Zuerst npm run build ausfuehren. ${error instanceof Error ? error.message : ""}`);
}

const manifestEntries = Object.entries(manifest);
const entryPair = manifestEntries.find(([, value]) => value && typeof value === "object" && value.isEntry === true);
assert.ok(entryPair, "Vite-Manifest enthaelt keinen Haupteinstieg.");

const manifestByKey = new Map(
  manifestEntries.map(([key, value]) => [key, value && typeof value === "object" ? { key, ...value } : value]),
);
const manifestByFile = new Map(
  manifestEntries
    .filter(([, value]) => value && typeof value === "object" && typeof value.file === "string")
    .map(([key, value]) => [value.file, { key, ...value }]),
);

function collectInitialFiles(entry) {
  const js = new Set();
  const css = new Set();
  const visited = new Set();

  function visit(chunk) {
    if (!chunk || typeof chunk !== "object" || visited.has(chunk.file)) return;
    visited.add(chunk.file);
    if (typeof chunk.file === "string" && chunk.file.endsWith(".js")) js.add(chunk.file);
    for (const cssFile of Array.isArray(chunk.css) ? chunk.css : []) css.add(cssFile);
    for (const importedFile of Array.isArray(chunk.imports) ? chunk.imports : []) {
      visit(manifestByKey.get(importedFile) ?? manifestByFile.get(importedFile));
    }
  }

  visit(entry);
  return { js, css };
}

const [, entry] = entryPair;
const initialFiles = collectInitialFiles(entry);
const allFiles = await collectFiles(distRoot);
const jsFiles = allFiles.filter((file) => file.endsWith(".js"));
const cssFiles = allFiles.filter((file) => file.endsWith(".css"));
const metricsByRelativeFile = new Map();

for (const file of [...jsFiles, ...cssFiles]) {
  const metric = await assetMetric(file);
  metricsByRelativeFile.set(path.relative(distRoot, file).split(path.sep).join("/"), metric);
}

function sum(files) {
  return [...files].reduce((total, file) => {
    const metric = metricsByRelativeFile.get(file);
    assert.ok(metric, `Manifest verweist auf fehlendes Asset: ${file}`);
    total.rawBytes += metric.rawBytes;
    total.gzipBytes += metric.gzipBytes;
    return total;
  }, { rawBytes: 0, gzipBytes: 0 });
}

function largest(metrics) {
  return [...metrics].sort((left, right) => right.rawBytes - left.rawBytes)[0] ?? {
    file: "-",
    rawBytes: 0,
    gzipBytes: 0,
  };
}

const jsMetrics = jsFiles.map((file) => metricsByRelativeFile.get(path.relative(distRoot, file).split(path.sep).join("/"))).filter(Boolean);
const cssMetrics = cssFiles.map((file) => metricsByRelativeFile.get(path.relative(distRoot, file).split(path.sep).join("/"))).filter(Boolean);
const initialJavaScript = sum(initialFiles.js);
const initialCss = sum(initialFiles.css);
const asyncJavaScriptMetrics = jsMetrics.filter((metric) => !initialFiles.js.has(path.relative(distRoot, path.join(projectRoot, metric.file)).split(path.sep).join("/")));
const asyncCssMetrics = cssMetrics.filter((metric) => !initialFiles.css.has(path.relative(distRoot, path.join(projectRoot, metric.file)).split(path.sep).join("/")));
const largestAsyncJavaScript = largest(asyncJavaScriptMetrics);
const largestAsyncCss = largest(asyncCssMetrics);
const totalJavaScript = jsMetrics.reduce((total, metric) => ({ rawBytes: total.rawBytes + metric.rawBytes, gzipBytes: total.gzipBytes + metric.gzipBytes }), { rawBytes: 0, gzipBytes: 0 });
const totalCss = cssMetrics.reduce((total, metric) => ({ rawBytes: total.rawBytes + metric.rawBytes, gzipBytes: total.gzipBytes + metric.gzipBytes }), { rawBytes: 0, gzipBytes: 0 });

const report = {
  generatedAt: new Date().toISOString(),
  entry: entryPair[0],
  limits,
  summary: {
    initialJavaScript,
    initialCss,
    largestAsyncJavaScript,
    largestAsyncCss,
    totalJavaScript,
    totalCss,
  },
  largestJavaScriptAssets: [...jsMetrics].sort((left, right) => right.rawBytes - left.rawBytes).slice(0, 10),
  largestCssAssets: [...cssMetrics].sort((left, right) => right.rawBytes - left.rawBytes).slice(0, 10),
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const checks = [
  ["initiales JavaScript roh", initialJavaScript.rawBytes, limits.initialJavaScriptRaw],
  ["initiales JavaScript gzip", initialJavaScript.gzipBytes, limits.initialJavaScriptGzip],
  ["initiales CSS roh", initialCss.rawBytes, limits.initialCssRaw],
  ["initiales CSS gzip", initialCss.gzipBytes, limits.initialCssGzip],
  ["groesster asynchroner JavaScript-Chunk roh", largestAsyncJavaScript.rawBytes, limits.largestAsyncJavaScriptRaw],
  ["groesster asynchroner JavaScript-Chunk gzip", largestAsyncJavaScript.gzipBytes, limits.largestAsyncJavaScriptGzip],
  ["groesster asynchroner CSS-Chunk roh", largestAsyncCss.rawBytes, limits.largestAsyncCssRaw],
  ["groesster asynchroner CSS-Chunk gzip", largestAsyncCss.gzipBytes, limits.largestAsyncCssGzip],
  ["gesamtes JavaScript roh", totalJavaScript.rawBytes, limits.totalJavaScriptRaw],
  ["gesamtes JavaScript gzip", totalJavaScript.gzipBytes, limits.totalJavaScriptGzip],
  ["gesamtes CSS roh", totalCss.rawBytes, limits.totalCssRaw],
  ["gesamtes CSS gzip", totalCss.gzipBytes, limits.totalCssGzip],
];

console.log("Performance-Budgetbericht");
console.log(`- Initiales JavaScript: ${kib(initialJavaScript.rawBytes)} roh / ${kib(initialJavaScript.gzipBytes)} gzip`);
console.log(`- Initiales CSS: ${kib(initialCss.rawBytes)} roh / ${kib(initialCss.gzipBytes)} gzip`);
console.log(`- Groesster asynchroner JS-Chunk: ${largestAsyncJavaScript.file} (${kib(largestAsyncJavaScript.rawBytes)} / ${kib(largestAsyncJavaScript.gzipBytes)} gzip)`);
console.log(`- Groesster asynchroner CSS-Chunk: ${largestAsyncCss.file} (${kib(largestAsyncCss.rawBytes)} / ${kib(largestAsyncCss.gzipBytes)} gzip)`);
console.log(`- Gesamtes JavaScript: ${kib(totalJavaScript.rawBytes)} roh / ${kib(totalJavaScript.gzipBytes)} gzip`);
console.log(`- Gesamtes CSS: ${kib(totalCss.rawBytes)} roh / ${kib(totalCss.gzipBytes)} gzip`);
console.log(`- Bericht: ${relative(reportPath)}`);

const exceeded = checks.filter(([, actual, maximum]) => actual > maximum);
for (const [label, actual, maximum] of checks) {
  console.log(`- ${label}: ${kib(actual)} / maximal ${kib(maximum)}${actual > maximum ? " UEBERSCHRITTEN" : ""}`);
}

assert.equal(
  exceeded.length,
  0,
  `Performance-Budget ueberschritten:\n${exceeded.map(([label, actual, maximum]) => `- ${label}: ${kib(actual)} > ${kib(maximum)}`).join("\n")}`,
);

console.log("Performance-Budgetpruefung erfolgreich.");
