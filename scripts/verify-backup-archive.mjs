import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const sourceRoot = path.resolve(process.argv[2] ?? "backup");
const checksumPath = path.join(sourceRoot, "SHA256SUMS");

const requiredFiles = [
  "RESTORE-HINWEIS.txt",
  "database/roles.sql",
  "database/schema.sql",
  "database/data.sql",
  "database/full-database.dump",
  "storage/storage-manifest.json",
  "project/config.toml",
  "project/restore-supabase-storage.mjs",
  "project/README-BACKUP.md",
];

function safeResolve(relativePath) {
  const normalized = relativePath.replace(/^\.\//, "");
  const resolved = path.resolve(sourceRoot, normalized);
  if (resolved !== sourceRoot && !resolved.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`Unsicherer Pfad im Backup: ${relativePath}`);
  }
  return resolved;
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function listFiles(directory, relativeRoot = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeRoot, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

async function requireNonEmpty(relativePath) {
  const filePath = safeResolve(relativePath);
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size <= 0) {
    throw new Error(`Pflichtdatei fehlt oder ist leer: ${relativePath}`);
  }
  return fileStat.size;
}

for (const relativePath of requiredFiles) {
  await requireNonEmpty(relativePath);
}

const migrationDirectory = safeResolve("project/migrations");
const migrationEntries = await readdir(migrationDirectory, { withFileTypes: true });
const migrationCount = migrationEntries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql")).length;
if (migrationCount === 0) {
  throw new Error("Das Backup enthält keine SQL-Migrationen.");
}

const checksumText = await readFile(checksumPath, "utf8");
const checksumEntries = new Map();
for (const rawLine of checksumText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line) continue;
  const match = line.match(/^([a-fA-F0-9]{64})\s+[* ]?(.*)$/);
  if (!match) {
    throw new Error(`Ungültige Zeile in SHA256SUMS: ${rawLine}`);
  }
  const relativePath = match[2].replace(/^\.\//, "");
  if (relativePath === "SHA256SUMS") {
    throw new Error("SHA256SUMS darf sich nicht selbst enthalten.");
  }
  checksumEntries.set(relativePath, match[1].toLowerCase());
}

const archiveFiles = (await listFiles(sourceRoot))
  .filter((relativePath) => relativePath !== "SHA256SUMS")
  .sort();
const checksumFiles = [...checksumEntries.keys()].sort();

if (archiveFiles.length !== checksumFiles.length) {
  throw new Error(`Prüfsummenliste unvollständig: ${checksumFiles.length} Einträge für ${archiveFiles.length} Dateien.`);
}
for (let index = 0; index < archiveFiles.length; index += 1) {
  if (archiveFiles[index] !== checksumFiles[index]) {
    throw new Error(`Prüfsummenliste stimmt nicht mit dem Archiv überein: ${archiveFiles[index]} / ${checksumFiles[index]}.`);
  }
}

for (const [relativePath, expectedHash] of checksumEntries) {
  const actualHash = await hashFile(safeResolve(relativePath));
  if (actualHash !== expectedHash) {
    throw new Error(`Prüfsumme stimmt nicht: ${relativePath}`);
  }
}

const fullDumpPath = safeResolve("database/full-database.dump");
const dumpHeader = Buffer.alloc(5);
await new Promise((resolve, reject) => {
  const stream = createReadStream(fullDumpPath, { start: 0, end: 4 });
  let offset = 0;
  stream.on("data", (chunk) => {
    chunk.copy(dumpHeader, offset);
    offset += chunk.length;
  });
  stream.on("end", resolve);
  stream.on("error", reject);
});
if (dumpHeader.toString("ascii") !== "PGDMP") {
  throw new Error("full-database.dump ist kein gültiger PostgreSQL-Custom-Dump.");
}

const manifest = JSON.parse(await readFile(safeResolve("storage/storage-manifest.json"), "utf8"));
if (!Array.isArray(manifest.buckets)) {
  throw new Error("Das Storage-Manifest enthält keine gültige Bucket-Liste.");
}

let storageFileCount = 0;
let storageBytes = 0;
for (const bucket of manifest.buckets) {
  if (!bucket?.name || !Array.isArray(bucket.objects)) {
    throw new Error("Ungültiger Bucket-Eintrag im Storage-Manifest.");
  }
  for (const object of bucket.objects) {
    if (!object?.name || !object?.localPath) {
      throw new Error(`Ungültiger Storage-Eintrag in Bucket ${bucket.name}.`);
    }
    const localPath = safeResolve(path.posix.join("storage", object.localPath));
    const fileStat = await stat(localPath);
    if (!fileStat.isFile()) {
      throw new Error(`Storage-Datei fehlt: ${bucket.name}/${object.name}`);
    }
    if (Number.isFinite(object.localSize) && fileStat.size !== object.localSize) {
      throw new Error(`Storage-Dateigröße stimmt nicht: ${bucket.name}/${object.name}`);
    }
    if (typeof object.sha256 === "string" && object.sha256.length === 64) {
      const actualHash = await hashFile(localPath);
      if (actualHash !== object.sha256.toLowerCase()) {
        throw new Error(`Storage-Prüfsumme stimmt nicht: ${bucket.name}/${object.name}`);
      }
    }
    storageFileCount += 1;
    storageBytes += fileStat.size;
  }
}

const summary = {
  verifiedAt: new Date().toISOString(),
  sourceRoot,
  archiveFiles: archiveFiles.length,
  migrations: migrationCount,
  storageBuckets: manifest.buckets.length,
  storageFiles: storageFileCount,
  storageBytes,
};

console.log("Backup erfolgreich geprüft:");
console.log(JSON.stringify(summary, null, 2));
