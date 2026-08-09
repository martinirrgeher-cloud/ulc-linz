import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const globalCss = await readFile("src/styles/global.css", "utf8");
const masterdataCss = await readFile("src/styles/masterdata-foundation.css", "utf8");
const userCss = await readFile("src/styles/user-management-foundation.css", "utf8");
const dashboardCss = await readFile("src/styles/dashboard.css", "utf8");
const athletePage = await readFile("src/pages/AthleteManagementPage.tsx", "utf8");
const userPage = await readFile("src/pages/UserManagementPage.tsx", "utf8");
const mainSource = await readFile("src/main.tsx", "utf8");

const normalizedBytes = (source) => Buffer.byteLength(source.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");

assert.ok(
  normalizedBytes(globalCss) <= 24_000,
  `global.css waechst wieder ueber das S3b-Budget: ${normalizedBytes(globalCss)} > 24000 Bytes.`,
);

for (const [label, pattern] of [
  ["Benutzerkarten", /\.member-(?:card|primary|avatar|name|badges|details|edit-button)\b/],
  ["Benutzerrechte", /\.(?:permission-(?:editor|groups?|group-copy|group-meta|table|row|header|module|note)|check-cell|status-filter|user-management-page)\b/],
  ["Athletenkarten", /\.athlete-(?:management-page|toolbar|list|card|identity|avatar|groups|notes|card-actions|card-top-actions|status-dot|edit-button|editor-lock-fieldset)\b/],
  ["Trainerkarten", /\.trainer-(?:grid|card|card-heading|avatar|contact-lines|notes|edit-button|group-field|group-options|group-chips)\b/],
  ["Trainingsgruppen-Stammdaten", /\.(?:training-group-(?:grid|card|card-heading|description|details|card-top-actions)|group-schedule-fieldset|weekday-selector|group-module-settings|masterdata-[\w-]+)\b/],
]) {
  assert.doesNotMatch(globalCss, pattern, `${label} duerfen nicht wieder in global.css landen.`);
}

for (const pattern of [
  /\.module-sections?\b/,
  /\.module-grid\b/,
  /\.module-card\b/,
  /\.module-icon\b/,
  /\.module-copy\b/,
  /\.module-arrow\b/,
]) {
  assert.doesNotMatch(globalCss, pattern, `Totes altes Modul-Dashboard-CSS darf nicht nach global.css zurueckkehren: ${pattern}`);
}

for (const marker of [
  ".athlete-card",
  ".trainer-card",
  ".training-group-card",
  ".masterdata-create-actions",
  ".weekday-selector",
  ".athlete-editor-lock-fieldset",
]) {
  assert.ok(masterdataCss.includes(marker), `Stammdaten-Foundation verliert ${marker}.`);
}
for (const marker of [
  ".member-card",
  ".permission-editor",
  ".permission-row",
  ".status-filter",
]) {
  assert.ok(userCss.includes(marker), `Benutzer-Foundation verliert ${marker}.`);
}
assert.ok(dashboardCss.includes(".dashboard-page .dashboard-heading"), "Dashboard-spezifischer Heading-Abstand muss routebezogen bleiben.");

const orderedImports = (source, names) => {
  const positions = names.map((name) => source.indexOf(`import \"@/styles/${name}\";`));
  assert.ok(positions.every((position) => position >= 0), `CSS-Import fehlt: ${names.join(", ")}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `CSS-Importreihenfolge ist falsch: ${names.join(" -> ")}`);
};

orderedImports(athletePage, ["masterdata-foundation.css", "management.css"]);
orderedImports(userPage, ["user-management-foundation.css", "management.css", "user-management-e5c.css"]);
for (const routeOnly of ["masterdata-foundation.css", "user-management-foundation.css"]) {
  assert.equal(mainSource.includes(routeOnly), false, `${routeOnly} darf nicht global aus main.tsx geladen werden.`);
}

console.log(`CSS-Ownership erfolgreich: global.css ${normalizedBytes(globalCss)} Bytes; Stammdaten und Benutzerverwaltung sind routebezogen.`);
