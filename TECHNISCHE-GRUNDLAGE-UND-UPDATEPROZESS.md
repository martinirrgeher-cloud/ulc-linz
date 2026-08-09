# ULC Linz App – Technische Grundlage und Updateprozess

**Kanonische technische Gesamtübersicht für Entwicklung, Tests und Releases**

Dokumentationsbasis: 2026-08-09  
Referenz-Commit: `9c17b40b40e098ece970021cd97b6cbfc2ce89af`  
Git-Tree: `5debff3322e4c1ab1388f9aa99116b77f1444d26`  
App-Version: `0.4.0`

> Dieses Dokument beschreibt die verbindliche technische Grundlage der ULC-Linz-App nach Abschluss der Konsolidierungsphasen S1–S3. Bei Widersprüchen zwischen älteren Projekt-Notizen und diesem Dokument gilt für den technischen Entwicklungs- und Releaseprozess dieses Dokument zusammen mit dem tatsächlich eingecheckten Code. Der aktuelle Git-Stand bleibt immer die technische Source of Truth.

---

## 1. Ziel und Grundprinzipien

Die ULC-Linz-App wird mobile-first entwickelt und produktiv über GitHub, Supabase und Vercel betrieben. Änderungen sollen klein, reproduzierbar und sicher auslieferbar sein.

Verbindliche Grundprinzipien:

1. **Git ist die Source of Truth.** Ein Entwicklungszyklus beginnt nur von einem bestätigten Produktionscommit auf `main`.
2. **Für ChatGPT-Arbeit ist die automatisch erzeugte Git-Projekt-ZIP die einzige Codebasis.** Es darf nicht aus früheren Chats geraten oder eine ältere Projektkopie fortgeschrieben werden.
3. **Updates sind vollständige Datei-Overlays, keine Textpatches.**
4. **Manifest, Basiscommit und SHA-256 werden vor dem Schreiben geprüft.**
5. **Installation und Prüfung sind transaktional.** Ein Fehler führt zum gezielten Rollback der Paketdateien.
6. **Der Installer committet, pusht und merged niemals.**
7. **Commit/Push erfolgen erst nach einer vollständigen, nachweisbaren Releaseprüfung.**
8. **GitHub-Checks sind ein unabhängiges zweites Gate.**
9. **Produktion wird erst nach geprüftem Vercel-Deployment mit einem `production-*`-Tag bestätigt.**
10. **Kindertraining, U12 und U14 dürfen sich fachlich unabhängig entwickeln.** Gemeinsame Technik ist kein Zwang zu gemeinsamer Fachlogik.
11. **Keine technischen Grenzwerte reflexartig erhöhen.** Wenn ein Gate erreicht wird, zuerst Ursache und Architektur verbessern.
12. **Der normale lokale Workflow benötigt kein Docker.** Docker/Supabase lokal wird nur für gezielte Datenbank- oder Writing-E2E-Arbeit benötigt; die normalen Releaseprüfungen und der Benutzerworkflow dürfen nicht davon abhängig gemacht werden.

---

## 2. Technischer Stack

### Frontend

- React `19.2.x`
- React DOM `19.2.x`
- React Router DOM `7.18.x`
- TypeScript `7.0.x`
- Vite `8.1.x`
- Lucide React für Icons
- CSS als globale Basis plus route-/featurebezogene Stylesheets
- PWA mit `manifest.webmanifest` und Service Worker

### Backend und Daten

- Supabase
- PostgreSQL 17 in der lokalen Supabase-Konfiguration
- Supabase Auth
- Supabase Realtime
- Supabase Storage
- RPC-/Datenbankfunktionen als wesentlicher Schreib- und Lesepfad
- eine Edge Function `invite-member`
- generierte TypeScript-Datenbanktypen unter `src/types`

Referenzstand S3d:

- 39 Migrationen
- 47 RLS-geschützte Tabellen
- 158 in den generierten Datenbanktypen erfasste Funktionen

### Hosting und Repository

- GitHub Repository
- GitHub Actions als CI
- Vercel als Frontend-Hosting und Produktionsdeployment
- lokaler Projektpfad unter Windows: `C:\ULC Linz App`

### Laufzeit-/Tooling-Vorgaben

Die reproduzierbare Projekt-Toolchain ist exakt gepinnt:

- Node.js `22.20.0` (`.nvmrc`, `.node-version`, `package.json`)
- npm `10.9.3` (`packageManager`, `package.json`, `package-lock.json`)

GitHub Actions verwendet `.nvmrc`; die Git-Projekt-ZIP dokumentiert die tatsächlich verwendeten Versionen zusätzlich in `ULC-SOURCE-METADATA.json`. `scripts/check-release-infrastructure.mjs` verhindert ein unbemerktes Auseinanderlaufen dieser Pins.

Playwright ist **fest im Projekt** gepinnt:

- `@playwright/test` `1.62.1`

Es darf keine zweite dynamische Playwright-Testversion neben dem Lockfile installiert werden.

---

## 3. Repository- und Frontend-Struktur

Wichtige Bereiche:

```text
src/
  app/                         Routing / App-Einstieg
  components/                  globale wiederverwendbare UI
  features/                    fachliche und technische Feature-Module
  lib/                         gemeinsame technische Basis
  pages/                       lazy geladene Routeneinstiege
  styles/                      globale und routebezogene CSS-Dateien
  types/                       generierte DB-Typen und gemeinsame Typen

supabase/
  migrations/                  vollständige DB-Migrationshistorie
  functions/                   Edge Functions
  config.toml                  lokale Supabase-Konfiguration

scripts/
  release/                     Release-, Overlay- und Produktionslogik
  ci/                          CI-Hilfsskripte
  check-*.mjs                  harte Architektur-/Qualitätsgates
  smoke-test.mjs               schnelle App-/Fachstruktur-Invarianten

tests/
  e2e/                         read-only Browser-E2E
  e2e-writing/                 schreibende E2E mit isoliertem Supabase
  helpers/                     gemeinsame stabile Browser-Interaktionen

.github/workflows/             GitHub Actions
```

`src/app/App.tsx` verwendet route-basiertes Lazy Loading. Geschützte Bereiche laufen über `ProtectedRoute`, modulbezogene Rechte werden dort über den jeweiligen `moduleKey` erzwungen.

---

## 4. Frontend-Architektur nach S3

### 4.1 Gemeinsame UI-Basis

Wiederverwendbare, fachlich neutrale UI-Komponenten gehören nicht in ein einzelnes Fachfeature. Beispiel:

```text
src/components/ui/StickyEditorActions
```

`scripts/check-ui-foundation.mjs` schützt diese Zuordnung.

### 4.2 Gemeinsame JSON-/RPC-Basis

Grundlegende Parser und Supabase-RPC-Helfer werden zentral gepflegt:

```text
src/lib/json-value.ts
src/lib/supabase-rpc.ts
```

Zentrale Funktionen umfassen insbesondere:

- `isRecord`
- `numberOrNull`
- `parseStringArray`
- `callJsonRpc`
- `callJsonRpcRawError`

Das bestehende Fehlerverhalten eines Features darf beim Umstieg auf gemeinsame Technik nicht still verändert werden.

`scripts/check-api-foundation.mjs` verhindert lokale Kopien dieser Basis und schützt die API-Skalierungsregeln.

Referenzstand:

- 14 Nutzer der gemeinsamen JSON-Basis
- 13 Nutzer der gemeinsamen RPC-Basis

---

## 5. Kindertraining, U12 und U14: gemeinsame Technik, getrennte Fachgrenzen

Dies ist eine besonders wichtige Architekturregel.

**Nicht zulässig:** eine gemeinsame monolithische Trainingsseite, in die alle fachlichen Unterschiede über wachsende `if (module === ...)`-Kaskaden eingebaut werden.

**Zulässig und gewünscht:** gemeinsame neutrale Technik für das, was heute tatsächlich identisch ist, mit klaren Escape-Hatches pro Modul.

### Gemeinsamer technischer Kern

Unter `src/features/training-session/` liegen fachlich neutrale Bausteine wie:

- gemeinsame Datentypen
- Datums-/Sortier-/Draft-Helfer
- API-Parser
- Statistik-Parser
- neutrale Präsentationskomponenten

Die Shared-Komponenten kennen:

- keine konkrete Kennung `kindertraining`, `u12` oder `u14`
- keinen direkten Supabase-Zugriff
- keine Rechteprüfung
- keine konkrete Route
- keine fachliche Verpflichtung, dass alle drei Module dieselbe Darstellung behalten müssen

### Modulgrenzen

Kindertraining behält:

- eigene Orchestrierungsseite
- eigene API-Adapter
- eigene Statistik-Adapter
- eigene fachliche Erweiterungspunkte

U12 und U14 besitzen:

- getrennte Route-Komponenten
- getrennte Moduldefinitionen
- getrennte Statistik-Einstiege
- die Möglichkeit, die aktuell gemeinsam verwendete interne Basis später einzeln zu ersetzen

Konkrete RPC-Namen bleiben in den Moduladaptern und gehören nicht in den neutralen Kern.

`scripts/check-training-module-architecture.mjs` schützt diese Grenzen.

### Neutrale UI-Bausteine aus S3d

Unter `src/features/training-session/components` befinden sich u. a.:

- `TrainingDateControls`
- `SpecialTrainingPicker`
- `TrainingAttendanceWorkspace`
- `TrainingDetailsPanel`
- `TrainingAutosaveStatus`
- `TrainingAthleteDeactivateDialog`
- `TrainingContactDialog`
- `QuickAthleteDialog`

Wenn sich eine Trainingsgruppe fachlich anders entwickelt, darf das betroffene Modul eine eigene Unterkomponente oder einen eigenen Adapter erhalten. Shared-Code ist eine Wiederverwendungsmöglichkeit, kein fachlicher Zwang.

---

## 6. Supabase, Datenbank und Sicherheit

### 6.1 Client-Konfiguration

Der Browser verwendet ausschließlich:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Service-Role- oder andere Server-Secrets gehören nicht ins Frontend.

### 6.2 Row Level Security und Funktionen

Migrationen unter `supabase/migrations` sind die vollständige Schemahistorie.

Verbindliche Checks prüfen unter anderem:

- Migrationsreihenfolge
- RLS-Abdeckung
- sichere `SECURITY DEFINER`-Funktionen
- Konsistenz der generierten TypeScript-Datenbanktypen

Neue Datenbankänderungen werden als neue Migration ausgeliefert. Bereits produktive Migrationen werden nicht rückwirkend umgeschrieben.

### 6.2.1 Automatische Produktionsmigration und Verifikationsnachweis

Nach jedem Push auf `main` startet `.github/workflows/production-database.yml`. Der Workflow verwendet ausschließlich das Repository-Secret `SUPABASE_DB_URL`, führt zuerst `supabase db push --dry-run`, anschließend `supabase db push` aus und vergleicht danach die Versionsliste unter `supabase/migrations` exakt mit `supabase_migrations.schema_migrations` der Produktionsdatenbank. Es werden **keine** Seeds eingespielt, keine Datenbank resettet und keine abweichende Migrationshistorie automatisch per `migration repair` korrigiert.

Nur wenn Repo und Produktion exakt übereinstimmen, wird der leichte Git-Tag `database-verified-<Git-Commit>` erzeugt. `scripts/release/mark-production.mjs` verlangt diesen Tag für exakt `origin/main`, bevor ein `production-*`-Tag angelegt werden darf. Dadurch bleibt der Benutzerworkflow bei sechs CMD-Dateien, ein Frontendstand mit fehlenden produktiven Migrationen kann aber nicht mehr als stabil markiert werden.

Für den einmalig festgestellten historischen Sonderfall einer **leeren** `supabase_migrations.schema_migrations` bei bereits bestehendem Produktionsschema existiert zusätzlich `.github/workflows/production-database-baseline-recovery.yml`. Diese Recovery ist kein normaler Releaseweg. Sie ist manuell, auf `main` beschränkt, verlangt die exakte Bestätigung `BASELINE-REPARIEREN` und ist fest auf die verifizierte Baseline `202608080039` sowie die danach einzige offene Migration `202608090040` begrenzt. Vor dem Eintragen historischer Versionsnummern vergleicht sie das Produktionsschema gegen die Baseline und prüft zusätzliche Storage-/Realtime-/Stammdaten-Invarianten. Bei jeder bereits nichtleeren Remote-Historie bricht sie ab. Die Recovery erzeugt keinen `database-verified-*`-Tag; danach muss der normale Workflow `Produktionsdatenbank migrieren` für denselben `main`-Commit erneut erfolgreich laufen und allein den regulären Verifikations-Tag erzeugen. Der normale Produktionsworkflow bleibt weiterhin frei von automatischer Historienreparatur.

Manuelle Schemaänderungen im Supabase-Dashboard sind kein normaler Releaseweg. Produktive Schemaänderungen müssen immer zuerst als neue Migration im Repository vorliegen.

### 6.3 Simulation / schreibgeschützte Benutzeransicht

Die Benutzer-Simulation ist technisch gegen Schreibvorgänge abgesichert.

`src/lib/supabase.ts` umschließt den Supabase-Client und blockiert im Simulationsmodus unter anderem:

- schreibende Table-Builder-Methoden
- nicht ausdrücklich read-only markierte RPCs
- Edge-Function-Aufrufe
- schreibende Storage-Operationen
- schreibende Auth-Operationen

`check:simulation-safety` ist ein hartes Gate.

### 6.4 HTTP-Sicherheitsheader

`vercel.json` definiert u. a.:

- Content-Security-Policy
- HSTS
- `X-Content-Type-Options`
- `X-Frame-Options`
- Referrer-Policy
- Permissions-Policy

Änderungen daran müssen durch `check:security-headers` abgesichert bleiben.

---

## 7. CSS-Architektur und Ownership

### Globale CSS-Einstiege

`src/main.tsx` lädt genau drei globale CSS-Einstiegsdateien:

```text
global.css
mobile.css
mobile-foundation.css
```

Feature- und Routen-CSS soll lazy über die jeweilige Route geladen werden.

### Stand nach S3b/S3d

Referenzmessung:

- 36 CSS-Dateien
- 325.478 Bytes / 13.333 Zeilen gesamt – Beobachtungswert
- 3 globale Dateien / 35.970 Bytes
- 41 routebezogene CSS-Imports – Beobachtungswert
- größter Route-CSS-Import: 40.029 Bytes
- größte CSS-Datei: `training-planning.css` mit 35.598 Bytes / 1.831 Zeilen
- Selektor-Duplikationsquote: 7,84 %
- 32 `!important`
- 50 Legacy-Media-Query-Vorkommen
- 14 featurebezogene Selektorvorkommen in `global.css`

### Harte Gates

Aktuell geschützt werden insbesondere:

- maximal 3 globale CSS-Einstiege
- maximal 40.000 global importierte CSS-Bytes
- maximal 50.000 Bytes pro routebezogenem CSS-Import
- maximal 45.000 Bytes bzw. 2.200 Zeilen für die größte CSS-Datei
- maximal 9,50 % dateiübergreifende Selektor-Duplikationsquote
- maximal 38 `!important`
- keine Zunahme der 54 Legacy-Media-Query-Vorkommen
- maximal 30 featurebezogene Selektorvorkommen in `global.css`

Gesamtzahl von CSS-Dateien, Route-Imports und Gesamt-CSS-Größe sind bewusst **Beobachtungswerte**, keine künstlichen Gesamtlimits.

Bevor ein hartes Budget erhöht wird, muss zuerst geprüft werden, ob CSS konsolidiert, routebezogen verschoben oder strukturell vereinfacht werden kann.

`scripts/check-css-ownership.mjs` verhindert insbesondere, dass ausgelagerte Stammdaten-/Benutzerverwaltungsregeln wieder nach `global.css` zurückwandern.

`scripts/check-route-css-ownership.mjs` schützt zusätzlich die Laufzeit-Ownership: Shared-Komponenten müssen ihr CSS selbst importieren oder globale UI-Utilities verwenden. Eine Route darf niemals nur deshalb korrekt aussehen, weil zuvor eine andere lazy Route besucht und deren Stylesheet bereits geladen wurde.

### 7.1 Verbindlicher UI-Control-Standard

Die App verwendet für normale Bedienelemente semantische, fachlich neutrale Grundvarianten. Ziel ist, dass ein Speichern-, Bearbeiten-, Schließen- oder Löschbutton unabhängig von Route und CSS-Ladereihenfolge gleich gerendert wird.

Zentrale Geometrie:

- `--ui-control-height: 42px` für normale Buttons und Formularfelder
- `--ui-control-height-compact: 38px` für explizit kompakte Controls
- `--ui-icon-button-size: 40px` für normale Iconaktionen
- `--ui-control-radius: 10px`
- Checkboxen/Radios: `20 x 20px`
- mobile Formulareingaben: mindestens `16px` Schriftgröße

Zentrale Semantik:

- `.icon-button` – neutrale Iconaktion
- `.icon-button--save` – grüne Fläche, weißes Speichern-Symbol
- `.icon-button--danger` – destruktive Iconaktion; Hover/Focus bleiben rot
- `.icon-button--favorite` + `aria-pressed` – Favorit, aktiv goldene Fläche + gefüllter Stern; Hover/Focus bleiben gold und werden nie grün
- `.icon-button--selected` + `aria-pressed` – persistente/temporäre Auswahlaktion; kein generisches `.active` für Iconzustände
- `.icon-button--inline` – feldinterne Iconaktion
- `.ui-tabs` – gemeinsamer Tabcontainer
- `.ui-segmented` – kompakte exklusive Auswahl
- `.ui-search-field` – einziges Standard-Suchfeld
- `.ui-choice-row` – anklickbare Checkbox-/Mehrfachauswahlzeile
- `.ui-switch` / `.ui-switch-control` – echter Ein/Aus-Zustand über `role="switch"` + `aria-checked`, nicht über generisches `.active`
- `.ui-labeled-field` – normales beschriftetes Formularfeld als gemeinsamer Rahmen
- `.ui-field-label` – dauerhaft sichtbare hellgraue Feldkopfzeile innerhalb dieses Rahmens
- `.ui-field-control` – eigentliche Text-/Select-/Zahl-/Datum-/Textarea-Eingabe innerhalb des Feldrahmens

Normale beschriftete Textfelder, Selects, Zahlen-/Datumsfelder und Textareas verwenden dieses integrierte Feldmuster appweit. Suchfelder, Checkboxen/Switches, kompakte Inline-Parameter in Tabellen und fachliche Spezialcontrols bleiben bewusst eigene Controltypen. Ein Placeholder ersetzt keine Feldbezeichnung.

`EditorActionHeader` ist der gemeinsame Kern aller Seiteneditor-Kopfzeilen. `EditorShell` und `StickyEditorActions` verwenden ausschließlich diesen Kern. Echte CRUD-Editoren bleiben unter der globalen App-Kopfzeile sichtbar; Speichern erfolgt oben über die grüne Diskette, Schließen über X, kontextbezogene Hilfe über ?. Ein zusätzlicher Speichern-/Abbrechen-Footer ist nicht vorgesehen. Nur echte Bestätigungs-, Info-, Auswahl- oder Importdialoge dürfen modal bleiben.

Feature-CSS darf normale Save-/Close-/Edit-/Info-/Delete-Controls nicht über eigene Farben und Größen neu definieren. `final-ui-v1.css` darf die Semantik generischer `.icon-button` ebenfalls nicht überschreiben. Für kompakte Standardbuttons ist ausschließlich `.compact-button` zulässig; die generische Klasse `.compact` darf dafür nicht verwendet werden. Neutrale segmentierte Auswahlen verwenden `.ui-segmented`; Feature-CSS darf dort nur fachlich begründete Zustandsfarben ergänzen.

Fachliche Statuscontrols dürfen eigene Zustandsfarben behalten, müssen aber zur gemeinsamen Größen-, Fokus- und Radiusfamilie passen.

`scripts/check-ui-controls.mjs` schützt diesen Vertrag und ist Teil von `ci:quality` und `ci:preview`. Der Runtime-Smoke prüft bei zentralen Editoraktionen sowie semantischen Favoritenzuständen zusätzlich berechnete Styles, damit Fehler durch CSS-Spezifität erkannt werden.

Zentrale schreibende CRUD-Editoren werden nicht nur auf Rendern geprüft. Writing-E2E muss mindestens einen echten Speichervorgang mit anschließendem Reload/Read-back abdecken; persistente Zustände wie Favoriten werden ebenfalls nach Reload validiert.

---

## 8. Testarchitektur

Tests sind in klar getrennte Schichten aufgeteilt.

### 8.1 TypeScript

```text
npm run typecheck
```

ist ein hartes Gate.

### 8.2 Smoke-Tests

```text
npm run test:smoke
```

prüft schnelle App-/Fachstruktur-Invarianten. Reine Release-Infrastruktur gehört nicht in den allgemeinen Smoke-Test.

### 8.3 Architektur- und Infrastrukturchecks

Dedizierte `check:*`-Skripte schützen z. B.:

- Migrationen
- generierte DB-Typen
- API-Grundlage
- UI-Grundlage
- Trainingsmodulgrenzen
- E2E-Struktur
- Writing-Test-Isolation
- Test-Layering
- stabile Testinteraktionen
- Security Header
- Backup/Restore
- Katalog/Blöcke
- Hilfe
- PWA
- CSS
- Release-Infrastruktur
- Simulationssicherheit

### 8.4 Read-only E2E

Playwright-Konfiguration:

- Chromium
- `de-AT`
- Zeitzone `Europe/Vienna`
- lokal ein Worker
- Viewports:
  - 360 × 800
  - 390 × 844
  - 430 × 932
  - Desktop 1280 × 900

Pull Requests verwenden für den schnellen Pflichtlauf das definierte PR-Profil; auf `main` läuft die vollständige Regression.

### 8.5 Runtime-Smoke

Die Runtime-Tests bauen eine **isolierte deterministische E2E-Supabase-Konfiguration**. Lokale `.env`-Werte dürfen den Auth-/Runtime-Test nicht unbemerkt beeinflussen.

Auf Pull Requests läuft das markierte kritische Runtime-Kernset auf Mobile 390 und Desktop 1280. Auf `main` läuft die vollständige Runtime-Suite.

### 8.6 Writing-E2E

Schreibende E2E laufen gegen eine isolierte lokale Supabase-Umgebung in GitHub.

Die Suite ist nach fünf Testdomänen getrennt. Jede Domäne deklariert ihre schreibbaren Ressourcen. Die Isolation wird vor dem teuren Browser-/Dockerlauf geprüft.

GitHub:

- `fullyParallel: false`
- 2 Worker
- verschiedene Domänen dürfen parallel laufen
- innerhalb einer Domäne bleibt die Reihenfolge seriell

Lokal:

- 1 Worker

`check:writing-test-isolation` und die zugehörigen `node:test`-Tests verhindern Ressourcenkollisionen.

### 8.7 Stabile Browserinteraktionen

Häufige Bedienpfade werden über gemeinsame Helper unter `tests/helpers/` angesprochen.

Beispiele:

```text
tests/helpers/user-management.mjs
tests/helpers/masterdata.mjs
```

Gezielte `data-testid`-Anker sind ausdrücklich erlaubt, wenn sie Tests von sichtbaren Icon-Texten, CSS-Klassen oder Layoutpositionen entkoppeln. Sie dürfen den sichtbaren Inhalt und die Fachlogik nicht verändern.

`check:test-interactions` verhindert die Rückkehr zu bekannten fragilen Direktselektoren.

---

## 9. GitHub Actions

Wichtige Workflows:

### Qualitätsprüfung

`.github/workflows/quality-check.yml`

enthält parallel:

- `Quality-Kernprüfung`
- `Browser-Runtime`

Der bestehende verpflichtende Aggregator heißt:

```text
TypeScript, Tests, Build und Runtime
```

und wird nur grün, wenn beide Teiljobs erfolgreich sind.

### Read-only Browser-E2E

`.github/workflows/e2e-readonly.yml`

- PR: schnelles Pflichtprofil
- `main`/manuell: Vollregression über alle definierten Viewports

### Writing-E2E

`.github/workflows/e2e-writing.yml`

- Path-/Scope-Filter verhindert unnötigen lokalen Supabase-Start bei eindeutig nicht schreibrelevanten PRs
- Teststruktur wird vor Docker geprüft
- Supabase-Start und Chromium/Systemabhängigkeiten werden parallel vorbereitet
- Laufzeiten werden in der GitHub Step Summary erfasst
- auf `main` bleibt die Vollregression erhalten

Playwright-Browserbinaries werden bewusst nicht als eigener GitHub-Actions-Cache behandelt.

---

## 10. Die sechs permanenten Windows-Routinen

Diese Dateien liegen dauerhaft in `C:\ULC Linz App`:

1. `ULC-AENDERUNG-STARTEN.cmd`
2. `ULC-UPDATE-INSTALLIEREN.cmd`
3. `ULC-LOKAL-ANSEHEN.cmd`
4. `ULC-PRUEFEN.cmd`
5. `ULC-FREIGEBEN.cmd`
6. `ULC-PRODUKTION-MARKIEREN.cmd`

Der normale Updateprozess darf diese Routinen nicht durch immer neue ad-hoc START-Dateien ersetzen.

Eine einmalige Bootstrap-/Reparatur-CMD ist nur dann vertretbar, wenn **genau die permanente Update-Infrastruktur selbst defekt ist**, der normale Weg dadurch unmöglich ist und diese Ausnahme vorher ausdrücklich abgestimmt wird.

---

## 11. Verbindlicher Entwicklungs- und Releasezyklus

```text
voriger Produktionszyklus vollständig abgeschlossen
        ↓
sauberer main + origin/main + production-* Tag
        ↓
ULC-AENDERUNG-STARTEN.cmd
        ↓
genau ein neuer feature/... Branch
        ↓
automatische Git-Projekt-ZIP auf Desktop
        ↓
ZIP an ChatGPT
        ↓
ChatGPT erzeugt ULC-Linz-App-UPDATE-....zip
        ↓
ZIP in Windows Downloads
        ↓
ULC-UPDATE-INSTALLIEREN.cmd
        ↓
transaktionales Overlay + vollständige Releaseprüfung
        ↓
ULC-LOKAL-ANSEHEN.cmd
        ↓
ULC-PRUEFEN.cmd
        ↓
ULC-FREIGEBEN.cmd
        ↓
GitHub Pull Request
        ↓
alle erforderlichen Checks grün
        ↓
Squash and merge
        ↓
Vercel Produktion prüfen
        ↓
ULC-PRODUKTION-MARKIEREN.cmd
        ↓
sauberer main + neuer production-* Tag
```

Erst danach wird der nächste Entwicklungszyklus gestartet.

---

## 12. Änderung starten und Git-Projekt-ZIP

`ULC-AENDERUNG-STARTEN.cmd` darf nur erfolgreich sein, wenn:

- Worktree sauber
- aktueller Branch exakt `main`
- lokaler `main` = `origin/main`
- derselbe Commit auf `origin` durch mindestens einen `production-*`-Tag bestätigt
- gewünschter Feature-Branch lokal und remote noch nicht vorhanden

Danach:

- genau ein `feature/...`-Branch von `origin/main`
- Release-Verifikation wird gelöscht
- Git-Projekt-ZIP wird automatisch erzeugt

Schlägt die ZIP-Erstellung nach Branch-Erstellung fehl, wird auf `main` zurückgekehrt und der neue Branch entfernt.

### Git-Projekt-ZIP

Die ZIP wird aus:

```text
git archive HEAD
```

erstellt und nicht aus einer Dateisystemkopie.

Sie enthält zusätzlich:

```text
ULC-SOURCE-METADATA.json
```

mit:

- vollständigem Commit
- kurzem Commit
- Git-Tree
- Branch
- UTC-Erstellungszeit
- Node-Version
- npm-Version

Gefährliche getrackte Dateien wie echte `.env`-Dateien, `supabase-local.env`, `node_modules`, `dist`, Testreports oder Supabase-Tempdateien blockieren die Archivierung. `.env.example` ist auch in Unterordnern als Vorlage zulässig.

Für einen neuen Chat ist **diese ZIP die einzige autoritative Codebasis**.

---

## 13. Updatepaket und Manifest v2

Normale Pakete heißen:

```text
ULC-Linz-App-UPDATE-<Name>_<Datum>.zip
```

Sie enthalten mindestens:

```text
manifest.json
payload/...
README.txt
TESTERGEBNIS.txt
```

### Erlaubte `packageType`-Werte

Nur:

```text
module
release
```

Keine erfundenen Werte wie `infrastructure`.

### Dateioperationen

Jeder Manifest-Eintrag verwendet:

- `create`
- `replace`
- `delete`

und:

- `hashMode: raw` oder
- `hashMode: text-lf`

Für bestehende Dateien ist der alte SHA-256 erforderlich; für geschriebene Dateien der neue SHA-256.

Textdateien sollen bevorzugt `text-lf` verwenden, damit CRLF/LF-Unterschiede unter Windows keine falschen Hashfehler verursachen.

---

## 14. Manifestmodus `fresh-feature`

Für den normalen neuen Entwicklungszyklus:

```json
{
  "formatVersion": 2,
  "packageId": "eindeutige-id",
  "packageType": "module",
  "target": {
    "mode": "fresh-feature",
    "baseCommit": "40-stelliger-vollstaendiger-commit"
  },
  "files": []
}
```

Der Installer verlangt:

- Branch beginnt mit `feature/`
- HEAD exakt `baseCommit`
- `origin/main` exakt `baseCommit`
- gleichnamiger Feature-Branch noch nicht remote vorhanden
- keine Konflikte
- sauberer Worktree vor der Installation
- alle alten Dateihashes exakt passend

Der Paketname oder eine Erinnerung aus dem Chat ersetzt niemals diese Prüfungen.

---

## 15. Manifestmodus `existing-pr`

Wenn ein bereits gepushter Pull Request korrigiert werden muss:

```json
{
  "formatVersion": 2,
  "packageId": "pr-korrektur",
  "packageType": "module",
  "target": {
    "mode": "existing-pr",
    "expectedBranch": "feature/beispiel",
    "expectedHead": "40-stelliger-pr-commit",
    "expectedMain": "optional-40-stelliger-main-commit"
  },
  "files": []
}
```

Der Installer verlangt:

- exakt `expectedBranch`
- lokaler HEAD exakt `expectedHead`
- `origin/<feature>` exakt `expectedHead`
- optional `origin/main` exakt `expectedMain`
- exakte alte Dateihashes

Für eine PR-Korrektur wird **kein zweiter Feature-Branch** angelegt.

---

## 16. Permanenter Update-Installer

`ULC-UPDATE-INSTALLIEREN.cmd` ruft:

```text
scripts/release/install-update-package.ps1
```

auf.

Die Routine:

1. sucht ausschließlich im Windows-Download-Ordner,
2. berücksichtigt nur `ULC-Linz-App-UPDATE-*.zip`,
3. entpackt Kandidaten temporär,
4. prüft jeden Kandidaten über `install-overlay.mjs --check-only`,
5. zeigt bei Ablehnung den konkreten Grund,
6. wählt nur einen eindeutig passenden Pakethash,
7. toleriert Browser-Duplikate wie `(1).zip` nur bei identischem SHA-256,
8. blockiert bei mehreren verschiedenen anwendbaren Paketen,
9. zeigt das ausgewählte Paket und SHA-256,
10. verlangt exakt die Bestätigung `JA`.

Unter Windows PowerShell 5.1 entscheidet bei nativen Probeprozessen ausschließlich der Exitcode. Erfolgreiche `git fetch`-Ausgaben auf stderr dürfen nicht als Paketfehler interpretiert werden.

---

## 17. Overlay, Backup und transaktionaler Rollback

`scripts/release/install-overlay.mjs` ist der zentrale Overlay-Installer.

Vor Änderungen:

- Git-Zustand prüfen
- Zielmodus prüfen
- alte Dateihashes prüfen
- eindeutigen lokalen `backup/...`-Branch anlegen

Danach:

- vollständige Dateien erzeugen/ersetzen/löschen
- keine unsicheren Textpatches
- kein `git reset --hard`
- kein automatischer Commit
- kein Push
- kein Merge

Ändert das Paket `package.json` oder `package-lock.json`, wird `node_modules` vor der Releaseprüfung reproduzierbar über `npm ci` synchronisiert.

Bei Fehler:

- exakt die Paketdateien aus dem validierten Ausgangscommit wiederherstellen
- neu erzeugte Dateien entfernen
- Feature-Branch auf dem vorgesehenen Ausgangszustand belassen
- kein unsicherer Stand wird freigegeben

Ein fehlgeschlagener Releasecheck ist ein **erfolgreich funktionierendes Sicherheitsgate**, nicht ein Grund, Tests zu umgehen.

---

## 18. Vollständige Releaseprüfung und Prüfnachweis

Nach dem Overlay startet automatisch:

```text
scripts/release/run-release-check.mjs
```

Aktuelles Releaseprofil:

```text
full-release-v2
```

Verbindliche Checkgruppen im Prüfnachweis:

- `ci:quality`
- `runtime-smoke-isolated`

### `ci:quality`

enthält TypeScript, Smoke-/Architekturprüfungen, Migrationen, DB-Typen, E2E-Struktur, Testisolation, Security, Backup, Hilfe, PWA, CSS, Release-Infrastruktur, Overlay-/Freigabe-/Verification-/Start-Change-Tests, Produktionsbuild und Performancebudget.

### Isolierter Runtime-Test

Der zweite Teil erzeugt einen separaten Runtime-Build mit deterministischer E2E-Supabase-Konfiguration und testet ihn mit Chromium.

### Prüfnachweis

Bei Erfolg entsteht:

```text
.git/ulc-release/verification.json
```

mit:

- Profil
- Branch
- HEAD
- Worktree-Fingerprint
- Prüfzeitpunkt
- ausgeführten Checkgruppen

Dieser Nachweis gehört absichtlich unter `.git` und wird nicht committed.

---

## 19. `ULC-PRUEFEN.cmd`

`ULC-PRUEFEN.cmd` prüft zuerst, ob der vorhandene vollständige Prüfnachweis exakt wiederverwendbar ist.

Wiederverwendung nur wenn:

- korrektes Profil
- alle Pflichtchecks vorhanden
- identischer Branch
- identischer HEAD
- identischer Worktree-Fingerprint

Dann werden Build und Browsertests nicht unnötig wiederholt.

Sobald sich eine relevante Datei, Branch oder HEAD ändert, ist der Nachweis ungültig und die vollständige Prüfung läuft automatisch erneut.

---

## 20. `ULC-FREIGEBEN.cmd`

Freigabe ist nur mit gültigem vollständigem Prüfnachweis erlaubt.

Bei lokalen Änderungen:

- Status und Diff anzeigen
- Commit-Nachricht abfragen
- Bestätigung `JA`
- exakt den geprüften Stand committen
- Feature-Branch pushen
- Remote-Commit danach erneut verifizieren

Der Update-Installer selbst darf diesen Schritt nie übernehmen.

---

## 21. GitHub Pull Request

Zielbranch ist `main`.

Regeln:

- alle erforderlichen GitHub-Checks müssen grün sein
- keine roten Checks „wegkonfigurieren“, um einen Merge zu erzwingen
- Merge ausschließlich manuell
- Merge-Methode: **Squash and merge**

Für einen Fehler im offenen PR:

- Ursache zuerst analysieren
- falls Codekorrektur nötig: `existing-pr`-Paket auf exakt dem gepushten PR-Commit
- derselbe Feature-Branch
- erneut prüfen und freigeben

---

## 22. Vercel und Produktionsmarkierung

Nach Squash-Merge:

1. Vercel-Produktionsdeployment abwarten.
2. Funktion kurz prüfen.
3. Commit des tatsächlich laufenden Produktionsdeployments bestimmen.
4. `ULC-PRODUKTION-MARKIEREN.cmd` starten.
5. genau diesen Deployment-Commit eingeben.

Die Routine verlangt:

- Deployment-Commit = aktueller `origin/main`
- sauberen Worktree
- lokalen `main`
- ausschließlich Fast-Forward auf `origin/main`
- kein Hard Reset

Danach erzeugt und pusht sie:

```text
production-<zeitstempel>-<shortcommit>
```

Erst wenn dieser Tag existiert, darf `ULC-AENDERUNG-STARTEN.cmd` den nächsten Zyklus beginnen.

---

## 23. Recovery-Regeln

### Installations-/Testfehler vor Commit

- transaktionalen Installer-Rollback verwenden
- ersten echten Fehler analysieren
- nicht manuell Dateien zurechtkopieren
- korrigiertes Paket wieder auf exakt derselben Basis liefern

### Fehler in bereits gepushtem PR

- `existing-pr`
- kein zweiter Feature-Branch
- Remote-Feature-Commit muss exakt zum Paket passen

### Problem nach Merge / Produktion

Kein Hard Reset von `main`.

Wenn Produktion zurückgenommen werden muss:

- stabilen Baum über Git/GitHub wiederherstellen
- erforderlichenfalls Recovery-PR
- erst danach wieder Produktion markieren

---

## 24. Definition of Done für eine Änderung

Eine Änderung ist erst abgeschlossen, wenn alle für sie relevanten Punkte erfüllt sind:

- [ ] Ausgangsbasis war ein bestätigter Produktionscommit.
- [ ] Änderung wurde aus der aktuellen Git-Projekt-ZIP erstellt.
- [ ] Manifest v2 und SHA-256 stimmen.
- [ ] Overlay-Installer akzeptiert exakt den vorgesehenen Git-Zustand.
- [ ] keine fachfremden Dateien wurden verändert.
- [ ] TypeScript erfolgreich.
- [ ] statische/architektonische Gates erfolgreich.
- [ ] Produktionsbuild erfolgreich.
- [ ] Performancebudget erfolgreich.
- [ ] isolierter Runtime-Test erfolgreich.
- [ ] lokale Sichtprüfung durchgeführt.
- [ ] `ULC-PRUEFEN.cmd` erfolgreich.
- [ ] `ULC-FREIGEBEN.cmd` erfolgreich.
- [ ] GitHub-Checks erfolgreich.
- [ ] PR per Squash Merge in `main`.
- [ ] Vercel-Produktion erfolgreich geprüft.
- [ ] Produktionscommit = `origin/main`.
- [ ] `ULC-PRODUKTION-MARKIEREN.cmd` erfolgreich.
- [ ] lokaler Stand wieder sauber auf `main`.
- [ ] neuer `production-*`-Tag vorhanden.
- [ ] bei sichtbaren/fachlichen Änderungen Hilfe/Dokumentation geprüft.

---

## 25. Regeln, die ein neuer Chat nicht eigenmächtig ändern darf

Ohne ausdrückliche Abstimmung **nicht ändern**:

1. die sechs permanenten CMD-Routinen als normaler Benutzerworkflow,
2. Git-basierte Source-ZIP als einzige ChatGPT-Codebasis,
3. vollständige Datei-Overlays statt Textpatches,
4. Manifest v2 für neue Pakete,
5. SHA-256-Prüfung alter und neuer Dateien,
6. `fresh-feature`-/`existing-pr`-Semantik,
7. transaktionalen Rollback,
8. Verbot von automatischem Commit/Push/Merge im Installer,
9. PR mit manueller Freigabe und Squash Merge,
10. Produktionsmarkierung per `production-*`-Tag,
11. Verbot von `git reset --hard` im normalen Workflow,
12. Wiederverwendung des vollständigen Prüfnachweises nur bei exakt identischem Zustand,
13. GitHub als unabhängiges zweites Testgate,
14. getrennte Fachgrenzen von Kindertraining, U12 und U14,
15. CSS-/API-/Testarchitektur-Gates nur nach Ursachenanalyse lockern,
16. keine Docker-Pflicht in den normalen lokalen Entwicklungs-/Releaseworkflow einführen,
17. keine ad-hoc individuellen START-CMDs für normale Updates,
18. keine rekursive Paket-/Skriptsuche außerhalb der festgelegten Struktur.

Wenn eine dieser Regeln selbst das Problem verursacht, zuerst Problem und geplante Abweichung erklären und die Änderung ausdrücklich abstimmen.

---

## 26. Regeln für künftige ChatGPT-Pakete

Ein neuer Chat soll bei jeder hochgeladenen Projekt-ZIP zuerst:

1. `ULC-SOURCE-METADATA.json` lesen,
2. Commit, Tree und Branch nennen,
3. prüfen, ob die Aufgabe ein normales `fresh-feature` oder eine `existing-pr`-Korrektur ist,
4. die tatsächlich betroffenen Dateien im Archiv untersuchen,
5. keine älteren Chatkopien als Basis verwenden.

Vor Auslieferung eines Updatepakets:

- Paketdateien als vollständige Dateien erzeugen
- Manifest v2 bauen
- alte/neue SHA-256 verifizieren
- möglichst die vorhandenen statischen Projektchecks ausführen
- Manifest gegen den produktiven Overlay-Installer im `--check-only`-Modus prüfen, idealerweise in einem isolierten Git-Repo mit passendem `origin/main`
- klar ausweisen, welche Tests wirklich ausgeführt wurden und welche erst der Ziel-PC/GitHub ausführt

Normale Auslieferung:

```text
nur ULC-Linz-App-UPDATE-....zip
```

Keine zusätzliche START-CMD.

---

## 27. Dokumente und technische Quellen

Wichtige ergänzende Dokumente:

- `DEVELOPMENT-RELEASE.md` – Historie und Details der S1–S3-Konsolidierung
- `README.md` – Produkt-/Entwicklungsüberblick
- `MASTER-PROMPT-NEUER-CHAT.md` – kopierfertiger Übergabeprompt
- `P2A-LESEMODELLE-PERFORMANCE.md`
- `P2B-PWA-HILFESYSTEM.md`
- `P2C-STAMMDATEN-MOBILE-UX.md`
- `E3C-SICHERHEITSHEADER.md`
- `E3D-BACKUP-WIEDERHERSTELLUNGSTEST.md`
- `E4-MEHRBENUTZER-KONSISTENZ.md`
- `E5-UEBUNGSKATALOG-TRAININGSBLOECKE.md`

Die ausführbaren Skripte und der aktuelle Git-Stand haben bei technischen Details Vorrang vor älteren Markdown-Notizen.


### Entfernte Altinfrastruktur

Der frühere `mobile-patch/**`-GitHub-Workflow und `MOBILE-ENTWICKLUNG.md` sind dauerhaft entfernt. Der sechs-CMD-Workflow ist der einzige normale Updateweg.
