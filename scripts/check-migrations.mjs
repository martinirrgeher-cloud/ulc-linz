import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const migrationDirectory = path.resolve("supabase/migrations");
const filePattern = /^(\d{12})_[a-z0-9_]+\.sql$/;

function fail(messages) {
  for (const message of messages) {
    console.error(`Migrationsprüfung: ${message}`);
  }
  process.exitCode = 1;
}

function uniqueMatches(source, pattern) {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

function functionDefinitions(source) {
  const marker = /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)/gi;
  const matches = [...source.matchAll(marker)];
  return matches.map((match, index) => ({
    name: match[1],
    source: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
}

async function main() {
  const entries = await readdir(migrationDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const errors = [];
  const timestamps = new Map();
  const sources = [];

  if (files.length === 0) {
    errors.push("Es wurden keine SQL-Migrationen gefunden.");
  }

  for (const file of files) {
    const match = file.match(filePattern);
    if (!match) {
      errors.push(`${file}: Dateiname muss dem Muster YYYYMMDDNNNN_beschreibung.sql entsprechen.`);
      continue;
    }

    const timestamp = match[1];
    const duplicate = timestamps.get(timestamp);
    if (duplicate) {
      errors.push(`${file}: Zeitstempel ${timestamp} wird bereits von ${duplicate} verwendet.`);
    } else {
      timestamps.set(timestamp, file);
    }

    const content = await readFile(path.join(migrationDirectory, file), "utf8");
    sources.push(`\n-- FILE: ${file}\n${content}`);

    if (content.trim().length === 0) {
      errors.push(`${file}: Datei ist leer.`);
    }
    if (content.charCodeAt(0) === 0xfeff) {
      errors.push(`${file}: UTF-8-BOM entfernen.`);
    }
    if (/^(<{7}|={7}|>{7})/m.test(content)) {
      errors.push(`${file}: nicht aufgelöste Git-Konfliktmarkierung gefunden.`);
    }
  }

  const completeSource = sources.join("\n");
  const publicTables = uniqueMatches(
    completeSource,
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi,
  );
  const rlsTables = new Set(
    uniqueMatches(
      completeSource,
      /alter\s+table\s+public\.([a-z0-9_]+)\s+enable\s+row\s+level\s+security/gi,
    ),
  );

  for (const table of publicTables) {
    if (!rlsTables.has(table)) {
      errors.push(`public.${table}: Row Level Security wird in keiner Migration aktiviert.`);
    }
  }

  for (const definition of functionDefinitions(completeSource)) {
    const declaration = definition.source.split(/\bas\s+\$\$/i, 1)[0];
    if (/\bsecurity\s+definer\b/i.test(declaration) && !/\bset\s+search_path\s*=\s*''/i.test(declaration)) {
      errors.push(`public.${definition.name}: SECURITY DEFINER ohne festen leeren search_path.`);
    }
  }

  if (errors.length > 0) {
    fail(errors);
    return;
  }

  console.log(
    `Migrationsprüfung erfolgreich: ${files.length} Dateien, ${publicTables.length} RLS-Tabellen und sichere SECURITY-DEFINER-Funktionen geprüft.`,
  );
}

main().catch((error) => {
  console.error("Migrationsprüfung konnte nicht ausgeführt werden.", error);
  process.exitCode = 1;
});
