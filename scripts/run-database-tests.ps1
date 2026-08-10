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

$DatabaseTests = @(
  "supabase/tests/database/00_schema_and_security.test.sql",
  "supabase/tests/database/10_role_matrix.test.sql",
  "supabase/tests/database/20_collaboration.test.sql",
  "supabase/tests/database/30_transactional_import.test.sql",
  "supabase/tests/database/40_realtime_collaboration.test.sql",
  "supabase/tests/database/50_catalog_block_intelligence.test.sql",
  "supabase/tests/database/60_user_management_e5c.test.sql",
  "supabase/tests/database/61_parent_multi_athlete_links.test.sql",
  "supabase/tests/database/70_catalog_block_read_models.test.sql",
  "supabase/tests/database/71_statistics_permissions_training_modules.test.sql",
  "supabase/tests/database/73_legacy_write_rpc_execution.test.sql"
)

Write-Host "Checking Docker..."
$DockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
if ($null -eq $DockerCommand) {
  throw "Docker Desktop is not installed or docker.exe is not available in PATH."
}

& $DockerCommand.Source info *> $null
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
  Invoke-Supabase -Arguments (@("test", "db") + $DatabaseTests)

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
