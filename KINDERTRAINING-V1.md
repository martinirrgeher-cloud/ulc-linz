# Kindertraining V1

## Enthalten

- Trainingsgruppen und Teilnehmer aus Supabase
- ein Training pro Gruppe und Kalendertag
- gespeicherter Teilnehmer-Snapshot beim ersten Speichern
- Anwesenheitsstatus: offen, anwesend, entschuldigt, abwesend
- Trainingsnotiz und Absage
- Speichern, Laden und Verwerfen lokaler Änderungen
- Schutz vor unbeabsichtigtem Wechsel mit ungespeicherten Änderungen
- Konfliktschutz, wenn zwei Benutzer dasselbe Training parallel bearbeiten
- kompakte Mobile-First-Darstellung
- Lese- und Bearbeitungsrechte über das Modul `kindertraining`
- Audit-Einträge für neu angelegte und geänderte Trainings

## Datenbank

Migration:

`supabase/migrations/202607180004_kindertraining_v1.sql`

Neue Tabellen:

- `training_sessions`
- `training_attendance`

Neue Funktionen:

- `kindertraining_session_overview`
- `save_kindertraining_session`

## Bewusste Grenzen dieser Version

- Noch keine Wochen- oder Monatsübersicht
- Noch keine Statistik
- Noch keine automatisch erzeugten Serientermine
- Pro Trainingsgruppe und Kalendertag ist genau ein Training vorgesehen
