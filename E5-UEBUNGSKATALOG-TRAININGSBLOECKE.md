# E5a/E5b – Übungskatalog und Trainingsblöcke

## Ziel

Übungen und Trainingsblöcke werden vor dem späteren Datenimport um Qualitäts-,
Verwendungs- und Varianteninformationen erweitert. Bestehende Trainingspläne
bleiben durch ihre bereits vorhandenen Snapshots unverändert.

## Übungskatalog

- Schwierigkeitsgrad als organisationsbezogene Auswahlliste
- bidirektionale Verknüpfung ähnlicher Übungen
- lokale Sofortwarnung und serverseitiger Schutz vor normalisierten Dubletten
- Archivansicht für inaktive Übungen
- Verwendungsübersicht für Trainingsblöcke und Trainingspläne
- letzte Verwendung einer Übung

## Trainingsblöcke

- neue Variante mit nachvollziehbarer Herkunft und Variantennummer
- unveränderliche Version-Snapshots nach jedem Speichern
- persönliche Favoriten pro Benutzer
- letzte Verwendung und tatsächlich verwendete Trainingsgruppen
- direkter Vergleich zweier Blöcke
- Warnung vor inaktiven Übungen in Übersicht und Editor

## Mehrbenutzerbetrieb

Die vorhandenen E4-Sperren, Versionsprüfungen und Realtime-Aktualisierungen
bleiben erhalten. Favoriten werden ebenfalls über Realtime aktualisiert.

## Rollout

1. SQL-Migration `202608020033_catalog_block_intelligence.sql` ausführen.
2. App-Patch in einem Prüfbranch anwenden.
3. Qualitäts-, Datenbank- und E2E-Workflows abwarten.
4. Vercel-Preview mit zwei Geräten testen.
5. Erst danach nach `main` mergen.
