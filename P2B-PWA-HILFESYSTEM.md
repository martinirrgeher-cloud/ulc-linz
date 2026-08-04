# P2b – PWA und Hilfesystem

## Ziel

Die ULC-Linz-App ist als Progressive Web App installierbar, startet vom Hauptbildschirm im Standalone-Modus und verwendet das Vereinslogo als App-Symbol. Zusätzlich gibt es ein zentrales Handbuch mit Kapiteln, Unterkapiteln, Suche und kontextbezogenen Hilfezugängen.

## Installation

### Android

1. App in Chrome öffnen.
2. Browsermenü öffnen.
3. „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.
4. Installation bestätigen.

### iPhone und iPad

1. App in Safari öffnen.
2. Teilen-Menü öffnen.
3. „Zum Home-Bildschirm“ wählen.
4. Hinzufügen bestätigen.

Ein bereits vorhandener grauer oder alter Shortcut muss entfernt und nach dem Deployment neu angelegt werden.

## PWA-Sicherheitsgrenze

Der Service Worker dient nur der installierten App-Hülle und greift nicht in Netzwerkaufrufe ein. Er legt keine eigenen Offline-Caches an und entfernt gegebenenfalls alte PWA-Caches früherer Versionen.

Nicht verarbeitet oder gespeichert werden:

- Supabase-Requests
- Authentifizierungsdaten
- Tokens
- personenbezogene Daten
- statische App-Bundles oder Navigationen
- schreibende Requests

Die Vereinsfunktionen bleiben bewusst onlinegebunden. Dadurch entstehen keine veralteten App-Dateien oder scheinbar verfügbare Offline-Daten.

## Hilfesystem

Zentrale Datenquelle:

```text
src/features/help/help-content.json
```

Routenbezogene Hilfekontexte:

```text
src/features/help/help-route-contexts.json
```

Die kleine Kontextlogik (`help-context.ts`) wird bereits mit dem App-Layout geladen. Die vollständigen Handbuchinhalte (`help.ts` und `help-content.json`) bleiben im Lazy-Chunk der Hilfeseite und vergrößern deshalb nicht unnötig den Start-Download.

Routen:

```text
/hilfe
/hilfe/:topicId
```

## Pflicht bei jedem Patch

Bei jeder fachlichen Änderung muss vor der Übergabe geprüft werden:

1. Ändert sich die Bedienung einer Seite?
2. Entsteht ein neuer Button, Filter, Status, Dialog oder Ablauf?
3. Wird eine Rolle, Berechtigung oder Verknüpfung verändert?
4. Wird eine Route oder ein Modul ergänzt?
5. Ändert sich Installation, Offline-Verhalten oder Fehlerbehebung?

Wenn mindestens eine Frage mit Ja beantwortet wird, müssen das passende Hilfethema und gegebenenfalls der Hilfekontext aktualisiert werden.

Verpflichtende Prüfung:

```powershell
npm run check:help-suite
npm run check:pwa-suite
```

`npm run ci:quality` führt beide Prüfungen automatisch aus.

## Hilfekontext pflegen

Jede konkrete App-Route braucht in `help-route-contexts.json` einen Eintrag. Längere und speziellere Routen werden vor allgemeinen Präfixen ausgewertet.

Beispiel:

```json
{
  "path": "/module/exercise_catalog",
  "topicId": "exercise-catalog",
  "sectionId": "videos"
}
```

Der Abschnitt ist optional. Das Fragezeichen neben der Seitenüberschrift verwendet diese Zuordnung.

## Manuelle PWA-Prüfung

- Vereinslogo auf Android-Hauptbildschirm
- Vereinslogo auf iPhone/iPad-Hauptbildschirm
- Start ohne normale Browser-Adresszeile
- direkter Start auf `/`
- neue Version nach vollständigem Schließen und erneutem Öffnen
- keine eigenen App- oder Supabase-Caches im Service Worker

## Manuelle Hilfeprüfung

- Handbuch von der Modulübersicht öffnen
- Handbuch aus dem Benutzermenü öffnen
- Fragezeichen neben der Seitenüberschrift auf mindestens fünf unterschiedlichen Seiten prüfen
- Suche mit „Einladung“, „Sondertraining“, „Video“ und „Import“ testen
- direkte Unterkapitel-Links und Zurück-zur-Seite-Funktion prüfen
- Smartphonebreiten 360, 390 und 430 Pixel sowie Desktop prüfen
