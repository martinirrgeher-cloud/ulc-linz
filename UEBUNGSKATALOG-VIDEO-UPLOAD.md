# Übungskatalog – Video-Upload

## Funktionen

- Video direkt aus der Handy-Galerie auswählen
- private Speicherung in Supabase Storage
- maximal 50 MB pro Video
- fortsetzbarer Upload in 5-MB-Blöcken mit Fortschrittsanzeige
- mehrere Videos pro Übung
- ein Video als Hauptvideo kennzeichnen
- Video öffnen und löschen
- bestehende externe Video- und Weblinks bleiben möglich

## Sicherheit

Der Storage-Bucket `exercise-videos` ist privat. Lesezugriff setzt das Leserecht für den Übungskatalog voraus. Hochladen und Löschen sind nur mit Bearbeitungsrecht möglich. Wiedergabelinks sind zeitlich begrenzt.

## Bedienung

Eine neue Übung muss zunächst gespeichert werden. Danach steht im Editor der Bereich `Videos` zur Verfügung. Dort kann eine Videodatei ausgewählt, bezeichnet und hochgeladen werden.
