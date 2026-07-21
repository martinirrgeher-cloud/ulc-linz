# Leistungsgruppen Phase 1.1

## Ziel

Die Trainingsanmeldung wurde auf einen einfachen, mobilen Ablauf reduziert:

- beim Öffnen ist die eigene Anmeldung vorausgewählt;
- alle Trainingstage der Woche stehen untereinander;
- Status und kurzer Hinweis werden automatisch gespeichert;
- Uhrzeit und Traineranmeldung entfallen aus der Oberfläche;
- innerhalb derselben Leistungsgruppe kann die Anmeldung eines Kollegen übernommen werden;
- eine kompakte Wochenmatrix zeigt alle Athleten und Trainingstage.

## Ansichten

### Anmeldung

- Athlet auswählen
- Woche wechseln
- je Trainingstag: Offen, Ja, Vielleicht oder Nein
- optionaler Hinweis
- Autospeichern

### Übersicht

- Summen je Trainingstag
- alle Athleten in Zeilen
- Trainingstage in schmalen Spalten
- Farbcodierung: grün, gelb, rot und grau
- Name oder Zelle öffnet direkt die Anmeldung der Person

## Datenbank

Migration `202607190012_performance_registration_simplified.sql`:

- erlaubt nachvollziehbare Vertretung innerhalb derselben Leistungsgruppe;
- kennzeichnet solche Änderungen mit `source = proxy`;
- liefert allen berechtigten Gruppenmitgliedern die gemeinsame Wochenübersicht;
- entfernt Uhrzeitwerte bei neuen Anmeldungen, ohne bestehende Spalten oder alte Daten zu löschen.

Die Traineranwesenheit und Standardwochen bleiben technisch erhalten, werden in dieser vereinfachten Oberfläche aber nicht mehr verwendet.
