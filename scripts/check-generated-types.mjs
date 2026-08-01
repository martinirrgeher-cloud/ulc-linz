import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const migrationDirectory = path.resolve("supabase/migrations");
const generatedTypesFile = path.resolve("src/types/database.generated.ts");

function uniqueMatches(source, pattern) {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

function hasGeneratedEntry(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s{6}${escapedName}:\\s*\\{`, "m").test(source);
}

async function main() {
  const migrationFiles = (await readdir(migrationDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const migrationSource = (
    await Promise.all(
      migrationFiles.map((file) => readFile(path.join(migrationDirectory, file), "utf8")),
    )
  ).join("\n");
  const generatedTypesSource = await readFile(generatedTypesFile, "utf8");

  const publicTables = uniqueMatches(
    migrationSource,
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi,
  );
  const publicFunctions = uniqueMatches(
    migrationSource,
    /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)/gi,
  );

  const missingTables = publicTables.filter((name) => !hasGeneratedEntry(generatedTypesSource, name));
  const missingFunctions = publicFunctions.filter((name) => !hasGeneratedEntry(generatedTypesSource, name));

  if (missingTables.length > 0 || missingFunctions.length > 0) {
    if (missingTables.length > 0) {
      console.error(`Fehlende Tabellen in database.generated.ts: ${missingTables.join(", ")}`);
    }
    if (missingFunctions.length > 0) {
      console.error(`Fehlende Funktionen in database.generated.ts: ${missingFunctions.join(", ")}`);
    }
    console.error("Supabase-Typen neu erzeugen: npm run supabase:types:local");
    process.exitCode = 1;
    return;
  }

  console.log(
    `Datenbanktypen konsistent: ${publicTables.length} Tabellen und ${publicFunctions.length} Funktionen geprüft.`,
  );
}

main().catch((error) => {
  console.error("Datenbanktypen konnten nicht geprüft werden.", error);
  process.exitCode = 1;
});
