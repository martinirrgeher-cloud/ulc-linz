# P2c – Stammdaten Mobile-UX

## Ziel

Athleten, Trainer und Gruppen erhalten eine einheitliche, platzsparende und smartphonegerechte Bedienung.

## Umsetzung

- Eine gemeinsame „Neu“-Schaltfläche öffnet die Auswahl Athlet, Gruppe oder Trainer.
- Die drei Stammdatenreiter können angetippt oder durch horizontales Wischen gewechselt werden.
- Suche und Filter sind für alle drei Bereiche einheitlich aufgebaut.
- Filter lassen sich ein- und ausklappen und gesammelt zurücksetzen.
- Gruppen können zusätzlich nach Trainingsmodul und Gruppentyp gefiltert werden.
- Trainer können nach Trainingsgruppe gefiltert werden.
- Fokussierte Eingabefelder werden auf kleinen Bildschirmen oberhalb der Bildschirmtastatur positioniert.
- Athleten-, Trainer- und Gruppeneditoren verwenden eine feste obere Aktionsleiste mit Hilfe, Speichern und Schließen.
- Untere Speichern-/Abbrechen-Schaltflächen entfallen.
- Ungespeicherte Änderungen werden beim Schließen oder Verlassen nicht kommentarlos verworfen.
- Alle drei Editoren verwenden drei logisch gegliederte, wischbare Bereiche.

## Technische Grenzen

- Wischgesten wechseln nur bei klar horizontaler Bewegung.
- Gesten, die auf Eingaben, Links oder Schaltflächen beginnen, werden ignoriert.
- Es wurden keine Datenbank-, RPC-, Edge-Function- oder globalen CSS-Dateien geändert.
- Die Styles liegen ausschließlich in der routebezogenen Datei `src/styles/management.css`.
