# Wöchentliches verschlüsseltes Backup nach Google Drive

Die GitHub Action `.github/workflows/weekly-encrypted-backup.yml` läuft jeden Montag um 02:15 UTC und kann zusätzlich manuell gestartet werden. Sie sichert:

- Datenbankrollen
- portables Schema und Daten der anwendungseigenen Datenbankbereiche
- zusätzlichen PostgreSQL-Vollauszug inklusive Auth- und Storage-Metadaten
- alle Supabase-Storage-Buckets samt tatsächlichen Dateien
- die zum Stand gehörenden Migrationen

Das Archiv wird vor dem Upload mit AES-256 über GnuPG verschlüsselt. In Google Drive bleiben zwölf Wochenstände erhalten.

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

Ein starkes Verschlüsselungspasswort kann mit PowerShell erzeugt werden:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Das Passwort zusätzlich außerhalb von GitHub sicher verwahren. Ohne dieses Passwort kann ein Backup nicht wiederhergestellt werden. Auch `RCLONE_CONFIG_B64` ist geheim, weil die rclone-Konfiguration den Google-Zugriffstoken enthält.

## 4. Ersten Test manuell starten

GitHub → **Actions → Wöchentliches verschlüsseltes Supabase-Backup → Run workflow**.

Danach kontrollieren:

- Workflow ist grün
- in Google Drive existiert `ULC-Linz-App-Backups`
- darin liegt eine Datei `ULC-Linz-App-Backup_…tar.gz.gpg`

## 5. Testweise entschlüsseln

Archiv aus Google Drive herunterladen und in PowerShell ausführen, sofern GnuPG installiert ist:

```powershell
gpg --output ULC-Linz-App-Backup.tar.gz --decrypt .\ULC-Linz-App-Backup_2026-....tar.gz.gpg
tar.exe -xzf .\ULC-Linz-App-Backup.tar.gz
```

Der Ordner enthält zwei Datenbankvarianten:

- `roles.sql`, `schema.sql` und `data.sql` für die übliche portable Wiederherstellung der anwendungseigenen Bereiche
- `full-database.dump` als zusätzlicher Notfallauszug einschließlich Auth- und Storage-Metadaten

Die tatsächlichen Dateien aus Supabase Storage befinden sich unter `storage/`. Das Manifest `storage/storage-manifest.json` dokumentiert Buckets und Objektpfade. Das enthaltene Skript `scripts/restore-supabase-storage.mjs` arbeitet standardmäßig nur als Vorschau; ein Upload erfolgt erst mit `--apply`.

Mindestens einmal pro Quartal sollte eine Testwiederherstellung in ein separates Supabase-Testprojekt erfolgen. Ein vorhandenes Backup ist erst dann belastbar, wenn die Wiederherstellung geprüft wurde.
