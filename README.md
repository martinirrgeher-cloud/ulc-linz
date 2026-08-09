# ULC Linz App V2 – Version 0.4.0

Mobile-First-Vereins-App des ULC Linz Oberbank auf Basis von React, TypeScript,
Supabase Auth und PostgreSQL.

## Verbindliche technische Dokumentation

Die kanonische technische Grundlage für Architektur, Tests, Patch-/Updateprozess,
Rollback, GitHub und Produktion steht in:

- `TECHNISCHE-GRUNDLAGE-UND-UPDATEPROZESS.md`
- `MASTER-PROMPT-NEUER-CHAT.md` – kopierfertige Übergabe für einen neuen Chat

Bei technischen Änderungen zuerst diese Dokumente und anschließend den aktuellen
Git-Code als Source of Truth verwenden.

## Funktionsbereiche

- Anmeldung und Anwesenheit: Kindertraining, U12, U14 und Leistungsgruppen
- Trainingsplanung pro Athlet und Trainingstag
- Trainingsplan-Wochenübersicht
- Übungskatalog und wiederverwendbare Trainingsblöcke
- Trainingsdokumentation mit Soll-Ist-Vergleich, Rückmeldung und Auswertung
- Athleten, Trainer, Gruppen, Benutzer und Modulrechte
- Excel-Import und -Export für Übungen und Athleten
- Statistiken für Kindertraining, U12 und U14
- praktische Werkzeuge unter „Nützliches“, beginnend mit dem Intervall-Countdown

Kindertraining, U12 und U14 bleiben bewusst eigenständige Fachmodule. Dadurch können
sie künftig unabhängig voneinander erweitert werden.

## Entwicklung

Voraussetzungen:

- Node.js 22.20.0 (exakt gepinnt)
- npm 10.9.x
- lokale Konfiguration auf Basis von `.env.example`

```powershell
cd "C:\ULC Linz App"
copy .env.example .env.local
npm.cmd ci
npm.cmd run dev
```

Produktions-Build:

```powershell
npm.cmd run build
```

TypeScript- und Smoke-Prüfung:

```powershell
npm.cmd run verify
```

Lokale Qualitätsprüfung ohne Docker:

```powershell
npm.cmd run test:local
```

Dieser Befehl führt die statischen Prüfungen, den Produktions-Build und die nicht
schreibenden Browsertests aus. Docker ist dafür nicht erforderlich.

Die isolierten Datenbank- und schreibenden E2E-Tests laufen weiterhin in GitHub Actions.
Sie werden lokal nur benötigt, wenn Docker Desktop bewusst installiert und gestartet wird.

Die GitHub-Aktion `.github/workflows/quality-check.yml` führt diese Prüfung bei
jedem Push und bei jedem Pull Request mit der festgelegten Node-Version aus.

Die Smoke-Tests prüfen insbesondere:

- eindeutige Modulschlüssel und Routen
- vorhandene Route für jedes konfigurierte Modul
- route-basiertes Lazy Loading
- vereinbarte Kernfunktionen des Intervall-Countdowns

## Supabase

Alle produktiv verwendeten Migrationen liegen vollständig und in Reihenfolge unter:

```text
supabase/migrations
```

Die vollständige lokale Wiederherstellung benötigt Docker Desktop:

```powershell
npm.cmd run package-a:verify
```

Das Skript startet Supabase lokal, setzt die Datenbank aus allen Migrationen neu auf,
generiert die Datenbanktypen und führt den Produktions-Build aus.

## Sicherheit

- Im Browser wird ausschließlich der Supabase Publishable Key verwendet.
- Row Level Security schützt die öffentlichen Tabellen.
- Schreibvorgänge laufen über kontrollierte Datenbankfunktionen und Modulrechte.
- Lokale Entwürfe der Trainingsdokumentation werden beim Abmelden beziehungsweise
  bei ungültigen Sitzungen bereinigt und laufen nach sieben Tagen ab.
- Ein zentraler React-Fehlerfang verhindert eine vollständig leere Seite.
- `.env.local`, ZIP-, Patch- und Sicherungsdateien werden nicht eingecheckt.

## Paket C

Paket C ergänzt:

- übersichtlichere Modulgruppen „Anmeldung“, „Trainingsdokumentation“ und „Nützliches“
- route-basiertes Lazy Loading für kleinere initiale Downloads am Handy
- Intervall-Countdown mit Belastung, Pause, Übungsanzahl und Sprachansagen
- frei wählbare Zwischenansagen für Belastung und Pause
- automatisches Einzählen der letzten fünf Sekunden
- optionale Ansage der verbleibenden Übungen
- Pause, Fortsetzen und Beenden
- Wake Lock, soweit vom Browser unterstützt
- erste automatisierte Smoke-Tests ohne zusätzliche Testbibliothek

## Performance-Lesemodelle P2a

Übungsverwendungen und historische Trainingsblock-Versionen werden nicht mehr
vollständig mit den Übersichtsseiten geladen. Details werden erst beim Öffnen
des jeweiligen Dialogs nachgeladen. Die technische Beschreibung steht in
`P2A-LESEMODELLE-PERFORMANCE.md`.

## PWA und Hilfesystem

Die App ist über `public/manifest.webmanifest` und `public/sw.js` als installierbare Progressive Web App eingerichtet. Das zentrale Handbuch liegt unter `/hilfe`; die Inhalte werden in `src/features/help/help-content.json` und die schlanken Routenzuordnungen in `src/features/help/help-route-contexts.json` gepflegt.

Bei jedem Patch mit sichtbarer oder fachlicher Änderung muss das passende Hilfethema geprüft und gegebenenfalls angepasst werden. Die verbindlichen Prüfungen laufen über:

```powershell
npm run check:help-suite
npm run check:pwa-suite
```

Details: `P2B-PWA-HILFESYSTEM.md`.

- `P2B1-LAYOUT-STATISTIKRECHTE.md`: Hilfeplatzierung, mobile Breite und integrierte Statistikrechte.

## P2c – Stammdaten Mobile-UX

Die Stammdatenverwaltung verwendet ein gemeinsames Anlagemenü, einklappbare Filter, wischbare Reiter und feste obere Editoraktionen. Details stehen in `P2C-STAMMDATEN-MOBILE-UX.md`.
