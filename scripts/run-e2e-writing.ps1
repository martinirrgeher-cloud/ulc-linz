param(
  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$SupabaseVersion = "2.109.1"
$PlaywrightVersion = "1.62.1"
$StartedHere = $false

function Invoke-Supabase {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & npx.cmd --yes "supabase@$SupabaseVersion" @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase command failed: $($Arguments -join ' ')"
  }
}

function Set-LocalSupabaseEnvironment {
  $StatusLines = & npx.cmd --yes "supabase@$SupabaseVersion" status -o env
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase status could not be read."
  }

  $Values = @{}
  foreach ($Line in $StatusLines) {
    if ($Line -match '^([A-Z0-9_]+)=(.*)$') {
      $Name = $Matches[1]
      $Value = $Matches[2].Trim()
      if ($Value.Length -ge 2 -and $Value.StartsWith('"') -and $Value.EndsWith('"')) {
        $Value = $Value.Substring(1, $Value.Length - 2)
      }
      $Values[$Name] = $Value
    }
  }

  foreach ($Required in @("API_URL", "ANON_KEY", "SERVICE_ROLE_KEY")) {
    if (-not $Values.ContainsKey($Required) -or [string]::IsNullOrWhiteSpace($Values[$Required])) {
      throw "Supabase status did not provide $Required."
    }
  }

  $env:SUPABASE_URL = $Values["API_URL"]
  $env:SUPABASE_SERVICE_ROLE_KEY = $Values["SERVICE_ROLE_KEY"]
  $env:VITE_SUPABASE_URL = $Values["API_URL"]
  $env:VITE_SUPABASE_PUBLISHABLE_KEY = $Values["ANON_KEY"]
  $env:VITE_ALLOW_SELF_SIGNUP = "false"
  $env:E2E_WRITING_BASE_URL = "http://127.0.0.1:4174"
  $env:E2E_SEED_OUTPUT = "test-results/e2e-writing/seed.json"
}

Write-Host "Checking Docker..."
$DockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
if ($null -eq $DockerCommand) {
  throw "Docker Desktop is not installed or docker.exe is not available in PATH."
}

& $DockerCommand.Source info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not running. Start Docker Desktop and run the command again."
}

try {
  Write-Host "Starting isolated local Supabase environment..."
  Invoke-Supabase -Arguments @(
    "start",
    "-x",
    "studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor"
  )
  $StartedHere = $true

  Write-Host "Rebuilding the local database from migrations..."
  Invoke-Supabase -Arguments @("db", "reset")

  Write-Host "Reading isolated Supabase credentials..."
  Set-LocalSupabaseEnvironment

  Write-Host "Creating artificial E1b.2 users and test data..."
  & node.exe "scripts/seed-e2e-writing.mjs"
  if ($LASTEXITCODE -ne 0) { throw "E1b.2 seed creation failed." }

  $InstalledPackage = Join-Path $ProjectRoot "node_modules\@playwright\test\package.json"
  $NeedsInstall = $true
  if (Test-Path -LiteralPath $InstalledPackage) {
    try {
      $InstalledVersion = (Get-Content -LiteralPath $InstalledPackage -Raw | ConvertFrom-Json).version
      $NeedsInstall = $InstalledVersion -ne $PlaywrightVersion
    }
    catch {
      $NeedsInstall = $true
    }
  }

  if ($NeedsInstall) {
    Write-Host "Installing Playwright Test without changing package-lock.json..."
    & npm.cmd install --no-save --package-lock=false "@playwright/test@$PlaywrightVersion"
    if ($LASTEXITCODE -ne 0) { throw "Playwright Test installation failed." }
  }

  Write-Host "Installing Chromium for Playwright..."
  & npx.cmd playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw "Chromium installation failed." }

  Write-Host "Checking the E1b.2 test suite..."
  & npm.cmd run check:e2e-writing-suite
  if ($LASTEXITCODE -ne 0) { throw "E1b.2 suite check failed." }

  Write-Host "Building the application against isolated Supabase..."
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Application build failed." }

  Write-Host "Running writing E2E tests..."
  & npx.cmd playwright test --config=playwright.writing.config.mjs
  if ($LASTEXITCODE -ne 0) { throw "Writing E2E tests failed." }

  Write-Host ""
  Write-Host "E1b.2 writing E2E tests completed successfully."
}
finally {
  if ($StartedHere -and -not $KeepRunning) {
    Write-Host "Stopping isolated local Supabase environment..."
    try {
      Invoke-Supabase -Arguments @("stop", "--no-backup")
    }
    catch {
      Write-Warning "The local Supabase environment could not be stopped automatically."
    }
  }
}
