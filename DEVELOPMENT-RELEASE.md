# ULC Linz App – Entwicklungs- und Releaseablauf S1

Stand: 2026-08-08

## Ziel

Jede Änderung startet von einem eindeutig bestätigten Produktionsstand und endet wieder auf einem sauberen, markierten `main`. Updates werden als vollständige Datei-Overlays ausgeliefert, vor der Installation anhand von Git-Zustand und SHA-256-Dateihashes geprüft, vollständig getestet und bei Fehlern transaktional zurückgerollt.

S1 vereinheitlicht den Ablauf zusätzlich:

- Projektarchive entstehen ausschließlich aus dem aktuellen Git-Commit.
- Updatepakete verwenden Manifestformat v2.
- Normale Änderungen und Korrekturen eines bereits offenen Pull Requests verwenden denselben Installer.
- `ULC-PRUEFEN.cmd` darf einen bereits bestandenen vollständigen Prüfnachweis wiederverwenden, wenn Branch, HEAD und Worktree-Fingerprint exakt unverändert sind.
- Playwright Test ist Bestandteil von `package.json` und `package-lock.json`; keine CI- oder lokale Routine installiert mehr eine abweichende Testversion neben dem Lockfile.

## Die sechs permanenten Windows-Routinen

Diese Dateien liegen dauerhaft im Projektordner und werden nicht für jedes Update neu erzeugt:

1. `ULC-AENDERUNG-STARTEN.cmd`
2. `ULC-UPDATE-INSTALLIEREN.cmd`
3. `ULC-LOKAL-ANSEHEN.cmd`
4. `ULC-PRUEFEN.cmd`
5. `ULC-FREIGEBEN.cmd`
6. `ULC-PRODUKTION-MARKIEREN.cmd`

## 1. Änderung starten

`ULC-AENDERUNG-STARTEN.cmd` darf nur erfolgreich laufen, wenn:

- das Arbeitsverzeichnis sauber ist,
- der aktuelle lokale Branch exakt `main` ist,
- lokaler `main` exakt `origin/main` entspricht,
- dieser Commit auf `origin` bereits durch mindestens einen `production-*`-Tag als bestätigte Produktion markiert ist,
- der gewünschte neue `feature/...`-Branch weder lokal noch auf `origin` bereits existiert.

Erst danach wird genau ein neuer `feature/...`-Branch direkt von `origin/main` erzeugt.

Falls nach der Branch-Erstellung die automatische Source-ZIP-Erzeugung fehlschlägt, wird der Startvorgang transaktional zurückgerollt: zurück zu `main`, neu angelegten Feature-Branch entfernen, kein halbfertiger Entwicklungszyklus.

## Git-basierte Projekt-ZIP

Die automatisch erzeugte Projekt-ZIP wird nicht mehr per Dateisystem-Kopie erstellt, sondern ausschließlich aus:

```text
git archive HEAD
```

Dadurch enthält sie nur Dateien des tatsächlich geprüften Git-Commits. Lokale Reports, Build-Ausgaben, temporäre Supabase-Dateien, untracked Dateien und lokale Zugangsdaten gelangen nicht versehentlich in die Source-of-Truth.

Zusätzlich enthält jedes neue Archiv:

```text
ULC-SOURCE-METADATA.json
```

mit mindestens:

- vollständigem 40-stelligem Commit,
- kurzem Commit,
- Git-Tree,
- Branch,
- Erstellungszeit,
- Node-Version,
- npm-Version.

Die Archivroutine verweigert die Erstellung, falls gefährliche lokale Dateien wie `supabase-local.env`, Environment-Dateien oder Test-/Build-Ausgaben versehentlich von Git getrackt würden.

## 2. Update installieren

Nach S1 wird für normale weitere Updates keine individuell programmierte START-CMD mehr benötigt.

ChatGPT liefert standardmäßig nur noch ein Paket im Namensraum:

```text
ULC-Linz-App-UPDATE-<Name>_<Datum>.zip
```

Dieses ZIP bleibt im Windows-Download-Ordner. Danach wird im Projektordner ausgeführt:

```text
ULC-UPDATE-INSTALLIEREN.cmd
```

Die Routine:

1. durchsucht ausschließlich den Windows-Download-Ordner und nicht rekursiv andere Verzeichnisse,
2. berücksichtigt nur `ULC-Linz-App-UPDATE-*.zip`,
3. entpackt Kandidaten nur temporär,
4. lässt deren Manifest per `install-overlay.mjs --check-only` gegen den aktuellen Git-Zustand prüfen,
5. wählt nur ein eindeutig passendes Paket,
6. akzeptiert identische Browser-Duplikate wie `(1).zip` nur, wenn der SHA-256 identisch ist,
7. bricht bei mehreren unterschiedlichen passenden Paketen ab,
8. verlangt vor der Installation nochmals ausdrücklich `JA`,
9. committet, pusht oder merged niemals automatisch.

## Manifestformat v2

Neue Pakete verwenden Formatversion 2.

### Normale Änderung – `fresh-feature`

```json
{
  "formatVersion": 2,
  "packageId": "beispiel",
  "packageType": "module",
  "target": {
    "mode": "fresh-feature",
    "baseCommit": "40-stelliger-vollstaendiger-commit"
  },
  "files": []
}
```

Der Installer verlangt:

- aktuellen Branch unter `feature/`,
- HEAD exakt auf `baseCommit`,
- `origin/main` exakt auf `baseCommit`,
- noch keinen gleichnamigen Remote-Feature-Branch,
- sauberen Worktree,
- exakte alte Dateihashes.

### Korrektur eines offenen PR – `existing-pr`

```json
{
  "formatVersion": 2,
  "packageId": "pr-korrektur",
  "packageType": "module",
  "target": {
    "mode": "existing-pr",
    "expectedBranch": "feature/beispiel",
    "expectedHead": "40-stelliger-gepushter-pr-commit",
    "expectedMain": "optional-40-stelliger-main-commit"
  },
  "files": []
}
```

Der gleiche zentrale Installer verlangt dann:

- exakt den angegebenen lokalen Feature-Branch,
- exakt den angegebenen lokalen HEAD,
- exakt denselben Commit auf `origin/<feature-branch>`,
- optional exakt den erwarteten `origin/main`,
- sauberen Worktree,
- exakte alte Dateihashes.

Damit existiert kein separater improvisierter PR-Hotfix-Installer mehr.

### Rückwärtskompatibilität

Der zentrale Installer kann bestehende Manifest-v1-Pakete weiterhin lesen. Neue Pakete werden jedoch ausschließlich als Manifest v2 erzeugt.

## Datei-Overlay und Rollback

Jede Paketdatei enthält:

- relativen Pfad,
- Modus `create`, `replace` oder `delete`,
- Hashmodus `raw` oder `text-lf`,
- alten SHA-256, falls die Datei bereits existieren muss,
- neuen SHA-256, falls eine Datei geschrieben wird.

Vor jeder Änderung wird ein eindeutiger lokaler Backup-Branch erzeugt.

Der Installer ersetzt vollständige Dateien. Er führt keine unsicheren Textpatches, keinen Hard Reset und keinen automatischen Merge durch.

Wenn Kopieren oder Release-Prüfung fehlschlägt, werden exakt die Paketdateien aus dem zuvor validierten Ausgangscommit wiederhergestellt; neu erzeugte Dateien werden entfernt. Der Feature-Branch bleibt derselbe.

Ändert ein Paket `package.json` oder `package-lock.json`, synchronisiert der zentrale Installer künftig `node_modules` reproduzierbar mit `npm ci` vor dem Releasecheck.

## 3. Vollständige technische Prüfung

Der Overlay-Installer startet nach erfolgreicher Installation automatisch:

```text
scripts/release/run-release-check.mjs
```

Der vollständige Releasecheck umfasst insbesondere:

1. TypeScript,
2. Smoke- und Architekturtests,
3. Migrationen und generierte Datenbanktypen,
4. Strukturtests der E2E-Suites,
5. Sicherheits-, Backup-, Hilfe-, PWA-, CSS- und Simulationsprüfungen,
6. Tests der Release-Infrastruktur selbst,
7. Produktions-Build,
8. Performance-Budget,
9. isolierten Chromium-Runtime-Test mit deterministischer E2E-Supabase-Konfiguration.

### Stabile Browser-Test-Interaktionen

Browser-Tests duerfen zentrale Bedienablaeufe nicht mehrfach mit CSS-Klassen oder
sichtbaren Icon-Texten nachbauen. Fuer haeufig veraenderte Bereiche existiert eine
gemeinsame Interaktionsschicht unter `tests/helpers/`.

Aktuell verbindlich:

- `tests/helpers/user-management.mjs`
  - Benutzerkarte finden
  - Benutzerinfo oeffnen/schliessen
  - Benutzer bearbeiten
  - Benutzeransicht simulieren
  - Einladung erneut senden
- `tests/helpers/masterdata.mjs`
  - Athlet, Trainer und Gruppe ueber stabile Testanker bearbeiten
  - Stammdaten-Wischflaeche adressieren

Die React-Oberflaeche stellt dafuer gezielte `data-testid`-Anker bereit. Diese
Attribute veraendern weder sichtbaren Inhalt noch Fachlogik. Runtime-, Read-only-
und Writing-E2E verwenden die gemeinsamen Helper statt eigener CSS-/Buttonpfade.

`scripts/check-test-interaction-architecture.mjs` ist ein hartes CI-Gate und
verhindert, dass die Kern-Suites auf die alten fragilen Direktselektoren
zurueckfallen.

Nach Erfolg wird in:

```text
.git/ulc-release/verification.json
```

ein versionierter Prüfnachweis gespeichert. Dieser enthält:

- Prüfprofil,
- Branch,
- HEAD,
- Worktree-Fingerprint,
- Zeitpunkt,
- verbindlich ausgeführte Checkgruppen.

## 4. Lokale Sichtprüfung

Nach erfolgreicher Installation:

```text
ULC-LOKAL-ANSEHEN.cmd
```

Die App wird manuell geprüft. Die Sichtprüfung selbst verändert keine Source-Datei.

## 5. `ULC-PRUEFEN.cmd` – Prüfnachweis wiederverwenden

`ULC-PRUEFEN.cmd` startet nicht mehr reflexartig dieselben teuren Tests ein zweites Mal.

Zuerst wird geprüft:

- existiert ein Prüfnachweis im aktuellen Format,
- entspricht er dem aktuellen vollständigen Releaseprofil,
- sind alle verbindlichen Checkgruppen enthalten,
- ist der Branch identisch,
- ist HEAD identisch,
- ist der vollständige Worktree-Fingerprint identisch.

Wenn alles identisch ist, wird die bereits beim Update bestandene Vollprüfung in Sekunden wiederverwendet.

Sobald auch nur eine relevante Datei, HEAD oder Branch verändert wurde, ist der Nachweis ungültig und `ULC-PRUEFEN.cmd` startet automatisch wieder den vollständigen Releasecheck.

## 6. Geprüften Stand freigeben

`ULC-FREIGEBEN.cmd` akzeptiert nur denselben strengen, vollständigen Prüfnachweis wie `ULC-PRUEFEN.cmd`.

Bei uncommittierten Änderungen:

- Status und Diff werden gezeigt,
- Commit-Nachricht wird abgefragt,
- Freigabe verlangt `JA`,
- exakt der geprüfte Stand wird committed,
- Feature-Branch wird gepusht,
- Remote-Commit wird anschließend nochmals geprüft.

Commit, Push oder Merge finden nie im Update-Installer statt.

## 7. GitHub Pull Request

Der Pull Request bleibt das unabhängige zweite Gate.

GitHub installiert die Projektabhängigkeiten reproduzierbar mit:

```text
npm ci
```

`@playwright/test` ist fest im Projekt und Lockfile auf die verwendete Version gepinnt. Die Workflows installieren keine zweite dynamische Playwright-Testversion mehr neben dem Lockfile.

Je nach Änderung laufen zusätzlich:

- Quality + Runtime,
- Read-only Browser-E2E,
- schreibende E2E mit isoliertem Supabase.

Der Merge erfolgt ausschließlich manuell und als `Squash and merge`.

## 8. Vercel und Produktion markieren

Nach erfolgreichem Merge und geprüftem Vercel-Produktionsdeployment:

```text
ULC-PRODUKTION-MARKIEREN.cmd
```

Die Routine verlangt, dass der bestätigte Deployment-Commit exakt `origin/main` entspricht. Danach:

- Wechsel auf lokalen `main`,
- ausschließlich Fast-Forward auf `origin/main`,
- kein Hard Reset,
- Erzeugung und Push eines annotierten `production-*`-Tags,
- sauberer Abschluss auf `main`.

Erst dieser Tag erlaubt dem nächsten `ULC-AENDERUNG-STARTEN.cmd` einen neuen Entwicklungszyklus.

## Verbindliche Reihenfolge ab S1

```text
ULC-PRODUKTION-MARKIEREN des vorigen Zyklus abgeschlossen
    ↓
ULC-AENDERUNG-STARTEN.cmd
    ↓
Git-basierte ULC-Linz-App-Aktuell_...zip hochladen
    ↓
ChatGPT liefert ULC-Linz-App-UPDATE-....zip
    ↓
ULC-UPDATE-INSTALLIEREN.cmd
    ↓
automatische vollständige Release-Prüfung
    ↓
ULC-LOKAL-ANSEHEN.cmd
    ↓
ULC-PRUEFEN.cmd
    ↓
Prüfnachweis wiederverwenden, sofern unverändert
    ↓
ULC-FREIGEBEN.cmd
    ↓
GitHub Pull Request / alle erforderlichen Checks grün
    ↓
Squash and merge
    ↓
Vercel Produktion prüfen
    ↓
ULC-PRODUKTION-MARKIEREN.cmd
    ↓
sauberer main + production-* Tag
```

## Architekturgrenze

S1 ändert ausschließlich die Entwicklungs-, Test- und Release-Infrastruktur. Fachliche Funktionen, Seiteninhalte, Benutzerabläufe und Datenbanklogik werden nicht verändert.

## S2a – CI-Geschwindigkeit ohne schwächere Release-Gates

Seit S2a wird die GitHub-CI auf Pull Requests zeitlich optimiert, ohne die
vollständige Regression auf `main` zu entfernen.

### Quality

Die bisher serielle Kombination aus `ci:quality` und Browser-Runtime wurde in
zwei parallele Jobs getrennt:

- `Quality-Kernprüfung`: TypeScript, statische/strukturelle Tests, Build,
  Performance- und Releaseprüfungen.
- `Browser-Runtime`: echter Chromium-Test gegen einen isolierten Fake-Supabase-Build.

Der bestehende verpflichtende Checkname `TypeScript, Tests, Build und Runtime`
bleibt als Aggregator erhalten und wird nur grün, wenn beide parallelen Jobs grün sind.

Auf Pull Requests läuft im Runtime-Job ein explizit markiertes kritisches Kernset
auf Mobile 390 und Desktop 1280. Nach einem Merge auf `main` läuft weiterhin die
vollständige Runtime-Regressionssuite auf beiden Viewports.

### Schreibende E2E

Die schreibende Suite behält weiterhin:

- den Scope-Filter für nicht schreibrelevante Pull Requests,
- die isolierte lokale Supabase-Umgebung,
- dieselben ausgeschlossenen, nicht benötigten Supabase-Dienste,
- das PR-Kernset bzw. die Vollregression auf `main`.

Zur Zeitersparnis werden `supabase start` und die Installation von Chromium samt
Linux-Systemabhängigkeiten nun parallel gestartet. Beide Prozesse werden
verbindlich auf Exitcode und Status geprüft; ein Fehler in einem der beiden
Teilprozesse bleibt ein harter CI-Fehler.

Der Workflow schreibt die gemessene Dauer von Supabase, Chromium und dem gesamten
Parallelblock in die GitHub Step Summary. Damit kann später datenbasiert entschieden
werden, ob weitere Supabase-Dienste sicher entfallen können.

Playwright-Browserbinaries werden bewusst nicht über GitHub Actions gecacht. Die
Playwright-Dokumentation weist darauf hin, dass das Wiederherstellen dieses Caches
unter Linux meist ähnlich lange dauert wie der Browserdownload und die
Systemabhängigkeiten trotzdem installiert werden müssen.


## S2b – stabile Test-Interaktionen

Browser-Tests greifen in häufig veränderten Bereichen über gemeinsame
Interaktions-Helper und gezielte `data-testid`-Anker auf die Oberfläche zu.
Runtime-, Read-only- und Writing-E2E sollen Bedienpfade nicht mehrfach über
CSS-Klassen oder sichtbare Icon-Beschriftungen nachbauen.

## S2c – Testschichten, Testdatenisolation und Writing-Parallelisierung

Die schreibenden Browsertests sind ab S2c nach fachlichen Testdomänen getrennt.
Der frühere monolithische `core-writing.spec.mjs` ist auf fünf Dateien verteilt:
Stammdaten/Benutzer, Kollaboration, Katalog/Blöcke, Anmeldung und Planung.

GitHub führt diese Domänendateien mit zwei Workern aus. Innerhalb einer Domäne
bleibt die Reihenfolge seriell (`fullyParallel: false`). Lokale manuelle Läufe
verwenden weiterhin einen Worker.

Die Datei `tests/e2e-writing/helpers/scenarios.mjs` beschreibt für jede Domäne
explizit ihre veränderbaren Ressourcen. `check:writing-test-isolation` und die
Unit-Tests in `test:writing-test-isolation` verhindern, dass zwei parallel
ausführbare Domänen dieselbe schreibbare Ressource beanspruchen.

Die Testschichten werden gleichzeitig klarer getrennt:

- `smoke-test.mjs`: schnelle App-/Fachstruktur-Invarianten,
- dedizierte `check:*`-Skripte: Architektur- und Infrastrukturverträge,
- `node:test`: echte Logiktests für wiederverwendbare Prüfalgorithmen,
- Playwright Runtime/Read-only/Writing: sichtbares Browserverhalten.

Zwei reine Release-Infrastrukturprüfungen wurden deshalb aus dem allgemeinen
Smoke-Test entfernt und verbleiben ausschließlich im dedizierten
Release-Infrastruktur-/Start-Change-Test. `check:test-layering` verhindert eine
erneute Vermischung dieser Verantwortlichkeiten.


## S3a – Frontend-, CSS- und API-Skalierungsbasis

S3a verändert keine fachlichen Funktionen oder sichtbaren Seiteninhalte. Ziel ist,
die technische Basis so zu strukturieren, dass weitere Module wachsen können,
ohne globale CSS-Grenzen oder duplizierte RPC-/JSON-Basislogik weiter aufzublähen.

### CSS

Die CSS-Architektur wird ab S3a nicht mehr über starre Gesamtmengen wie
„maximal 33 CSS-Dateien“, „maximal 34 Route-Imports“ oder eine fixe
Gesamtquellgröße blockiert. Diese Werte bleiben sichtbar, sind aber reine
Beobachtungswerte.

Harte CSS-Gates bleiben dort, wo sie die tatsächliche Skalierbarkeit schützen:

- maximal drei globale CSS-Einstiegsdateien,
- global importierte CSS-Bytes,
- größte einzelne CSS-Datei,
- größter routebezogener CSS-Import,
- Anteil dateiübergreifend doppelter Selektoren,
- `!important`-Deklarationen,
- keine Zunahme featurebezogener Selektoren in `global.css`,
- keine Zunahme alter, uneinheitlicher Media-Query-Breakpoints.

Neue responsive Regeln sollen bevorzugt die bereits etablierten Breakpoints
760 px, 520 px und 390 px sowie `pointer: coarse`,
`prefers-reduced-motion`, Landscape-Sonderfall und Print verwenden.
Bestehende Legacy-Breakpoints dürfen schrittweise reduziert, aber nicht weiter
vermehrt werden.

Damit kann eine neue lazy geladene Route legitimerweise eigenes CSS erhalten,
ohne dass allein die Zahl der Dateien oder Imports einen Release blockiert.

### Gemeinsame UI-Bausteine

Wiederverwendbare UI-Bausteine dürfen nicht unnötig in einem einzelnen
Feature-Verzeichnis liegen. Die feste Editor-Aktionsleiste
`StickyEditorActions` liegt deshalb zentral unter `src/components/ui`.
`check:ui-foundation` schützt diese Zuordnung.

### Gemeinsame JSON-/Supabase-RPC-Basis

Feature-APIs dürfen grundlegende Parser und den typisierten Supabase-RPC-Aufruf
nicht jeweils neu implementieren.

Gemeinsame Basis:

- `src/lib/json-value.ts`
  - `isRecord`
  - `numberOrNull`
  - `parseStringArray`
- `src/lib/supabase-rpc.ts`
  - `callJsonRpc`
  - `callJsonRpcRawError`

Der Rohfehlermodus bleibt für bestehende Module erhalten, die Supabase-Fehler
bewusst unverändert weiterreichen. Module mit bisheriger `Error(message)`-Logik
nutzen den normalisierten Modus. Damit ändert S3a das Fehlerverhalten nicht.

`check:api-foundation` verhindert künftig lokale Kopien dieser Basisfunktionen
und direkte neue `rpc.bind`-Wrapper innerhalb der Features.

### S3-Fortsetzung

Nach produktiver Absicherung von S3a folgen getrennt:

- S3b: schrittweise CSS-Konsolidierung und Verkleinerung von `global.css`,
- S3c: gemeinsame Trainings-/Statistik-Bausteine für Kindertraining, U12 und U14,
- S3d: weitere Zerlegung großer Page-Komponenten und gemeinsame Feature-Services.

Diese Schritte erfolgen jeweils ohne fachliche Funktionsänderung und ohne
Big-Bang-Refactoring.
