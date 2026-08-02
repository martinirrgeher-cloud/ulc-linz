# E4 – Mehrbenutzer-Konsistenz

E4 bündelt Bearbeitungsschutz, Realtime-Aktualisierung und bewusste Konfliktbehandlung
für Athleten, Gruppen, Trainer, Übungen, Trainingsblöcke, Trainingspläne und
Trainingsdokumentationen.

## E4a – Bearbeitungsschutz

Die bestehenden atomaren Sperr- und Versionsprüfungen bleiben die einzige
Schreibschnittstelle. Beim Öffnen wird zusätzlich die vom Server gelesene
Datensatzversion mit dem Listenstand verglichen. Abweichungen werden vor dem
Speichern sichtbar.

## E4b – Realtime

Die sieben Kerntabellen sind Teil der Supabase-Realtime-Publication. Listen werden
nach Änderungen anderer Sitzungen ohne komplettes Neuladen aktualisiert. Nach
einer tatsächlichen Realtime-Neuverbindung oder der Wiederherstellung der
Netzverbindung wird ein kontrollierter Abgleich ausgelöst. Ein bloßer Fokus- oder
Tabwechsel erzeugt keinen Konflikthinweis.

## E4c – Konflikte

Während eines offenen Entwurfs wird kein Serverstand ungefragt in das Formular
geschrieben. Der Benutzer entscheidet zwischen:

- Serverstand laden: lokalen Entwurf verwerfen und aktuellen Datensatz öffnen.
- Eigene Eingaben behalten: nur die neue Serverversion übernehmen, Entwurf
  beibehalten und Bearbeitungssperre erneut prüfen.

Die Trainingsdokumentation speichert Konfliktentwürfe weiterhin lokal im Browser.
Eigene Speicherereignisse in Trainingsplanung und Trainingsdokumentation werden
kurzzeitig unterdrückt, damit sie nicht als fremde Realtime-Änderung erscheinen.

## Test

Der schreibende E2E-Test verwendet zwei mobile Browserkontexte und prüft:

1. automatische Aktualisierung einer Athletenliste,
2. bewusste Sperrübernahme,
3. sichtbaren Realtime-Konflikt,
4. Erhalt lokaler Formulareingaben,
5. anschließendes Speichern auf Basis der aktuellen Serverversion.
