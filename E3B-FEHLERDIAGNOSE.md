# E3b – Fehlerdiagnose und Supportinformationen

## Ziel

Technische Fehler erhalten eine eindeutige Fehler-ID. Supportinformationen können
direkt aus der App kopiert werden, ohne Namen, E-Mail-Adressen, Trainingsinhalte
oder Zugangsdaten zu übertragen.

## Enthalten

- zentrale Einordnung von Netzwerk-, Anmelde-, Berechtigungs-, Konflikt-, Upload-
  und Datenbankfehlern
- eindeutige Fehler-ID mit Zeitstempel und Zufallsanteil
- maximal acht datensparsame Diagnoseeinträge je Browsersitzung
- globale Erfassung unbehandelter Browser- und Promise-Fehler
- App-Version, Git-Commit und Build-Zeit im Build
- kopierbare Supportinformationen im Benutzermenü, auf der Verbindungsseite und
  im zentralen Fehlerbildschirm
- keine serverseitige Protokollierung und keine neue Datenbanktabelle

## Datenschutz

Der Rohtext technischer Fehlermeldungen wird nicht gespeichert. Stattdessen bleiben
nur Fehlerklasse, technischer Code, HTTP-Status und ein nicht rückrechenbarer
Meldungsfingerabdruck erhalten. Diagnoseinformationen liegen ausschließlich in
`sessionStorage` und werden beim Ende der Browsersitzung verworfen.

## Test

1. Benutzermenü öffnen und den angezeigten App-Stand prüfen.
2. „Diagnoseinformationen kopieren“ antippen.
3. Den Text in eine Notiz einfügen und prüfen, dass Version und Commit enthalten sind.
4. Gerät kurz offline schalten und eine Serveraktion auslösen.
5. Prüfen, dass die Meldung eine Fehler-ID enthält.
