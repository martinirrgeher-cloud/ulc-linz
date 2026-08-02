# E3d – Backup- und Wiederherstellungstest

## Ziel

Ein vorhandenes verschlüsseltes Google-Drive-Backup wird vollständig in eine leere,
isolierte lokale Supabase-Instanz zurückgespielt und fachlich geprüft.

## Korrigierter Wiederherstellungsweg

Der Wiederherstellungstest verwendet `roles.sql`, `schema.sql` und `data.sql`, die
mit `supabase db dump` erzeugt wurden. Das ist der von Supabase vorgesehene logische
Restore-Weg. Der zusätzliche `full-database.dump` wird weiterhin auf Lesbarkeit und
Katalogumfang geprüft, aber nicht ungefiltert eingespielt, weil ein roher `pg_dump`
Supabase-interne Schemas enthält.

## Testumfang

1. Neueste oder manuell ausgewählte Backup-Datei aus Google Drive laden.
2. Verschlüsseltes Archiv per SHA-256 protokollieren und entschlüsseln.
3. TAR-Struktur, Pflichtdateien und interne Prüfsummen kontrollieren.
4. Katalog des zusätzlichen PostgreSQL-Rohdumps mit `pg_restore --list` prüfen.
5. Eine eigene leere lokale Supabase-Instanz ohne Projektmigrationen starten.
6. Rollen, logisches Schema und Daten in einer Transaktion wiederherstellen.
7. Falls vorhanden, die separat gesicherte Supabase-Migrationshistorie einspielen.
8. Auth-Benutzer, Storage-Metadaten, Public-Tabellen, RLS, Funktionen und Trigger prüfen.
9. Alle tatsächlichen Storage-Dateien lokal hochladen und per SHA-256 rückprüfen.
10. Datensparsamen Bericht als GitHub-Artefakt speichern.
11. Lokale Testumgebung und entschlüsselte Dateien vollständig löschen.

## Alte und neue Backups

Backups vor dieser Korrektur enthalten noch keine Dateien `history_schema.sql` und
`history_data.sql`. Sie werden trotzdem vollständig wiederhergestellt; der Bericht
weist lediglich darauf hin, dass der Datenbankeintrag der Migrationshistorie nicht
separat geprüft werden konnte. Neue Wochenbackups enthalten diese beiden Dateien.

## Sicherheit

Der Workflow verwendet keine Produktiv-URL, keinen Produktiv-Datenbankzugang und
keinen Service-Role-Key des Produktivprojekts. Er nutzt nur die bestehenden Secrets
für Google Drive und die Entschlüsselung.

## Start

GitHub → Actions → **E3d Backup-Wiederherstellungsprobe** → **Run workflow**.
Das Feld `backup_file` kann leer bleiben; dann wird das neueste Backup ausgewählt.
