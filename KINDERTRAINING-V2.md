# Kindertraining V2

## Fachliche Änderungen

- Das Modul Kindertraining ist fest genau einer Trainingsgruppe zugeordnet.
- Die Gruppenauswahl im Kindertraining entfällt.
- Regelmäßige Trainingstage werden in der Trainingsgruppenverwaltung eingestellt.
- Die Datumsnavigation springt nur zwischen regulären Trainingstagen und bereits gespeicherten Sondertrainings.
- Optional kann ein einzelner Sondertrainingstag geöffnet und gespeichert werden.
- Anwesenheit wird in vier Kategorien erfasst: Offen, Da, Entschuldigt und Fehlt.
- Nach der Auswahl wechselt das Kind sofort in die entsprechende Kategorie.
- In jeder Kategorie kann der Status geändert oder auf Offen zurückgesetzt werden.
- Sortierung nach Vorname oder Nachname; die Auswahl wird lokal gespeichert.
- Kinder können direkt im Kindertraining mit Vorname, Nachname und Jahrgang angelegt werden.
- Neue Kinder werden automatisch aktiviert und der Kindertrainingsgruppe zugeordnet.
- Exakte Dubletten werden erkannt und können nach Bestätigung der Gruppe zugeordnet werden.

## Datenbank

Migration: `supabase/migrations/202607180005_kindertraining_v2.sql`

Die Migration ergänzt bestehende Tabellen und Funktionen. Bestehende Anwesenheitsdaten und Trainingstermine bleiben erhalten.

## Ersteinrichtung nach der Migration

1. Modul `Athleten` öffnen.
2. Register `Trainingsgruppen` auswählen.
3. Gewünschte Gruppe bearbeiten.
4. Regelmäßige Wochentage auswählen.
5. `Diese Gruppe im Modul Kindertraining verwenden` aktivieren.
6. Optional `Sondertrainingstage erlauben` aktivieren.
7. Speichern.
