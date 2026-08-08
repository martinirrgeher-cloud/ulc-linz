# ULC Linz App – Entwicklungs- und Releaseablauf S0

Stand: 2026-08-06

## Ziel

Neue Änderungen dürfen nur von einem bekannten stabilen Produktionsstand ausgehen. Kein Paket darf einen gemischten oder nur teilweise geänderten Projektstand hinterlassen. Ein erfolgreicher TypeScript-/Vite-Build allein gilt nicht als Freigabe: Vor jedem Push muss die gebaute Anwendung zusätzlich in einem echten Chromium-Browser gestartet werden.

## Drei einfache Routinen

### 1. Änderung starten

`ULC-AENDERUNG-STARTEN.cmd` doppelklicken.

Das Skript verlangt ein sauberes Arbeitsverzeichnis, aktualisiert `origin/main` und erstellt einen neuen `feature/...`-Branch direkt von `origin/main`. `main` selbst wird nicht bearbeitet.

Unter Windows wird danach automatisch eine aktuelle Projekt-ZIP auf dem Desktop erzeugt. Damit ist der neue Arbeitsstand ohne zusätzlichen PowerShell-Befehl direkt zum Hochladen bereit.

**Verbindlicher Ablauf für von ChatGPT erzeugte Overlay-Pakete:** Zwingend zuerst `ULC-AENDERUNG-STARTEN.cmd` ausführen. Dadurch entsteht genau ein sauberer `feature/...`-Branch direkt vom aktuellen `origin/main` und automatisch die Projekt-ZIP auf dem Desktop. Die erzeugte Projekt-ZIP wird hochgeladen; ZIP und zugehörige START-CMD des späteren Overlays bleiben im Download-Ordner. Der Overlay-Installer verwendet ausschließlich diesen vorbereiteten Feature-Branch und erzeugt niemals selbst einen zweiten Arbeitsbranch.

### 2. Änderung prüfen

`ULC-PRUEFEN.cmd` doppelklicken.

Dabei laufen:

1. TypeScript-Prüfung
2. Smoke-Tests
3. Migrationen und generierte Datenbanktypen
4. Strukturprüfungen der E2E-Suites
5. Sicherheits-, Backup-, Katalog-, Hilfe-, PWA- und CSS-Prüfungen
6. Produktions-Build
7. Performance-Budget
8. echter Chromium-Runtime-Test auf Login, Dashboard und Stammdatenmodul
9. Überwachung von `pageerror`, `console.error` und React Error Boundary

Nach Erfolg wird in `.git/ulc-release/verification.json` ein Fingerabdruck des exakt geprüften Arbeitsstandes gespeichert. Diese Datei wird nicht committed.

### 3. Geprüften Stand freigeben

`ULC-FREIGEBEN.cmd` doppelklicken.

Das Skript prüft, dass:

- kein Mergekonflikt besteht,
- nicht direkt auf `main` gearbeitet wird,
- seit `ULC-PRUEFEN.cmd` keine Datei verändert wurde.

Erst danach und nur nach Eingabe von `JA` werden Commit und Push erstellt. Der Pull-Request-Merge bleibt manuell.

## Produktionsstand markieren

Nach einem erfolgreich geprüften Vercel-Produktionsdeployment wird `ULC-PRODUKTION-MARKIEREN.cmd` verwendet. Der Commit aus der Vercel-Diagnose muss mit dem aktuellen `origin/main` übereinstimmen. Danach synchronisiert die Routine den lokalen PC ausschließlich per Fast-Forward auf diesen `main`, erzeugt den Git-Tag `production-...` und pusht ihn. Ein harter Reset ist ausdrücklich nicht Bestandteil dieser Routine.

Damit endet jeder Release-Zyklus lokal wieder auf einem sauberen, aktuellen `main`. Der vorherige Feature-Branch bleibt zunächst als Sicherheitsreferenz erhalten. So existiert für jeden bestätigten Produktionsstand ein eindeutiger Wiederherstellungspunkt und die nächste Änderung beginnt nicht versehentlich auf einem alten Feature-Branch.

## Overlay-Pakete

Künftige Änderungen werden nicht als klassischer Textpatch ausgeliefert, sondern als vollständige Dateien in einer ZIP.

```text
ULC-Px-Name.zip
├─ manifest.json
└─ payload/
   └─ ... vollständige geänderte Dateien
```

Manifestformat:

```json
{
  "formatVersion": 1,
  "packageId": "p3-training-planning",
  "packageType": "module",
  "baseCommit": "vollständiger Git-Commit",
  "files": [
    {
      "path": "src/features/training-planning/TrainingPlanEditor.tsx",
      "mode": "replace",
      "oldSha256": "...",
      "newSha256": "..."
    }
  ]
}
```

Der Installer `scripts/release/install-overlay.mjs` kennt nur sichere Zustände:

- alter Dateihash stimmt: Installation erlaubt,
- alle neuen Dateihashes sind bereits vorhanden: Paket gilt als bereits installiert,
- gemischter/unbekannter Stand: Abbruch ohne Installation.

Der Installer verwendet zwingend den bereits durch `ULC-AENDERUNG-STARTEN.cmd` erzeugten sauberen `feature/...`-Branch. Dessen HEAD muss exakt der Paketbasis entsprechen. Der Installer erzeugt niemals selbst einen zweiten Feature-Branch. Vor der Installation wird immer ein eindeutiger lokaler Backup-Branch erzeugt.

Danach übernimmt der Installer alle Dateien vollständig und startet automatisch die Release-Prüfung. Bei einem Fehler wird der verwendete Feature-Branch vollständig auf den Ausgangscommit zurückgesetzt; ein vom Installer zusätzlich erzeugter Branch wird anschließend wieder entfernt. Commit, Push und Merge erfolgen niemals automatisch durch den Installer.

## Modulpaket und Releasepaket

### Modulpaket

Für fachliche Änderungen innerhalb eines abgegrenzten Moduls. Modulpakete dürfen geschützte Infrastrukturdateien nicht verändern.

### Releasepaket

Erforderlich für Änderungen an unter anderem:

- `.github/`
- `src/app/`
- globalem Layout
- Authentifizierung
- globalen Styles
- Supabase/Migrationen
- `package.json` / `package-lock.json`
- Vite-, Playwright- und Vercel-Konfiguration
- Release-Infrastruktur

Damit wird verhindert, dass eine normale UI-Optimierung nebenbei zentrale App-Infrastruktur verändert.

## GitHub-Gate

Der Workflow `quality-check.yml` führt auf jedem Pull Request zusätzlich einen echten Chromium-Runtime-Test aus. Ein Build, der beim ersten React-Render abstürzt, kann dadurch nicht mehr mit einer grünen Qualitätsprüfung durchlaufen.

Die umfangreicheren read-only und schreibenden E2E-Workflows bleiben zusätzlich bestehen.

## Architekturregel für weiteres Wachstum

Neue fachliche Logik soll möglichst innerhalb von `src/features/<modul>` bleiben. Gemeinsame Router-, Layout-, Auth-, globale Style- und Supabase-Basisdateien gelten als Infrastruktur und werden nur bewusst in Releasepaketen verändert.

Bestehende große Bereiche werden nicht in einem riskanten Komplettumbau zerlegt. Sie werden jeweils beim nächsten fachlichen Eingriff schrittweise in klarere Modulgrenzen überführt.

## Isolierter Runtime-Build

Der echte Browser-Test baut die App mit einer deterministischen E2E-Supabase-Konfiguration in `.ulc-runtime-dist`. Der normale Produktions-Build in `dist` wird nicht wiederverwendet und nicht ueberschrieben. Dadurch koennen lokale `.env`-Werte die Authentifizierungs-Mocks nicht beeinflussen. Ein bereits laufender Testserver wird bewusst nicht wiederverwendet.

## S0.1 – robuste Freigabe bereits committeter Stände

`ULC-FREIGEBEN.cmd` unterstützt drei geprüfte Zustände:

1. **Uncommittierte Änderungen vorhanden:** Der exakt geprüfte Arbeitsstand wird nach Bestätigung committed und gepusht.
2. **Arbeitsbaum sauber, Commit noch nicht gepusht:** Nach einer erneuten `ULC-PRUEFEN.cmd`-Prüfung wird der bereits vorhandene Commit nach Bestätigung gepusht.
3. **Arbeitsbaum sauber, Commit bereits gepusht:** Der Zustand wird als erfolgreich freigegeben erkannt; es wird nichts erneut committed oder gepusht.

Ein Commit, der nach der letzten Prüfung erzeugt wurde, muss immer nochmals mit `ULC-PRUEFEN.cmd` geprüft werden. Der Fingerabdruck enthält den aktuellen HEAD-Commit und verhindert dadurch die Freigabe eines nachträglich veränderten Stands.
