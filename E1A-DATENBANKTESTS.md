# E1a – Datenbank- und Berechtigungstests

Dieses Paket verändert keine produktiven Daten und keine sichtbare App-Funktion.

## Abgedeckte Prüfungen

- vollständiger Neuaufbau der lokalen Datenbank aus allen Migrationen
- RLS- und Rollenmatrix für Administrator, Trainer, Athlet, Elternteil und Benutzer ohne Mitgliedschaft
- tatsächliche API-Berechtigungen der aktuellen und alten Speicher-RPCs
- Bearbeitungssperren, Übernahme, Freigabe und Versionskonflikte
- idempotente und vollständig rückrollbare Datenimporte
- Abbruch eines Imports bei aktiver Bearbeitungssperre
- Vorhandensein der benötigten Storage-Buckets

## Lokal ausführen

Voraussetzung: Docker Desktop läuft.

```powershell
Set-Location "C:\ULC Linz App"
npm.cmd run test:database
```

Die lokale Supabase-Umgebung wird automatisch gestartet, vollständig neu aufgebaut,
getestet und danach wieder entfernt.

Zum Offenlassen der lokalen Umgebung:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-database-tests.ps1 -KeepRunning
```

## GitHub Actions

Der Workflow `.github/workflows/database-tests.yml` läuft bei Änderungen an
Migrationen, Datenbanktests oder der Datenbank-Testkonfiguration. Er verwendet
eine isolierte lokale Supabase-Instanz im GitHub-Runner und greift nicht auf die
Produktivdatenbank zu.
