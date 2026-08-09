# Master-Prompt – ULC Linz App in einem neuen Chat weiterentwickeln

Kopiere den folgenden Text in einen neuen Chat und lade anschließend die **aktuell von `ULC-AENDERUNG-STARTEN.cmd` erzeugte Git-Projekt-ZIP** hoch.

---

Du arbeitest mit mir an der **ULC Linz Oberbank Vereins-App**. Bitte antworte auf Deutsch.

Ich lade dir die aktuellste Projekt-ZIP hoch. **Diese ZIP ist die einzige Source of Truth für Code, Dateiinhalte, Commit, Branch und technischen Ist-Stand.** Verwende keine ältere Projektkopie aus Erinnerung und erfinde keine fehlenden Dateien. Lies zuerst `ULC-SOURCE-METADATA.json` und bestätige mir kurz vollständigen Commit, Git-Tree und Branch.

## Projekt und Stack

- lokaler Windows-Projektordner: `C:\ULC Linz App`
- React + Vite + TypeScript
- React Router
- Supabase PostgreSQL/Auth/Realtime/Storage/RPC
- GitHub Repository + GitHub Actions
- Vercel Produktion
- mobile-first, Hauptnutzung Smartphone
- normaler lokaler Releaseworkflow ohne Docker
- Docker/lokales Supabase nur für gezielte DB-/Writing-E2E-Arbeit, nicht als neue Pflicht für normale Updates

Die verbindliche technische Gesamtbeschreibung liegt im Repo unter:

`TECHNISCHE-GRUNDLAGE-UND-UPDATEPROZESS.md`

Lies diese Datei bei technischen Änderungen zuerst. Die historische S1–S3-Beschreibung liegt zusätzlich in `DEVELOPMENT-RELEASE.md`.

## Sehr wichtige Architekturregel: Kindertraining / U12 / U14

Kindertraining, U12 und U14 dürfen sich künftig **fachlich unterschiedlich entwickeln**.

Deshalb:

- keine gemeinsame starre Super-Seite für alle drei Module bauen,
- keine wachsenden `if (module === "u12") ...`-Kaskaden als Standardarchitektur,
- nur fachlich neutrale und tatsächlich gemeinsame Technik teilen,
- Kindertraining behält eigene Orchestrierung und Adapter,
- U12 und U14 besitzen eigene Routeneinstiege und Escape-Hatches,
- Shared-Komponenten unter `training-session` dürfen keine konkrete Trainingsgruppe, keinen Supabase-Zugriff und keine Rechteprüfung fest verdrahten,
- wenn eine Gruppe abweicht, lieber eigenen Adapter/eigene Unterkomponente für dieses Modul anlegen.

## Verbindlicher Update-/Releaseprozess

Es gibt sechs permanente CMD-Dateien im Projekt:

1. `ULC-AENDERUNG-STARTEN.cmd`
2. `ULC-UPDATE-INSTALLIEREN.cmd`
3. `ULC-LOKAL-ANSEHEN.cmd`
4. `ULC-PRUEFEN.cmd`
5. `ULC-FREIGEBEN.cmd`
6. `ULC-PRODUKTION-MARKIEREN.cmd`

**Ändere diesen bewährten Benutzerworkflow nicht ohne meine ausdrückliche Zustimmung.**

Normaler Ablauf:

1. Voriger Zyklus ist vollständig produktiv und mit `ULC-PRODUKTION-MARKIEREN.cmd` abgeschlossen.
2. Ich starte `ULC-AENDERUNG-STARTEN.cmd`.
3. Das Skript verlangt sauberen `main`, `main == origin/main` und einen passenden `production-*`-Tag.
4. Es erzeugt genau einen neuen `feature/...`-Branch.
5. Es erzeugt automatisch eine Git-basierte Projekt-ZIP per `git archive HEAD`.
6. Ich lade dir genau diese ZIP hoch.
7. Du erzeugst ein Update-ZIP.
8. Ich lege es in Windows Downloads und starte `ULC-UPDATE-INSTALLIEREN.cmd`.
9. Der Installer prüft Manifest/Git/Hashes, legt Backup-Branch an, installiert vollständige Dateien, führt die komplette Releaseprüfung aus und rollt bei Fehlern transaktional zurück.
10. Danach `ULC-LOKAL-ANSEHEN.cmd`.
11. Danach `ULC-PRUEFEN.cmd`; ein exakt passender vorhandener vollständiger Prüfnachweis darf schnell wiederverwendet werden.
12. Danach `ULC-FREIGEBEN.cmd`; erst hier Commit und Push.
13. GitHub PR, alle erforderlichen Checks grün.
14. Manuell **Squash and merge**.
15. Vercel-Produktion prüfen.
16. `ULC-PRODUKTION-MARKIEREN.cmd`: Produktionscommit muss exakt `origin/main` sein, lokaler main wird nur per Fast-Forward synchronisiert und ein annotierter `production-*`-Tag wird gepusht.
17. Erst danach nächste Änderung.

## Was du bei einem normalen Update liefern sollst

Standardmäßig **nur ein ZIP**:

`ULC-Linz-App-UPDATE-<Name>_<Datum>.zip`

Keine individuelle START-CMD.

Eine Bootstrap-/Reparatur-CMD darfst du nur vorschlagen, wenn die permanente Update-Infrastruktur selbst defekt ist, der normale Installer deshalb nicht nutzbar ist und du die Ausnahme vorher ausdrücklich mit mir abstimmst.

Das ZIP enthält mindestens:

- `manifest.json`
- `payload/...`
- `README.txt`
- `TESTERGEBNIS.txt`

Neue Pakete verwenden **Manifest v2**.

Erlaubte `packageType`-Werte sind ausschließlich:

- `module`
- `release`

Keine erfundenen anderen Typen.

## Manifest für einen normalen neuen Feature-Zyklus

Nutze:

```json
{
  "formatVersion": 2,
  "packageId": "eindeutige-id",
  "packageType": "module",
  "target": {
    "mode": "fresh-feature",
    "baseCommit": "<vollständiger 40-stelliger Commit aus der hochgeladenen ZIP>"
  },
  "files": []
}
```

Der Installer verlangt dabei:

- Feature-Branch
- HEAD exakt auf dem Basiscommit
- `origin/main` exakt auf dem Basiscommit
- Feature-Branch noch nicht remote vorhanden
- sauberen Worktree
- exakte alte Dateihashes

## Wenn ein bereits gepushter PR korrigiert werden muss

Dann **keinen zweiten Feature-Branch** erzeugen.

Nutze ein Manifest-v2-Paket mit:

```json
{
  "formatVersion": 2,
  "packageId": "pr-korrektur",
  "packageType": "module",
  "target": {
    "mode": "existing-pr",
    "expectedBranch": "<exakter bestehender feature/... Branch>",
    "expectedHead": "<exakter gepushter PR-Commit>",
    "expectedMain": "<origin/main, wenn für die Korrektur relevant>"
  },
  "files": []
}
```

Der lokale und der Remote-Feature-Commit müssen exakt zum Paket passen.

## Datei-Overlay-Regeln

Keine klassischen Textpatches. Liefere vollständige Dateien.

Manifestdateien verwenden:

- `create`
- `replace`
- `delete`

sowie SHA-256:

- alten SHA-256 für vorhandene Dateien
- neuen SHA-256 für geschriebene Dateien

Für Textdateien bevorzugt:

`"hashMode": "text-lf"`

damit Windows-CRLF/LF keine falschen Unterschiede erzeugt.

Vor Änderungen im Projekt:

- sauberen Git-Zustand respektieren
- Commit/Branch verifizieren
- alte Dateihashes verifizieren
- keine fachfremden Dateien verändern

Der Installer darf:

- prüfen
- Backup-Branch anlegen
- vollständige Dateien ersetzen/erzeugen/löschen
- bei Paketänderung von `package.json`/Lockfile `npm ci` synchronisieren
- Tests ausführen
- transaktional zurückrollen

Der Installer darf **nicht**:

- automatisch committen
- automatisch pushen
- automatisch mergen
- `git reset --hard` verwenden
- einen zweiten Feature-Branch erzeugen
- den Benutzerworkflow eigenmächtig ersetzen

## Paketprüfung vor deiner Auslieferung

Bevor du mir ein ZIP gibst:

1. Prüfe die Metadaten der hochgeladenen Git-ZIP.
2. Arbeite ausschließlich aus dieser ZIP.
3. Prüfe alle old/new SHA-256.
4. Führe die vorhandenen statischen Projektchecks aus, soweit deine Umgebung das ermöglicht.
5. Prüfe das fertige Manifest möglichst mit dem produktiven `scripts/release/install-overlay.mjs --check-only` in einem isolierten Git-Repo mit passendem `origin/main` und Feature-Branch.
6. Sage klar, welche Tests du tatsächlich ausgeführt hast.
7. Behaupte keinen erfolgreichen Build/Browserlauf, wenn deine Umgebung ihn nicht ausführen konnte. Der vollständige Releasecheck auf meinem PC und GitHub bleiben verbindliche Gates.

## Testarchitektur

Nicht Tests abschwächen, nur damit etwas grün wird.

Wichtige Ebenen:

- TypeScript
- Smoke-Tests
- dedizierte `check:*`-Architekturgates
- DB-/Migrationstests
- Runtime-Browser-Smoke
- Read-only Playwright-E2E
- Writing-E2E gegen isoliertes Supabase

Writing-E2E:

- fünf isolierte Domänen
- 2 Worker in GitHub
- `fullyParallel: false`
- 1 Worker lokal
- jede Domäne deklariert schreibbare Ressourcen
- keine Parallelisierung einführen, wenn Testdaten kollidieren

Browsertests sollen gemeinsame Helper unter `tests/helpers` und gezielte stabile `data-testid` verwenden, statt Bedienabläufe mehrfach über CSS-Klassen oder sichtbare Icon-Texte nachzubauen.

## CSS-Regeln

Global nur:

- `global.css`
- `mobile.css`
- `mobile-foundation.css`

Neue Feature-/Routenregeln bevorzugt routebezogen lazy laden.

Harte CSS-Gates nicht reflexartig erhöhen. Aktuelle Architektur schützt insbesondere:

- globale CSS-Bytes
- größte Route
- größte CSS-Datei
- Selektor-Duplikationsquote
- `!important`
- Legacy-Breakpoints
- featurebezogene Regeln in `global.css`

Gesamtzahl der CSS-Dateien/Route-Imports ist nur Beobachtungswert und kein künstliches Limit.

Wenn ein CSS-Gate erreicht wird: zuerst konsolidieren, Ownership verbessern oder Duplikate beseitigen.

## Verbindlicher UI-Control-Standard

Buttons, Eingabefelder und Editoren werden appweit aus denselben semantischen Grundvarianten aufgebaut. Feature-CSS darf normale Standardcontrols nicht neu erfinden oder deren semantische Farben zufällig überschreiben.

Verbindliche Größen:

- normaler Button und normales Formularfeld: mindestens `42px` hoch
- kompakter Button und kompaktes Formularfeld: `38px` hoch
- normaler Iconbutton: `40 x 40px`
- Control-Radius: `10px`
- Checkbox/Radio: `20 x 20px`
- mobile Schrift in Inputs/Selects/Textareas: mindestens `16px`
- Fokusdarstellung: einheitlicher grüner Fokusrahmen/-ring

Semantische Varianten:

- Speichern: `icon-button icon-button--save` – immer grüne Fläche mit weißem Diskettensymbol
- Schließen/Hilfe/Bearbeiten/Info: neutraler `icon-button`
- Löschen: `icon-button icon-button--danger` – hellrote Fläche mit rotem Löschsymbol
- feldinterne Iconaktion: `icon-button icon-button--inline`
- Tabs: gemeinsame `ui-tabs`-Darstellung nach dem Stammdateneditor-Muster
- kompakte exklusive Auswahl: `ui-segmented`
- Checkbox-/Mehrfachauswahlzeile: `ui-choice-row`, ganze Zeile anklickbar
- echter Ein/Aus-Zustand: `ui-switch`; Switches nicht für normale Mehrfachauswahl missbrauchen

Editoren:

- echte Seiteneditoren behalten die globale App-Kopfzeile sichtbar
- darunter Sticky-Editorheader mit Titel und den semantischen Aktionen Hilfe/Speichern/Schließen
- `EditorShell` bzw. `StickyEditorActions` verwenden dieselben zentralen Controlvarianten
- echte Bestätigungs-, Info- oder Importdialoge dürfen modal bleiben

Formulare:

- normal beschriftete Textfelder, Selects, Zahlen-/Datumsfelder und Textareas verwenden verbindlich `ui-labeled-field`
- Feldname steht als dauerhaft sichtbare hellgraue Kopfzeile **im selben Rahmen** wie der Eingabewert (`ui-field-label` + `ui-field-control`); verschwindende Placeholder sind kein Ersatz für Feldnamen
- Suchfelder, Checkboxen/Switches, kompakte Inline-Parameter in Tabellen sowie fachliche Spezialcontrols sind von diesem Muster bewusst ausgenommen
- Textareas verwenden dieselbe integrierte Feldkopf-Logik; kompakt und normal bleiben definierte Höhenvarianten
- Zahlenwert und Einheit sollen als zusammengehöriges Control erscheinen, wenn die Einheit fachlich feststeht
- neue normale Formularfelder dürfen nicht wieder mit frei darüberstehenden Labels und separater Control-Box eingeführt werden

Fachliche Statuscontrols wie Anwesenheit, Dokumentationsstatus, Bewertungen, Bottom-Navigation oder Dashboard-Kacheln dürfen semantisch abweichen. Größe, Fokus, Radiusfamilie und Bedienbarkeit sollen dennoch zum gemeinsamen System passen.

`scripts/check-ui-controls.mjs` ist ein hartes Architekturgate. Tests für zentrale Controls sollen zusätzlich die tatsächlich berechneten Styles prüfen, damit CSS-Spezifität semantische Varianten nicht unbemerkt überschreibt.

## API-/Supabase-Regeln

Gemeinsame Basis:

- `src/lib/json-value.ts`
- `src/lib/supabase-rpc.ts`

Keine lokalen Kopien von `isRecord`, `numberOrNull`, `parseStringArray` oder neuen ad-hoc RPC-Wrappern in Features.

Bestehendes Fehlerverhalten eines Features bei Refactorings nicht still verändern.

Datenbank:

- Änderungen als neue Migration
- produktive Migrationen nicht rückwirkend umschreiben
- RLS erhalten
- `SECURITY DEFINER` sicher halten
- generierte DB-Typen konsistent halten

Im Browser nur Supabase Publishable Key; keine Server-Secrets.

## Simulation und Sicherheit

Die Benutzer-Simulation ist schreibgeschützt und wird zusätzlich auf Supabase-Client-Ebene geschützt. Keine neue Schreibmöglichkeit darf diesen Guard umgehen.

Security Header, PWA, Backup-/Restore-Prüfungen und Hilfesystem sind bestehende harte Gates.

## Release-Prüfnachweis

Der vollständige Releasecheck schreibt:

`.git/ulc-release/verification.json`

Aktuelles Profil:

`full-release-v2`

Pflichtcheckgruppen:

- `ci:quality`
- `runtime-smoke-isolated`

`ULC-PRUEFEN.cmd` darf diesen Nachweis nur wiederverwenden, wenn Profil, Branch, HEAD und Worktree-Fingerprint exakt identisch sind. Sonst muss automatisch erneut vollständig geprüft werden.

## GitHub und Produktion

- GitHub bleibt unabhängiges zweites Gate.
- Rote Checks nicht durch Lockerung von Tests umgehen.
- PR manuell per Squash Merge.
- Danach Vercel-Produktion prüfen.
- `ULC-PRODUKTION-MARKIEREN.cmd` darf nur den tatsächlich laufenden Commit akzeptieren, wenn er exakt `origin/main` ist.
- Nur Fast-Forward, kein Hard Reset.
- Neuer Entwicklungszyklus erst nach `production-*`-Tag.

## Meine Arbeitspräferenzen

- Erklärungen und Befehle auf Deutsch.
- Keine unnötigen Alternativworkflows.
- Keine Docker-Pflicht für den normalen Workflow.
- Mobile-First.
- Kleine, sichere Pakete statt Big-Bang-Refactorings.
- Wenn ein Fehler auftritt: zuerst den **ersten echten Fehler** analysieren; nicht raten und nicht mehrere Dinge gleichzeitig ändern.
- Bei Infrastrukturproblemen nicht automatisch Sicherheitsgates umgehen.
- Wenn du eine bewährte Release-/Patchregel ändern möchtest, erkläre zuerst konkret warum und stimme es mit mir ab.

## Vorgehen ab jetzt

Wenn ich eine Aufgabe formuliere und die aktuelle Git-ZIP hochgeladen habe:

1. Lies Metadaten und betroffene Dateien.
2. Gib mir kurz deine technische Einordnung.
3. Setze die Änderung auf exakt dieser Basis um.
4. Prüfe sie so weit wie möglich.
5. Liefere das fertige Update-ZIP für `ULC-UPDATE-INSTALLIEREN.cmd`.
6. Nenne anschließend nur die normalen nächsten Schritte.
