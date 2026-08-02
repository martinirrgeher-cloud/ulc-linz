# Verschlüsseltes Supabase-Backup nach Google Drive

Die GitHub Action `.github/workflows/weekly-encrypted-backup.yml` läuft jeden Montag um 02:15 UTC und kann zusätzlich manuell gestartet werden. Sie sichert:

- Datenbankrollen
- portables Schema und Daten der anwendungseigenen Datenbankbereiche
- zusätzlichen PostgreSQL-Vollauszug inklusive Auth- und Storage-Metadaten
- alle Supabase-Storage-Buckets samt tatsächlichen Dateien
- die zum Stand gehörenden Migrationen

Das Archiv wird mit AES-256 über GnuPG verschlüsselt. In Google Drive bleiben zwölf Wochenstände erhalten.

## Automatische Integritätsprüfung

Ein Backup gilt erst als erfolgreich, wenn alle folgenden Prüfungen bestanden wurden:

1. Alle Dateien sind in `SHA256SUMS` erfasst und stimmen mit ihren Prüfsummen überein.
2. Pflichtdateien, Migrationen und Storage-Manifest sind vorhanden.
3. Jede Storage-Datei stimmt mit Größe und SHA-256-Wert im Storage-Manifest überein.
4. Der PostgreSQL-Vollauszug besitzt ein gültiges Custom-Dump-Format.
5. Das verschlüsselte Archiv lässt sich direkt nach der Erstellung wieder entschlüsseln.
6. Die nach Google Drive hochgeladene Datei wird zurückgeladen, mit dem lokalen verschlüsselten Archiv verglichen, erneut entschlüsselt und vollständig geprüft.
7. Erst danach werden Google-Drive-Backups gelöscht, die älter als zwölf Wochen sind.

## E3d-Wiederherstellungsprobe

Die GitHub Action `.github/workflows/quarterly-backup-restore-test.yml` läuft am 1. Jänner, April, Juli und Oktober um 03:45 UTC und kann jederzeit manuell gestartet werden.

Sie verwendet standardmäßig das neueste Backup aus Google Drive und führt drei voneinander getrennte Wiederherstellungen durch:

- `full-database.dump` in die isolierte Datenbank `ulc_restore_full`
- `schema.sql` und `data.sql` in die isolierte Datenbank `ulc_restore_portable`
- sämtliche tatsächlichen Storage-Dateien in die lokale Supabase-Storage-Instanz

Geprüft werden unter anderem:

- Verschlüsselung, TAR-Struktur und alle SHA-256-Prüfsummen
- Lesbarkeit und Umfang des PostgreSQL-Dump-Katalogs
- vorhandene Kernschemas und Kerntabellen
- Organisationen, Mitgliedschaften und Auth-Benutzer
- neueste Migration im Dump gegenüber den Migrationen im Backup
- Tabellen- und RLS-Struktur
- Bucket-Einstellungen sowie Größe und SHA-256 jeder wiederhergestellten Storage-Datei

Der Lauf erzeugt das GitHub-Artefakt `e3d-backup-restore-report-<Laufnummer>` mit einem Markdown- und JSON-Bericht sowie den technischen Archivprüfungen. Das Artefakt enthält keine Datenbankinhalte, keine Storage-Dateien und keine Secrets. Es wird 30 Tage aufbewahrt.

Die Produktivdatenbank und das produktive Supabase Storage werden dabei nie verbunden oder verändert. Für E3d sind keine zusätzlichen Secrets erforderlich; verwendet werden ausschließlich `BACKUP_ENCRYPTION_PASSWORD` und `RCLONE_CONFIG_B64`. Die lokale Testumgebung und alle entschlüsselten Dateien werden nach dem Bericht gelöscht.

## 1. Google Drive mit rclone verbinden

In PowerShell:

```powershell
winget install Rclone.Rclone
rclone config
```

Dabei einen neuen Remote mit dem Namen **`gdrive`** und dem Typ **Google Drive** anlegen. Die Browseranmeldung mit dem Google-Konto durchführen, in dessen Drive der Ordner liegen soll.

Danach prüfen:

```powershell
rclone lsd gdrive:
```

## 2. rclone-Konfiguration als GitHub Secret vorbereiten

```powershell
$rclonePath = (& rclone config file | Select-Object -Last 1).Trim()

if (-not (Test-Path $rclonePath)) {
    $rclonePath = Join-Path $env:APPDATA "rclone\rclone.conf"
}

if (-not (Test-Path $rclonePath)) {
    throw "Die rclone-Konfiguration wurde nicht gefunden."
}

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($rclonePath))
$base64 | Set-Clipboard
Write-Host "RCLONE_CONFIG_B64 wurde in die Zwischenablage kopiert."
```

Falls die automatische Pfaderkennung nicht funktioniert:

```powershell
$rclonePath = "$env:APPDATA\rclone\rclone.conf"
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($rclonePath))
$base64 | Set-Clipboard
```

## 3. GitHub Secrets anlegen

Im GitHub-Repository unter **Settings → Secrets and variables → Actions → New repository secret** folgende Secrets anlegen:

| Secret | Inhalt |
|---|---|
| `SUPABASE_DB_URL` | Session-Pooler-Verbindungsstring aus Supabase **Connect**, inklusive Datenbankpasswort; Sonderzeichen im Passwort müssen URL-kodiert sein |
| `SUPABASE_URL` | Projekt-URL, zum Beispiel `https://…supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service-Role-Key beziehungsweise geheimer Server-Key; niemals im Browser oder Quellcode verwenden |
| `BACKUP_ENCRYPTION_PASSWORD` | langes, ausschließlich für Backups verwendetes Passwort |
| `RCLONE_CONFIG_B64` | Inhalt aus der PowerShell-Zwischenablage |

Für die Wiederherstellungsprobe sind keine zusätzlichen Produktiv- oder Testprojekt-Secrets erforderlich.

Ein starkes Verschlüsselungspasswort kann mit PowerShell erzeugt werden:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Das Passwort zusätzlich außerhalb von GitHub sicher verwahren. Ohne dieses Passwort kann ein Backup nicht wiederhergestellt werden. Auch `RCLONE_CONFIG_B64` ist geheim, weil die rclone-Konfiguration den Google-Zugriffstoken enthält.

## 4. Wöchentliches Backup manuell testen

GitHub → **Actions → Wöchentliches verschlüsseltes Supabase-Backup → Run workflow**.

Danach kontrollieren:

- Workflow ist grün.
- Die Zusammenfassung zeigt `Google-Drive-Kopie geprüft: true`.
- In Google Drive existiert `ULC-Linz-App-Backups`.
- Darin liegt eine Datei `ULC-Linz-App-Backup_…tar.gz.gpg`.

Ein roter Lauf bedeutet, dass Erstellung, Verschlüsselung, Upload oder Rückprüfung nicht zuverlässig abgeschlossen wurden. In diesem Fall darf der Lauf nicht als vorhandenes Backup gewertet werden.

## 5. Wiederherstellungsprobe sofort manuell starten

Nach dem ersten erfolgreichen D6-Backup:

GitHub → **Actions → Vierteljährliche Backup-Wiederherstellungsprobe → Run workflow**.

Das Feld `backup_file` kann leer bleiben. Dann wird automatisch das neueste Backup verwendet. Alternativ kann ein exakter Dateiname aus Google Drive eingetragen werden.

Ein erfolgreicher grüner Lauf bestätigt, dass Vollauszug, portabler Export und Storage-Dateien in isolierten Testzielen wiederhergestellt und fachlich geprüft wurden. Den Detailbericht findest du beim Workflow unter **Artifacts**.

## 6. Archiv lokal prüfen

Archiv aus Google Drive herunterladen und in PowerShell ausführen, sofern GnuPG installiert ist:

```powershell
gpg --output ULC-Linz-App-Backup.tar.gz --decrypt .\ULC-Linz-App-Backup_2026-....tar.gz.gpg
tar.exe -xzf .\ULC-Linz-App-Backup.tar.gz
node .\scripts\verify-backup-archive.mjs .\backup
```

Der Ordner enthält zwei Datenbankvarianten:

- `roles.sql`, `schema.sql` und `data.sql` für eine portable Wiederherstellung der anwendungseigenen Bereiche
- `full-database.dump` als vollständigen Notfallauszug einschließlich Auth- und Storage-Metadaten

Die tatsächlichen Dateien aus Supabase Storage befinden sich unter `storage/`. Das Manifest `storage/storage-manifest.json` dokumentiert Buckets, Objektpfade, Dateigrößen und SHA-256-Prüfsummen.

Das enthaltene Skript `project/restore-supabase-storage.mjs` arbeitet standardmäßig nur als Vorschau. Ein Upload erfolgt erst mit `--apply`. Die Option `--verify` lädt jede wiederhergestellte Datei erneut herunter und vergleicht ihre Prüfsumme.

## 7. Verbleibende organisatorische Sicherung

Das Verschlüsselungspasswort sollte zusätzlich offline beziehungsweise in einem unabhängigen Passwortmanager verwahrt werden. Für besonders hohe Ausfallsicherheit ist außerdem eine zweite verschlüsselte Kopie außerhalb desselben Google-Kontos sinnvoll.
