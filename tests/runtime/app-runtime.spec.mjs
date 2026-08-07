import { expect, test } from "@playwright/test";
import {
  installAuthenticatedSession,
  installSupabaseMock,
} from "../e2e/helpers/supabase-mock.mjs";

function collectRuntimeProblems(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console.error: ${message.text()}`);
  });
  return problems;
}

async function expectRuntimeHealthy(page, problems, unhandled) {
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByRole("heading", { name: "Diese Ansicht konnte nicht geladen werden." })).toHaveCount(0);
  await expect(page.locator(".app-error-boundary")).toHaveCount(0);
  await expect(page.locator(".loading-screen")).toHaveCount(0);
  expect(unhandled).toEqual([]);
  expect(problems).toEqual([]);
}

async function expectAuthenticatedHeading(page, route, heading) {
  await page.goto(route);
  const pathname = new URL(page.url()).pathname;
  if (pathname === "/login") {
    throw new Error(
      `Runtime-Test wurde unerwartet zum Login umgeleitet. ` +
      `Der isolierte E2E-Build oder die Test-Sitzung ist nicht aktiv (Zielroute: ${route}).`,
    );
  }
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
}


async function downloadBytes(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function storedZipEntries(buffer) {
  const result = new Map();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    if (method !== 0) throw new Error(`Runtime-XLSX-Test erwartet unkomprimierte ZIP-Einträge, gefunden: ${method}`);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
    result.set(name, buffer.subarray(dataStart, dataEnd));
    offset = dataEnd;
  }
  return result;
}

function spreadsheetXmlExerciseRows(rows) {
  const esc = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const headers = [
    "Bezeichnung", "Kategorie", "Unterkategorie", "Schwierigkeitsgrad", "Material 1", "Trainingsgruppe 1",
    "Planungsparameter 1", "Planungsparameter 1 Standardwert", "Planungsparameter 1 Minimum", "Planungsparameter 1 Maximum",
  ];
  const rowXml = [headers, ...rows].map((row) => (
    `<Row>${row.map((value) => `<Cell><Data ss:Type="String">${esc(value)}</Data></Cell>`).join("")}</Row>`
  )).join("");
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Übungen"><Table>${rowXml}</Table></Worksheet></Workbook>`;
}

test("oeffentliche Login-Seite rendert ohne React-Laufzeitfehler", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  const unhandled = await installSupabaseMock(page);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Anmelden", exact: true })).toBeVisible();
  await expectRuntimeHealthy(page, problems, unhandled);
});

test("authentifiziertes App-Layout rendert ohne React-Laufzeitfehler", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/", "Willkommen, E2E Administrator");
  await expect(page.getByRole("heading", { name: "Was noch zu tun ist", exact: true })).toBeVisible();
  await expect(page.getByText("Benutzereinladungen offen", { exact: true })).toBeVisible();
  await expectRuntimeHealthy(page, problems, unhandled);
});

test("zentrales Stammdatenmodul rendert ohne React-Laufzeitfehler", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/module/athletes", "Athleten, Trainer & Gruppen");
  await expectRuntimeHealthy(page, problems, unhandled);
});


test("Übungsvorlage enthält Beispielzeile und befüllte Excel-Dropdownquellen", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/module/data_import", "Datenimport/-export");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Vorlage mit Beispiel", exact: true }).click();
  const download = await downloadPromise;
  const entries = storedZipEntries(await downloadBytes(download));
  const exerciseXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8") ?? "";
  const listXml = entries.get("xl/worksheets/sheet2.xml")?.toString("utf8") ?? "";
  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8") ?? "";

  expect(exerciseXml).toContain("BEISPIEL – bitte überschreiben");
  const rowCellCounts = [...exerciseXml.matchAll(/<row r="(1|2)">([\s\S]*?)<\/row>/g)]
    .map((match) => ({ row: match[1], count: (match[2].match(/<c r=/g) ?? []).length }));
  const headerCellCount = rowCellCounts.find((item) => item.row === "1")?.count ?? 0;
  const exampleCellCount = rowCellCounts.find((item) => item.row === "2")?.count ?? 0;
  expect(headerCellCount).toBeGreaterThan(0);
  expect(exampleCellCount).toBe(headerCellCount);
  expect(exerciseXml).toContain("Planungsparameter 1");
  expect(exerciseXml).toContain("Planungsparameter 1 Standardwert");
  expect(exerciseXml).toContain("Planungsparameter 1 Minimum");
  expect(exerciseXml).toContain("Planungsparameter 1 Maximum");
  expect(exerciseXml).not.toContain("Übungs-ID");
  expect(exerciseXml).not.toContain("Parameter 1 Schlüssel");
  expect(exerciseXml).toContain("INDIRECT(&quot;Auswahllisten!");
  expect(workbookXml).toContain('name="Auswahllisten"');
  expect(workbookXml).toContain('state="hidden"');
  for (const value of ["Sprint", "Beschleunigung", "Mittel", "Markierungshütchen", "Leistungsgruppe Sprint und Mehrkampf", "Distanz"]) {
    expect(listXml).toContain(value);
  }
  await expectRuntimeHealthy(page, problems, unhandled);
});

test("Übungsimport verlangt eine ausdrückliche Freigabe je Zeile", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/module/data_import", "Datenimport/-export");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "uebungen-test.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(spreadsheetXmlExerciseRows([
      ["Import Sprint A", "Sprint", "Beschleunigung", "Mittel", "Markierungshütchen", "Leistungsgruppe Sprint und Mehrkampf", "Distanz", "30", "10", "80"],
      ["Import Sprint B", "Sprint", "Beschleunigung", "Mittel", "Markierungshütchen", "Leistungsgruppe Sprint und Mehrkampf", "Wiederholungen", "6", "1", "20"],
    ]), "utf8"),
  });

  const editor = page.getByRole("dialog");
  await expect(editor.getByRole("heading", { name: "Übung 1 von 2: Import Sprint A", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: /Basis/ })).toBeVisible();
  await expect(editor.getByRole("button", { name: /Anleitung/ })).toBeVisible();
  await expect(editor.getByRole("button", { name: /Ähnlich/ })).toBeVisible();
  await expect(editor.getByRole("button", { name: /Parameter/ })).toBeVisible();
  await expect(editor.getByRole("button", { name: /Videos/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /freigegebene Übungen übernehmen/ })).toBeDisabled();

  await editor.getByRole("button", { name: /Parameter/ }).click();
  await expect(editor.getByText("Distanz", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("Standardwert", { exact: true })).toHaveValue("30");
  await expect(editor.getByLabel("Minimum", { exact: true })).toHaveValue("10");
  await expect(editor.getByLabel("Maximum", { exact: true })).toHaveValue("80");
  await editor.getByRole("button", { name: "Freigeben & nächste", exact: true }).click();

  await expect(page.getByRole("dialog").getByRole("heading", { name: "Übung 2 von 2: Import Sprint B", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Überspringen & nächste", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1 ausdrücklich freigegebene Übungen sind bereit.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "1 freigegebene Übungen übernehmen", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "Freigegebene Übungen erneut prüfen", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Parameter/ }).click();
  await expect(page.getByRole("dialog").getByLabel("Standardwert", { exact: true })).toHaveValue("30");
  await expect(page.getByRole("dialog").getByLabel("Minimum", { exact: true })).toHaveValue("10");
  await expect(page.getByRole("dialog").getByLabel("Maximum", { exact: true })).toHaveValue("80");
  await page.getByRole("dialog").getByRole("button", { name: "Prüfung schließen", exact: true }).click();
  await expectRuntimeHealthy(page, problems, unhandled);
});

test("untere Hauptnavigation und Untermenues funktionieren ohne Laufzeitfehler", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toBeVisible();

  await page.getByRole("button", { name: "Anmeldung", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Anmeldung Untermenü" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kindertraining", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Weitere Bereiche", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Weitere Bereiche" })).toBeVisible();
  await page.getByRole("menuitem", { name: /Stammdaten/ }).click();
  await expect(page.getByRole("navigation", { name: "Stammdaten Untermenü" })).toBeVisible();
  await page.getByRole("button", { name: "Benutzer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Benutzerverwaltung", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Stammdaten Untermenü" })).toHaveCount(0);

  await expectRuntimeHealthy(page, problems, unhandled);
});

test("untere Navigation verdeckt den letzten Seiteninhalt nicht", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);
  await expectAuthenticatedHeading(page, "/module/user_management", "Benutzerverwaltung");
  await expect(page.locator(".member-card").last()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const contentBox = await page.locator(".user-management-page").boundingBox();
  const navigationBox = await page.getByRole("navigation", { name: "Hauptnavigation" }).boundingBox();
  expect(contentBox).not.toBeNull(); expect(navigationBox).not.toBeNull();
  expect(contentBox.y + contentBox.height).toBeLessThan(navigationBox.y);
  await expectRuntimeHealthy(page, problems, unhandled);
});

test("Benutzeransicht simuliert Rechte und bleibt sichtbar als schreibgeschuetzter Modus", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/module/user_management", "Benutzerverwaltung");
  const trainerCard = page.locator(".member-card").filter({ hasText: "E2E Trainer" });
  await trainerCard.getByRole("button", { name: "Ansicht simulieren", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Willkommen, E2E Trainer", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Benutzeransicht Simulation" })).toContainText("Änderungen werden nicht gespeichert");
  await expect(page.getByRole("button", { name: "Anmeldung", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Planung", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Simulation beenden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Willkommen, E2E Administrator", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Benutzeransicht Simulation" })).toHaveCount(0);

  await expectRuntimeHealthy(page, problems, unhandled);
});

test("Simulationsmodus blockiert schreibende Serveraktionen vor dem Netzwerk", async ({ page }) => {
  const problems = collectRuntimeProblems(page);
  await installAuthenticatedSession(page);
  const unhandled = await installSupabaseMock(page);

  await expectAuthenticatedHeading(page, "/module/user_management", "Benutzerverwaltung");
  const adminCard = page.locator(".member-card").filter({ hasText: "E2E Zweitadmin" });
  await adminCard.getByRole("button", { name: "Ansicht simulieren", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Willkommen, E2E Zweitadmin", exact: true })).toBeVisible();

  await expect(page.getByRole("status", { name: "Benutzeransicht Simulation" })).toContainText("Änderungen werden nicht gespeichert");

  // Die Simulation lebt absichtlich nur im laufenden App-Kontext. Deshalb navigieren wir
  // wie ein echter Benutzer per SPA-Navigation zurück zur Benutzerverwaltung und lösen
  // keinen vollständigen Seiten-Reload mit page.goto() aus.
  await page.getByRole("button", { name: "Weitere Bereiche", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Weitere Bereiche" })).toBeVisible();
  await page.getByRole("menuitem", { name: /Stammdaten/ }).click();
  await expect(page.getByRole("navigation", { name: "Stammdaten Untermenü" })).toBeVisible();
  await page.getByRole("button", { name: "Benutzer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Benutzerverwaltung", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Benutzeransicht Simulation" })).toContainText("Änderungen werden nicht gespeichert");

  const invitationCard = page.locator(".member-card").filter({ hasText: "Offene Einladung" });
  await invitationCard.getByRole("button", { name: "Erneut senden", exact: true }).click();
  await expect(page.locator(".alert.error")).toContainText("Simulation aktiv");
  await expect(page.locator(".alert.error")).toContainText("nicht gespeichert");

  await expectRuntimeHealthy(page, problems, unhandled);
});
