# Kindertraining – kompakte Erfassung und Trainergruppen

## Änderungen

- Name, Notfallkontakt und die drei möglichen Statusaktionen stehen in einer kompakten Zeile.
- Der Statistiklink steht rechts neben der Überschrift „Kindertraining“.
- Die redundante Speicherzeit im Kopfbereich wurde entfernt; der Autosave-Status bleibt unten sichtbar.
- Trainer können einer oder mehreren Trainingsgruppen zugeordnet werden.
- Im Kindertraining werden standardmäßig die Trainer der Kindertrainingsgruppe gezeigt.
- „Alle Trainer anzeigen“ blendet Aushilfstrainer ein.
- Das Stammdatenmodul heißt „Athleten, Trainer & Gruppen“.
- Die Hausnavigation wartet auf das Autospeichern und navigiert anschließend mit einem Klick.
- Die Statistik hat immer ein gültiges Von- und Bis-Datum. Der globale Standard bleibt vorrangig; als technische Absicherung wird heute verwendet.

## Datenbank

Migration `202607180008_trainer_groups_and_ui_fixes.sql` ergänzt ausschließlich Trainer-Gruppenzuordnungen und neue RPC-Funktionen. Bestehende Trainings-, Anwesenheits- und Kontaktdaten werden nicht verändert.
