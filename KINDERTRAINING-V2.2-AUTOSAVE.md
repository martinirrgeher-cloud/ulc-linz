# Kindertraining V2.2 – Autosave und gemeinsame Navigation

## Neu

- Anwesenheit, Absage und Notiz werden 700 ms nach der letzten Änderung automatisch gespeichert.
- Statusänderungen bleiben in der Oberfläche sofort reaktionsschnell.
- Vor einem Datumswechsel, dem Wechsel zur Modulübersicht oder dem Abmelden werden offene Änderungen zuerst gespeichert.
- Sondertrainings werden direkt nach der Auswahl dauerhaft angelegt.
- Ältere, noch nie gespeicherte Termine verwenden ersatzweise die aktuell aktive Kindertrainingsgruppe, wenn keine historische Gruppenzuordnung vorhanden ist.
- Der erste Statuswechsel kann den ausgewählten Trainingstag nicht mehr durch eine verspätete Initialisierung zurücksetzen.
- Die gemeinsame Kopfzeile enthält ein Haussymbol; die einzelnen Links „Zur Modulübersicht“ entfallen.

## Datenbestand

Bereits gespeicherte Trainingstermine und Teilnehmer-Snapshots werden nicht verändert. Die neue Fallback-Regel gilt nur für ältere Termine, für die noch kein Training gespeichert wurde und zu deren Datum keine historische Gruppenzuordnung vorhanden ist.
