# Trainingsblöcke V1

Trainingsblöcke bündeln Übungen aus dem Übungskatalog zu wiederverwendbaren Folgen. Ohne Gruppenzuordnung sind sie vereinsweit verfügbar; optional können sie einer oder mehreren Leistungsgruppen zugeordnet werden.

## Enthalten

- Block anlegen, bearbeiten, duplizieren und deaktivieren
- Übungen aus dem Katalog mehrfach hinzufügen
- Reihenfolge mit robusten Auf-/Ab-Schaltflächen ändern
- Standardparameter pro Block überschreiben
- Zusatzhinweis pro Übung
- optionale Zuordnung zu Leistungsgruppen
- Suche sowie Gruppen- und Aktivfilter
- Nur-Lese-Ansicht ohne Bearbeitungsrecht
- mobile Vollbildbearbeitung

## Migration

`supabase/migrations/202607220015_training_blocks_v1.sql`

Neue Tabellen: `training_blocks`, `training_block_group_assignments`, `training_block_items`.

Noch nicht enthalten sind die Zuordnung zu konkreten Trainingstagen, individuelle Athletenpläne, Soll-Ist-Dokumentation und Belastungsstatistik.
