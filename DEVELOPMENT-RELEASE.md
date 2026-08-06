# ULC Linz App – Entwicklungs- und Releaseablauf S0

Stand: 2026-08-06

## Ziel

Neue Änderungen dürfen nur von einem bekannten stabilen Produktionsstand ausgehen. Kein Paket darf einen gemischten oder nur teilweise geänderten Projektstand hinterlassen. Ein erfolgreicher TypeScript-/Vite-Build allein gilt nicht als Freigabe: Vor jedem Push muss die gebaute Anwendung zusätzlich in einem echten Chromium-Browser gestartet werden.

## Drei einfache Routinen

### 1. Änderung starten

`ULC-AENDERUNG-STARTEN.cmd` doppelklicken.

Das Skript verlangt ein sauberes Arbeitsverzeichnis, aktualisiert `origin/main` und erstellt einen neuen `feature/...`-Branch direkt von `origin/main`. `main` selbst wird nicht bearbeitet.

Bei normalen Overlay-Paketen übernimmt der Paketstarter diesen Schritt automatisch.

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

Nach einem erfolgreich geprüften Vercel-Produktionsdeployment kann `ULC-PRODUKTION-MARKIEREN.cmd` verwendet werden. Der Commit aus der Vercel-Diagnose muss mit dem aktuellen `origin/main` übereinstimmen. Danach wird ein Git-Tag `production-...` erzeugt und gepusht.

So existiert für jeden bestätigten Produktionsstand ein eindeutiger Wiederherstellungspunkt.

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

Der Installer erstellt einen Feature-Branch, übernimmt alle Dateien vollständig und startet danach automatisch die Release-Prüfung. Bei einem Fehler setzt er den begonnenen Feature-Branch auf den Ausgangscommit zurück und wechselt auf den ursprünglichen Branch zurück. Commit, Push und Merge erfolgen niemals automatisch durch den Installer.

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
