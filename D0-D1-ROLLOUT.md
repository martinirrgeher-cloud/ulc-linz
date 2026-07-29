# Rollout D0/D1 – ULC-Linz-App

## Inhalt

- D0: festgelegte Node-/npm-Version, `.env.example`, GitHub-Qualitätsprüfung und Migrationscheck
- D1: atomare Bearbeitungssperre für Übungen, Trainingsblöcke, Athleten und Trainingspläne
- Datenimport: bestehende Übungen und Athleten werden vor der Aktualisierung reserviert

Es wurden keine CSS-Dateien und keine Mobile-Layouts verändert.

## Sichere Reihenfolge

### 1. Ausgangsstand sichern

- aktuellen Git-Stand committen und taggen
- Google-Drive-Backup manuell auslösen
- produktiven Buildstand nicht überschreiben, bevor Schritt 4 erfolgreich war

### 2. SQL 1 ausführen

Datei:

```text
SQL-1_202607290025_atomic_edit_lock_writes.sql
```

Diese SQL-Datei ergänzt die neuen RPCs. Die bisherigen RPCs bleiben vorerst ausführbar, damit der aktuell produktive Frontendstand während des Rollouts weiter funktioniert.

### 3. PowerShell-Patch anwenden

Patch-Verzeichnis neben dem Projekt entpacken und in PowerShell ausführen:

```powershell
cd "C:\ULC Linz App"
& "C:\Pfad\zum\ULC-Linz-D0-D1-Patch_2026-07-29\apply-patch.ps1" -ProjectRoot "C:\ULC Linz App"
```

Das Skript sichert jede ersetzte Datei unter:

```text
_patch_backup\D0-D1_<Zeitstempel>
```

### 4. Lokal prüfen

```powershell
cd "C:\ULC Linz App"
npm.cmd ci
npm.cmd run ci:quality
```

Erst bei erfolgreichem Build weitergehen.

### 5. Frontend bereitstellen und testen

Mindestens prüfen:

1. Übung bearbeiten und speichern
2. Trainingsblock bearbeiten und speichern
3. Athlet bearbeiten und speichern
4. bestehenden Trainingsplan bearbeiten, speichern und erneut speichern
5. Neuanlagen in allen vier Bereichen
6. Import einer neuen Übung und eines neuen Athleten
7. Import-Update eines bestehenden Datensatzes
8. Zwei-Benutzer-Test: Übernahme einer Sperre muss den alten Speicheraufruf ablehnen

### 6. SQL 2 erst nach erfolgreichem Frontendtest ausführen

Datei:

```text
SQL-2_202607290026_disable_legacy_unlocked_writes.sql
```

Diese Datei entzieht den alten, nicht atomar geschützten Änderungs-RPCs das Ausführungsrecht. Sie darf nicht vor der produktiven Bereitstellung des neuen Frontends ausgeführt werden.

### 7. Abschlusstest

Die Prüfungen aus Schritt 5 erneut durchführen. Zusätzlich kontrollieren, dass alte direkte RPC-Aufrufe mit fehlender Berechtigung abgelehnt werden.

## Rückfall

Vor SQL 2 kann das Frontend auf den vorherigen Git-/Vercel-Stand zurückgesetzt werden, weil die bisherigen RPCs noch verfügbar sind.

Nach SQL 2 müssen bei einem Frontend-Rollback die vier alten EXECUTE-Rechte bewusst wieder erteilt werden. Deshalb SQL 2 erst nach vollständiger Abnahme ausführen.
