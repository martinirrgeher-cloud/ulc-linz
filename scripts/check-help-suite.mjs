import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const helpContent = JSON.parse(await readFile(new URL("../src/features/help/help-content.json", import.meta.url), "utf8"));
const routeContexts = JSON.parse(await readFile(new URL("../src/features/help/help-route-contexts.json", import.meta.url), "utf8"));
const appSource = await readFile(new URL("../src/app/App.tsx", import.meta.url), "utf8");
const layoutSource = await readFile(new URL("../src/components/layout/AppLayout.tsx", import.meta.url), "utf8");
const helpContextSource = await readFile(new URL("../src/features/help/help-context.ts", import.meta.url), "utf8");
const publicHelpSource = await readFile(new URL("../src/features/help/PublicHelpButton.tsx", import.meta.url), "utf8");
const helpPageSource = await readFile(new URL("../src/pages/HelpPage.tsx", import.meta.url), "utf8");
const modulesSource = await readFile(new URL("../src/config/modules.tsx", import.meta.url), "utf8");
const maintenanceSource = await readFile(new URL("../P2B-PWA-HILFESYSTEM.md", import.meta.url), "utf8");

assert.ok(Array.isArray(helpContent.chapters), "Hilfekapitel fehlen.");
assert.ok(Array.isArray(helpContent.topics), "Hilfethemen fehlen.");
assert.ok(Array.isArray(routeContexts), "Kontextzuordnungen fehlen.");
assert.ok(helpContent.topics.length >= 20, "Das Handbuch enthält unerwartet wenige Hilfethemen.");

const topicIds = helpContent.topics.map((topic) => topic.id);
assert.equal(new Set(topicIds).size, topicIds.length, "Hilfethemen enthalten doppelte IDs.");
const topicIdSet = new Set(topicIds);
let sectionCount = 0;

for (const topic of helpContent.topics) {
  assert.equal(typeof topic.title, "string", `Titel fehlt bei ${topic.id}.`);
  assert.equal(typeof topic.summary, "string", `Zusammenfassung fehlt bei ${topic.id}.`);
  assert.ok(Array.isArray(topic.keywords) && topic.keywords.length > 0, `Suchbegriffe fehlen bei ${topic.id}.`);
  assert.ok(Array.isArray(topic.sections) && topic.sections.length > 0, `Abschnitte fehlen bei ${topic.id}.`);
  const sectionIds = topic.sections.map((section) => section.id);
  assert.equal(new Set(sectionIds).size, sectionIds.length, `Doppelte Abschnitts-ID bei ${topic.id}.`);
  sectionCount += sectionIds.length;
}
assert.ok(sectionCount >= 70, "Das Handbuch enthält unerwartet wenige Unterkapitel.");

const chapterTopicIds = new Set();
for (const chapter of helpContent.chapters) {
  assert.ok(Array.isArray(chapter.topicIds) && chapter.topicIds.length > 0, `Kapitel ${chapter.id} ist leer.`);
  for (const topicId of chapter.topicIds) {
    assert.ok(topicIdSet.has(topicId), `Kapitel ${chapter.id} verweist auf unbekanntes Thema ${topicId}.`);
    assert.ok(!chapterTopicIds.has(topicId), `Hilfethema ${topicId} ist mehreren Kapiteln zugeordnet.`);
    chapterTopicIds.add(topicId);
  }
}
assert.equal(chapterTopicIds.size, topicIds.length, "Nicht alle Hilfethemen sind einem Kapitel zugeordnet.");

const routePaths = new Set();
for (const context of routeContexts) {
  assert.equal(typeof context.path, "string", "Hilfekontext ohne Pfad.");
  assert.ok(!routePaths.has(context.path), `Doppelte Hilfekontext-Route: ${context.path}`);
  routePaths.add(context.path);
  const topic = helpContent.topics.find((item) => item.id === context.topicId);
  assert.ok(topic, `Hilfekontext ${context.path} verweist auf unbekanntes Thema ${context.topicId}.`);
  if (context.sectionId) {
    assert.ok(topic.sections.some((section) => section.id === context.sectionId), `Unbekannter Abschnitt ${context.sectionId} für ${context.path}.`);
  }
}

const staticRoutePaths = [...appSource.matchAll(/path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((route) => route !== "*" && !route.includes(":"))
  .map((route) => route.startsWith("/") ? route : `/${route}`)
  .filter((route) => !route.startsWith("/hilfe"));
staticRoutePaths.push("/");

for (const route of new Set(staticRoutePaths)) {
  assert.ok(routePaths.has(route), `Für die App-Route ${route} fehlt eine konkrete Hilfekontext-Zuordnung.`);
}

const moduleRoutes = [...modulesSource.matchAll(/route:\s*"([^"]+)"/g)].map((match) => match[1]);
for (const route of moduleRoutes) {
  assert.ok(routePaths.has(route), `Für das Modul ${route} fehlt eine Hilfekontext-Zuordnung.`);
}

for (const marker of [
  'path="/hilfe"',
  'path="/hilfe/:topicId"',
  "PublicHelpButton",
]) {
  assert.ok(appSource.includes(marker), `Hilferoute oder öffentlicher Hilfezugang fehlt: ${marker}`);
}
for (const marker of [
  "Hilfe für diese Seite",
  "Hilfe & Handbuch",
  "buildHelpHref",
  "@/features/help/help-context",
]) {
  assert.ok(layoutSource.includes(marker), `Kontextbezogene Hilfe in der App-Kopfzeile fehlt: ${marker}`);
}
assert.ok(publicHelpSource.includes("@/features/help/help-context"), "Öffentliche Hilfe muss die schlanke Kontextlogik verwenden.");
assert.doesNotMatch(layoutSource, /@\/features\/help\/help["']/, "Die App-Kopfzeile darf nicht das vollständige Handbuch in den Start-Chunk laden.");
assert.doesNotMatch(publicHelpSource, /@\/features\/help\/help["']/, "Der öffentliche Hilfezugang darf nicht das vollständige Handbuch in den Start-Chunk laden.");
for (const marker of ["help-route-contexts.json", "buildHelpTopicHref", "safeHelpReturnPath"]) {
  assert.ok(helpContextSource.includes(marker), `Schlanke Hilfekontextlogik fehlt: ${marker}`);
}
for (const marker of [
  "Hilfe durchsuchen",
  "HELP_CHAPTERS",
  "HELP_TOPICS",
  "buildHelpTopicHref",
]) {
  assert.ok(helpPageSource.includes(marker), `Handbuchfunktion fehlt: ${marker}`);
}
for (const marker of [
  "Pflicht bei jedem Patch",
  "Hilfekontext",
  "npm run check:help-suite",
]) {
  assert.ok(maintenanceSource.includes(marker), `Wartungsregel für das Hilfesystem fehlt: ${marker}`);
}

console.log(`Hilfesystem gültig: ${helpContent.chapters.length} Kapitel, ${topicIds.length} Themen, ${sectionCount} Unterkapitel, ${routePaths.size} Kontextzuordnungen.`);
