# E3d – Backup- und Wiederherstellungstest

## Ziel

Ein vorhandenes verschlüsseltes Google-Drive-Backup wird nicht nur entpackt, sondern vollständig in isolierte Testziele zurückgespielt und fachlich geprüft.

## Testumfang

1. Neueste oder manuell ausgewählte Backup-Datei aus Google Drive laden.
2. SHA-256 des verschlüsselten Archivs protokollieren.
3. Mit dem vorhandenen Backup-Passwort entschlüsseln.
4. TAR-Inhalt, Pflichtdateien und sämtliche internen Prüfsummen kontrollieren.
5. PostgreSQL-Custom-Dump-Katalog mit `pg_restore --list` prüfen.
6. Vollauszug in `ulc_restore_full` wiederherstellen.
7. Portables Schema und Daten in `ulc_restore_portable` wiederherstellen.
8. Kernschemas, Kerntabellen, RLS, Funktionen, Trigger und Migrationsstand prüfen.
9. Organisationen, Mitgliedschaften und Auth-Benutzer als Mindestdatenbestand prüfen.
10. Alle Storage-Dateien in die lokale Supabase-Instanz hochladen und erneut per SHA-256 vergleichen.
11. Bericht als GitHub-Artefakt speichern.
12. Lokale Supabase-Umgebung und entschlüsselte Dateien löschen.

## Sicherheit

Der Workflow enthält keine Produktiv-URL, keinen produktiven Datenbankzugang und keinen Service-Role-Key des Produktivprojekts. Er nutzt nur die bestehenden Secrets für Google Drive und die Backup-Entschlüsselung.

## Start

GitHub → Actions → **E3d Backup-Wiederherstellungsprobe** → **Run workflow**. Das Feld `backup_file` kann leer bleiben; dann wird das neueste Backup ausgewählt.

## Ergebnis

Bei Erfolg ist der Lauf grün und enthält das Artefakt `e3d-backup-restore-report-<Laufnummer>`. Der wichtigste Inhalt ist `database-restore-report.md`.
