import "./check-training-module-architecture.mjs";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(".");
const sourceRoot = path.join(projectRoot, "src");
const featureRoot = path.join(sourceRoot, "features");

async function collectFiles(directory, predicate) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute, predicate));
    else if (entry.isFile() && predicate(entry.name)) files.push(absolute);
  }
  return files.sort();
}

const featureFiles = await collectFiles(featureRoot, (name) => name.endsWith(".ts") || name.endsWith(".tsx"));
const jsonHelperPath = path.join(sourceRoot, "lib", "json-value.ts");
const rpcHelperPath = path.join(sourceRoot, "lib", "supabase-rpc.ts");
const jsonHelper = await readFile(jsonHelperPath, "utf8");
const rpcHelper = await readFile(rpcHelperPath, "utf8");

for (const symbol of ["isRecord", "numberOrNull", "parseStringArray"]) {
  assert.match(jsonHelper, new RegExp(`export function ${symbol}\\b`), `Gemeinsamer JSON-Helper ${symbol} fehlt.`);
}
assert.match(rpcHelper, /export async function callJsonRpc\b/, "Gemeinsamer RPC-Helper callJsonRpc fehlt.");
assert.match(rpcHelper, /export async function callJsonRpcRawError\b/, "RPC-Rohfehlermodus fehlt.");
assert.match(rpcHelper, /supabase\.rpc\.bind\(supabase\)/, "RPC-Zugriff muss zentral typisiert bleiben.");

const forbiddenDefinitions = [
  /function\s+isRecord\s*\(/,
  /function\s+numberOrNull\s*\(/,
  /function\s+parseStringArray\s*\(/,
  /async\s+function\s+callJsonRpc\s*\(/,
  /\.rpc\.bind\(/,
];

let jsonImports = 0;
let rpcImports = 0;
const violations = [];

for (const file of featureFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(projectRoot, file).split(path.sep).join("/");
  if (source.includes('from "@/lib/json-value"')) jsonImports += 1;
  if (source.includes('from "@/lib/supabase-rpc"')) rpcImports += 1;

  for (const pattern of forbiddenDefinitions) {
    if (pattern.test(source)) {
      violations.push(`${relative}: ${pattern}`);
    }
  }
}

assert.equal(
  violations.length,
  0,
  `Feature-APIs duplizieren wieder gemeinsame JSON/RPC-Basislogik:\n${violations.join("\n")}`,
);
assert.ok(jsonImports >= 14, `Zu wenige Feature-Dateien nutzen die gemeinsame JSON-Basis: ${jsonImports} < 14.`);
assert.ok(rpcImports >= 13, `Zu wenige Feature-Dateien nutzen die gemeinsame RPC-Basis: ${rpcImports} < 13.`);

console.log(`API-Skalierungsbasis erfolgreich: ${jsonImports} JSON-Nutzer / ${rpcImports} RPC-Nutzer, keine lokalen Basisduplikate.`);
