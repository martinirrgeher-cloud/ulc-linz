param(
  [switch]$KeepSupabaseRunning
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectPath = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectPath

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Title,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Title ist mit Exit-Code $LASTEXITCODE fehlgeschlagen."
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker wurde nicht gefunden. Bitte Docker Desktop installieren und starten."
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop ist nicht gestartet oder nicht erreichbar."
}

$startedHere = $false
try {
  Invoke-Step "Lokales Supabase starten" {
    npm.cmd run supabase:start
  }
  $startedHere = $true

  Invoke-Step "Datenbank aus allen Migrationen neu aufbauen" {
    npm.cmd run supabase:reset
  }

  Invoke-Step "Datenbanktypen aus dem lokalen Schema erzeugen" {
    npm.cmd run supabase:types:local
  }

  Invoke-Step "TypeScript- und Produktions-Build prüfen" {
    npm.cmd run build
  }

  Write-Host ""
  Write-Host "Paket A wurde erfolgreich geprüft." -ForegroundColor Green
  Write-Host "Alle Migrationen konnten auf einer leeren lokalen Datenbank ausgeführt werden."
  Write-Host "Die Datei src/types/database.generated.ts wurde aus diesem Schema neu erzeugt."
}
finally {
  if ($startedHere -and -not $KeepSupabaseRunning) {
    Write-Host ""
    Write-Host "Lokales Supabase wird beendet ..." -ForegroundColor DarkGray
    npm.cmd run supabase:stop | Out-Host
  }
}
