# E2 – Bearbeitungsschutz für Trainer und Gruppen

## Ziel

Trainer- und Gruppenstammdaten verwenden denselben atomaren Bearbeitungsschutz wie
Athleten, Übungen, Trainingsblöcke und Trainingspläne.

## Schutzmechanismen

- aktive Bearbeitungsreservierung mit Besitzeranzeige
- Heartbeat und automatische Freigabe nach Ablauf
- bewusste Übernahme durch Administratoren
- Sperrprüfung und Versionsvergleich in derselben Datenbanktransaktion
- schreibgeschützte Editoren für eine zweite Sitzung
- alte ungesperrte V3-Schreibfunktionen werden nach dem Rollout deaktiviert

## Rollout

1. SQL 1 im produktiven Supabase-Projekt ausführen.
2. Frontend-Patch einspielen, prüfen und veröffentlichen.
3. Zwei-Geräte-Test für eine Gruppe und einen Trainer durchführen.
4. Erst danach SQL 2 ausführen.

Die Repository-Migration enthält bereits den vollständigen Endzustand inklusive
Deaktivierung der alten V3-RPCs. Lokale und GitHub-Testdatenbanken werden daher
direkt im finalen Zustand aufgebaut.
