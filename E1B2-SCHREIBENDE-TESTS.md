# E1b.2 - Schreibende End-to-End-Tests

## Ziel

Die wichtigsten schreibenden App-Abläufe werden mit künstlichen Benutzern und Daten gegen eine vollständig isolierte lokale Supabase-Umgebung getestet. Das produktive Supabase-Projekt und echte Vereinsdaten werden nicht verwendet.

## Testumgebung

- Supabase CLI 2.109.1
- Datenbank, Auth, Storage und Realtime lokal in Docker
- vollständiger Aufbau aus allen Repository-Migrationen
- vier künstliche Rollen: Administrator, Trainer, Athlet und Elternteil
- Chromium auf 390 x 844 Pixel
- ein einzelner Playwright-Worker; unabhängige Tests laufen auch nach einem Einzelfehler weiter
- Browsercache in GitHub Actions, damit Chromium nicht bei jedem Lauf neu geladen werden muss

## Aktuelle Tests

1. Administrator legt Gruppe, Athlet und Trainer an und prüft die Persistenz nach einem Reload.
2. Eine zweite Trainersitzung wird bei einer bereits geöffneten Gruppe und einem bereits geöffneten Trainer sofort schreibgeschützt.
3. Realtime aktualisiert eine zweite Sitzung und bewahrt einen lokalen Konfliktentwurf. Dieser Diagnosefall ist wegen der derzeit instabilen lokalen Supabase-Realtime-Zustellung vorlaeufig nicht verpflichtend und wird nur mit `E2E_REALTIME_DIAGNOSTIC=true` ausgefuehrt.
4. Administrator legt eine Übung und einen Trainingsblock an.
5. Athlet speichert die eigene Trainingsanmeldung und prüft sie nach einem Reload.
6. Administrator speichert einen Trainingsplan; eine zweite Trainersitzung wird durch den Bearbeitungsschutz blockiert.

Die Benutzerverwaltungsprüfung umfasst dabei auch die Eltern-Mehrfachauswahl für verknüpfte Athleten.

## Sicherheit

- keine GitHub-Secrets
- keine URL eines gehosteten Supabase-Projekts
- keine produktiven Benutzer oder Daten
- GitHub baut die frische Testdatenbank durch `supabase start` aus allen Migrationen auf
- kein zweiter Datenbank-Reset nach dem Start von Realtime
- Testumgebung wird nach jedem Lauf entfernt
- Screenshots, Videos, Traces und HTML-Bericht werden nur als GitHub-Artefakte gespeichert

## Lokaler Start

Docker Desktop muss laufen.

```powershell
npm.cmd run test:e2e:writing
```

Der lokale PowerShell-Runner startet Supabase, baut die Datenbank für einen deterministischen Lauf neu auf, testet und entfernt die Umgebung anschließend.
## Vorlaeufig ausgesetzte Realtime-Diagnose

Der Zwei-Sitzungs-Realtime-Test bleibt im Repository erhalten, blockiert die regulaeren Pull-Request-Pruefungen aber vorlaeufig nicht. Die uebrigen fuenf schreibenden E2E-Tests bleiben verpflichtend.

Der Diagnosefall kann in einer Umgebung mit Docker und lokaler Supabase gezielt aktiviert werden:

```powershell
$env:E2E_REALTIME_DIAGNOSTIC = "true"
npm.cmd run test:e2e:writing
Remove-Item Env:E2E_REALTIME_DIAGNOSTIC -ErrorAction SilentlyContinue
```

Offener Punkt: E4 Realtime-CI mit lokaler Supabase stabilisieren und den Test danach wieder verpflichtend aktivieren.

