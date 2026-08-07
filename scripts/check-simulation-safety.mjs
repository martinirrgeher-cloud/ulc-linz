import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path) {
  return readFileSync(resolve(path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const supabaseSource = source("src/lib/supabase.ts");
const authSource = source("src/features/auth/AuthContext.tsx");
const editLockSource = source("src/features/collaboration/useEditLock.ts");
const exerciseUploadSource = source("src/features/exercise-catalog/video-upload.ts");
const documentationUploadSource = source("src/features/training-documentation/media-upload.ts");
const diagnosticsSource = source("src/lib/diagnostics.ts");

assert(supabaseSource.includes("READ_ONLY_RPC_NAMES"), "Simulation: RPC-Allowlist fehlt.");
assert(supabaseSource.includes("WRITE_BUILDER_METHODS"), "Simulation: Tabellen-Schreibschutz fehlt.");
assert(supabaseSource.includes("WRITE_STORAGE_METHODS"), "Simulation: Storage-Schreibschutz fehlt.");
assert(supabaseSource.includes("WRITE_AUTH_METHODS"), "Simulation: Auth-Schreibschutz fehlt.");
assert(supabaseSource.includes("assertSimulationWriteAllowed"), "Simulation: zentraler Schreibschutz wird nicht verwendet.");
assert(supabaseSource.includes("!READ_ONLY_RPC_NAMES.has(functionName)"), "Simulation: unbekannte RPCs müssen standardmäßig blockiert werden.");
assert(!/READ_ONLY_RPC_NAMES[\s\S]*?"activate_current_memberships"/.test(supabaseSource), "Simulation: activate_current_memberships darf wegen möglicher Seiteneffekte nicht als Read-only gelten.");
assert(authSource.includes("if (simulationRef.current) return;"), "Simulation: Hintergrund-Aktualisierungen des echten Admin-Kontexts müssen während der Simulation pausieren.");
assert(authSource.includes("setSimulationWriteGuard(true"), "Simulation: AuthContext aktiviert den globalen Schreibschutz nicht.");
assert(authSource.includes("setSimulationWriteGuard(false"), "Simulation: AuthContext deaktiviert den globalen Schreibschutz nicht.");
assert(editLockSource.includes("isSimulationActive"), "Simulation: Bearbeitungssperren werden nicht simulationsbewusst behandelt.");
assert(editLockSource.includes("simulation-no-write"), "Simulation: virtueller Edit-Lock fehlt.");
assert(exerciseUploadSource.includes('assertSimulationWriteAllowed("Der Medienupload")'), "Simulation: Übungsvideo-Upload ist nicht geschützt.");
assert(documentationUploadSource.includes('assertSimulationWriteAllowed("Der Medienupload")'), "Simulation: Dokumentationsupload ist nicht geschützt.");
assert(diagnosticsSource.includes("isSimulationWriteBlockedError"), "Simulation: blockierte Schreibversuche dürfen nicht als technische Fehler protokolliert werden.");

for (const [file, content] of [
  ["src/features/exercise-catalog/video-upload.ts", exerciseUploadSource],
  ["src/features/training-documentation/media-upload.ts", documentationUploadSource],
]) {
  const firstFetch = content.indexOf("fetch(");
  const guard = content.indexOf("assertSimulationWriteAllowed");
  assert(firstFetch < 0 || (guard >= 0 && guard < firstFetch), `Simulation: Direkter Fetch in ${file} ist nicht vor dem ersten Request geschützt.`);
}

console.log("Simulations-Sicherheitsprüfung erfolgreich.");
