# P2a – Schlanke Lesemodelle und gebündelte Aktualisierung

## Ziel

Die Übersichten des Übungskatalogs und der Trainingsblöcke sollen mit wachsendem
Datenbestand nicht bei jedem Öffnen alle Verwendungs- und Versionsdetails laden.

## Umsetzung

- `exercise_catalog_overview_v4` liefert je Übung nur noch die Anzahl der
  Block- und Planverwendungen.
- `exercise_usage_overview` lädt die konkreten Verwendungen erst beim Öffnen des
  Verwendungsdialogs.
- `training_block_overview_v4` liefert je Block nur Versionsanzahl und letzte
  Version, jedoch keine historischen Snapshots.
- `training_block_versions_overview` lädt den vollständigen Versionsverlauf erst
  beim Aufklappen.
- Realtime-bedingte Reloads im Übungskatalog und in den Trainingsblöcken werden
  gebündelt. Während einer laufenden Abfrage wird höchstens ein weiterer Reload
  vorgemerkt.

Die bestehenden Speicher-RPCs, Bearbeitungssperren, Konfliktbehandlung und
historischen Daten bleiben unverändert.

## Rollout

1. Migration `202608030036_catalog_block_read_models.sql` ausführen.
2. App-Patch einspielen.
3. `npm run test:local` ausführen.
4. Pull Request und Vercel-Preview prüfen.

## Manuelle Prüfung

- Übungskatalog öffnen: Zähler müssen sofort sichtbar sein.
- Verwendungsdialog öffnen: konkrete Blöcke und Pläne werden erst dann geladen.
- Trainingsblöcke öffnen: Versionsanzahl muss sofort sichtbar sein.
- Versionsverlauf aufklappen: historische Versionen werden erst dann geladen.
- Mehrere Änderungen auf einem zweiten Gerät auslösen: Die Übersichten dürfen
  nicht mehrfach sichtbar neu laden.
