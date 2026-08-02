# E1b.2 - Schreibende End-to-End-Tests

## Ziel

Die wichtigsten schreibenden App-Abläufe werden mit künstlichen Benutzern und Daten gegen eine vollständig isolierte lokale Supabase-Umgebung getestet. Das produktive Supabase-Projekt und echte Vereinsdaten werden nicht verwendet.

## Testumgebung

- Supabase CLI 2.109.1
- Datenbank, Auth, Storage und Realtime lokal in Docker
- vollständiger Neuaufbau aus allen Repository-Migrationen
- vier künstliche Rollen: Administrator, Trainer, Athlet und Elternteil
- Chromium auf 390 x 844 Pixel
- ein einzelner Playwright-Worker; unabhängige Tests laufen auch nach einem Einzelfehler weiter

## Aktuelle Tests

1. Administrator legt Gruppe, Athlet und Trainer an und prüft die Persistenz nach einem Reload.
2. Eine zweite Trainersitzung wird bei einer bereits geöffneten Gruppe und einem bereits geöffneten Trainer sofort schreibgeschützt.
3. Administrator legt eine Übung und einen Trainingsblock an.
4. Athlet speichert die eigene Trainingsanmeldung und prüft sie nach einem Reload.
5. Administrator speichert einen Trainingsplan; eine zweite Trainersitzung wird durch den Bearbeitungsschutz blockiert.

## Sicherheit

- keine GitHub-Secrets
- keine URL eines gehosteten Supabase-Projekts
- keine produktiven Benutzer oder Daten
- Datenbank wird vor jedem Lauf neu aufgebaut
- Testumgebung wird nach jedem Lauf entfernt
- Screenshots, Videos, Traces und HTML-Bericht werden nur als GitHub-Artefakte gespeichert

## Lokaler Start

Docker Desktop muss laufen.

```powershell
npm.cmd run test:e2e:writing
```

Die lokale Supabase-Umgebung wird automatisch gestartet, neu aufgebaut, getestet und anschließend entfernt.
