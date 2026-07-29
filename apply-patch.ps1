param(
    [Parameter(Mandatory = $false)]
    [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadRoot = Join-Path $PatchRoot "payload"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

if (-not (Test-Path -LiteralPath $PayloadRoot -PathType Container)) {
    throw "Patch-Inhalt wurde nicht gefunden: $PayloadRoot"
}

$PackageJson = Join-Path $ProjectRoot "package.json"
if (-not (Test-Path -LiteralPath $PackageJson -PathType Leaf)) {
    throw "Im Zielverzeichnis wurde keine package.json gefunden: $ProjectRoot"
}

$Package = Get-Content -LiteralPath $PackageJson -Raw | ConvertFrom-Json
if ($Package.name -ne "ulc-linz-app-v2") {
    throw "Das Zielprojekt ist nicht die erwartete ULC-Linz-App (Paketname: $($Package.name))."
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupRoot = Join-Path $ProjectRoot "_patch_backup\D0-D1_$Timestamp"
$PatchedFiles = New-Object System.Collections.Generic.List[string]
$BackedUpFiles = New-Object System.Collections.Generic.List[string]

Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File | ForEach-Object {
    $RelativePath = $_.FullName.Substring($PayloadRoot.Length).TrimStart([char[]]@('\', '/'))
    $TargetPath = Join-Path $ProjectRoot $RelativePath
    $TargetDirectory = Split-Path -Parent $TargetPath

    if (Test-Path -LiteralPath $TargetPath -PathType Leaf) {
        $BackupPath = Join-Path $BackupRoot $RelativePath
        $BackupDirectory = Split-Path -Parent $BackupPath
        New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
        Copy-Item -LiteralPath $TargetPath -Destination $BackupPath -Force
        $BackedUpFiles.Add($RelativePath)
    }

    New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $TargetPath -Force
    $PatchedFiles.Add($RelativePath)
}

Write-Host ""
Write-Host "D0/D1-Patch erfolgreich angewendet." -ForegroundColor Green
Write-Host "Projekt: $ProjectRoot"
Write-Host "Geänderte/ergänzte Dateien: $($PatchedFiles.Count)"
if ($BackedUpFiles.Count -gt 0) {
    Write-Host "Sicherung: $BackupRoot"
}
Write-Host ""
Write-Host "Nächste Schritte:" -ForegroundColor Yellow
Write-Host "1. SQL-1 vor dem Frontend-Rollout ausführen."
Write-Host "2. npm.cmd ci"
Write-Host "3. npm.cmd run ci:quality"
Write-Host "4. Frontend bereitstellen und testen."
Write-Host "5. SQL-2 erst nach erfolgreichem Test ausführen."
