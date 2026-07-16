# ULC Linz App V2 – Version 0.3.0

Neustart der Vereins-App mit React, TypeScript, Supabase Auth und PostgreSQL. Die alte Google-Drive-/JSON-Version dient ausschließlich als fachliche Referenz.

## Umgesetzt

### Technisches Fundament

- React, Vite und TypeScript ohne Tailwind
- Supabase Auth mit E-Mail und Passwort
- Passwort-Reset und automatische Sitzungswiederherstellung
- Verein, Profile, Rollen und Modulrechte
- Row Level Security für alle öffentlichen Tabellen
- geschützte Routen und modulabhängige Startseite
- mobile, grün dominierte Oberfläche

### Benutzerverwaltung V1

- Benutzerübersicht für Administratoren
- Benutzer über eine Supabase Edge Function einladen
- Rollen `admin`, `trainer`, `athlete` und `parent`
- Status `invited`, `active` und `disabled`
- Lese- und Bearbeitungsrechte je Modul
- Schutz des letzten aktiven Administrators
- Audit-Protokoll für Einladungen und Rechteänderungen

### Athleten und Trainingsgruppen V1

- zentrale Athletenstammdaten
- Geburtsjahr statt vollständigem Geburtsdatum zur Datenminimierung
- aktive und inaktive Athleten ohne Datenverlust
- zentrale Trainingsgruppen mit Kurzbezeichnung, Beschreibung und Sortierung
- mehrere gleichzeitige Gruppenzuordnungen pro Athlet
- historische Speicherung beendeter Gruppenzuordnungen
- Suche, Filter und Sortierung
- getrennte Lese- und Bearbeitungsrechte
- Audit-Protokoll für Änderungen
- gemeinsame Datenbasis für Kindertraining, Leistungsgruppe und Trainingsplanung

## Aktualisierung von Version 0.2.0

1. Entwicklungsserver mit `Strg + C` beenden.
2. Die Dateien des Update-Pakets in den bestehenden Projektordner kopieren.
3. Vorhandene Dateien ersetzen lassen.
4. Im Supabase SQL Editor ausschließlich die neue Migration ausführen:

```text
supabase/migrations/202607160003_athletes_and_groups.sql
```

5. App wieder starten:

```powershell
npm.cmd run dev
```

Die Abhängigkeiten haben sich nicht geändert. `npm install` ist für dieses Update nicht erforderlich.

## Neue Installation

Im Supabase SQL Editor nacheinander ausführen:

1. `202607160001_foundation.sql`
2. `202607160002_user_management.sql`
3. `202607160003_athletes_and_groups.sql`

Danach `.env.example` nach `.env.local` kopieren und die Supabase-Verbindungsdaten eintragen.

```powershell
npm.cmd install --no-audit --no-fund
npm.cmd run dev
```

## Sicherheit und Datenmodell

- Der Browser erhält ausschließlich den Supabase Publishable Key.
- Schreibvorgänge für Athleten und Gruppen laufen über kontrollierte Datenbankfunktionen.
- Row Level Security schützt lesende Zugriffe direkt in PostgreSQL.
- Nur Benutzer mit Bearbeitungsrecht im Modul `Athleten` dürfen Stammdaten verändern.
- Andere fachliche Module können die gemeinsamen Stammdaten nur lesen, wenn ihr Modul freigeschaltet wurde.
- Datensätze werden deaktiviert statt gelöscht, damit spätere Statistiken und Zuordnungen erhalten bleiben.
- Gruppenzuordnungen besitzen einen Zeitraum und werden historisch nicht überschrieben.

## Nächster Entwicklungsschritt

Als nächstes folgt das Kindertraining auf Basis der gemeinsamen Athleten- und Gruppendaten:

- Trainingstermine und regelmäßige Wochentage
- Anwesenheit
- Tagesnotizen
- Monats- und Wochenansicht
- Statistik
