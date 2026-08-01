param(
  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Invoke-Supabase {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & npx.cmd --yes "supabase@2.109.1" @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase command failed: $($Arguments -join ' ')"
  }
}

Write-Host "Checking Docker..."
& docker.exe info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not running. Start Docker Desktop and run the command again."
}

$StartedHere = $false

try {
  Write-Host "Starting isolated local Supabase environment..."
  Invoke-Supabase -Arguments @(
    "start",
    "-x",
    "studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,realtime"
  )
  $StartedHere = $true

  Write-Host "Rebuilding database from all migrations..."
  Invoke-Supabase -Arguments @("db", "reset")

  Write-Host "Running pgTAP database tests..."
  Invoke-Supabase -Arguments @("test", "db")

  Write-Host ""
  Write-Host "E1a database tests completed successfully."
}
finally {
  if ($StartedHere -and -not $KeepRunning) {
    Write-Host "Stopping local Supabase environment..."
    try {
      Invoke-Supabase -Arguments @("stop", "--no-backup")
    }
    catch {
      Write-Warning "The local Supabase environment could not be stopped automatically."
    }
  }
}
