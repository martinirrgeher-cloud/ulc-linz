# ULC Linz App V2 – Version 0.4.0

Mobile-First-Vereins-App des ULC Linz Oberbank auf Basis von React, TypeScript,
Supabase Auth und PostgreSQL.

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

- Node.js 22.16.0 (mindestens 22.12, kleiner als 23)
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

Vollständige lokale Qualitätsprüfung wie in GitHub Actions:

```powershell
npm.cmd run ci:quality
```

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
