# Kindertraining – Ausbau

Dieser Stand ergänzt die getestete Kindertraining-Autosave-Version um:

- löschbare beziehungsweise historisch archivierte Sondertrainings
- Trainerstammdaten und Traineranwesenheit je Training
- Trainingsort: Indoor, Outdoor oder Gemischt
- Notfallkontakte bei Athleten mit Direktwahl im Training
- globale Kindertraining-Statistik mit Zeitraumfilter
- Trainingsliste, Athletenquote, Teilnehmerentwicklung und Trainereinsätze
- Direktlink zwischen Trainingserfassung und Statistik
- „Alle offenen auf Fehlt setzen“ und Erfassungsfortschritt
- automatische Vorauswahl von Trainern und Trainingsort aus dem letzten Training

## Datenbank

Nur die neue Migration ausführen:

`supabase/migrations/202607180007_kindertraining_completion.sql`

Die Migrationen 001 bis 006 dürfen nicht erneut ausgeführt werden.

## Wichtige Tests

1. Trainer unter Athleten → Trainer anlegen und bearbeiten.
2. Notfallkontakt bei einem Athleten speichern und im Kindertraining über das Telefonsymbol öffnen.
3. Trainer und Trainingsort auswählen; Autosave und Neuladen prüfen.
4. Sondertraining anlegen, speichern und wieder löschen.
5. Statistik öffnen, Zeitraum ändern und globales Von-Datum speichern.
6. Trainingsliste, Athletenstatistik, Monatsentwicklung und Trainereinsätze prüfen.
